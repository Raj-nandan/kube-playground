import fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import {
  createOrReplaceK6Job,
  deleteK6Job,
  findK6PodIp,
  updateK6VUs,
} from './k8s.js';
import {
  startPoller,
  getLatestState,
  pollCluster,
  subscribeState,
} from './poller.js';
import { StartLoadParams } from './types.js';

const PORT = parseInt(process.env.PORT || '4000', 10);
const POLL_INTERVAL_MS = parseInt(process.env.POLL_INTERVAL_MS || '2000', 10);

const server: FastifyInstance = fastify({ logger: false });

server.register(cors, {
  origin: '*',
  methods: ['GET', 'POST', 'PATCH', 'OPTIONS'],
});

async function apiRoutes(f: FastifyInstance) {
  // GET /healthz
  f.get('/healthz', async () => {
    return { status: 'ok' };
  });

  // GET /state
  f.get('/state', async () => {
    const state = getLatestState();
    if (state) return state;
    return await pollCluster();
  });

  // GET /stream (Server-Sent Events)
  f.get('/stream', async (req, reply) => {
    reply.raw.setHeader('Content-Type', 'text/event-stream');
    reply.raw.setHeader('Cache-Control', 'no-cache, no-transform');
    reply.raw.setHeader('Connection', 'keep-alive');
    reply.raw.setHeader('X-Accel-Buffering', 'no');
    reply.raw.flushHeaders();

    // Send current state immediately
    const current = getLatestState();
    if (current) {
      reply.raw.write(`data: ${JSON.stringify(current)}\n\n`);
    }

    // Subscribe to state updates
    const unsubscribe = subscribeState((state) => {
      reply.raw.write(`data: ${JSON.stringify(state)}\n\n`);
    });

    req.raw.on('close', () => {
      unsubscribe();
    });
  });

  // POST /load/:service/start
  f.post<{ Params: { service: string }; Body: StartLoadParams }>(
    '/load/:service/start',
    async (req, reply) => {
      const service = req.params.service.toLowerCase();
      if (!['a', 'b', 'c'].includes(service)) {
        reply.status(400);
        return { error: 'Invalid service. Must be a, b, or c.' };
      }

      const body = req.body || ({} as StartLoadParams);
      const vus = typeof body.vus === 'number' ? Math.min(Math.max(0, body.vus), 500) : 20;
      const workMs = typeof body.workMs === 'number' ? Math.min(Math.max(1, body.workMs), 500) : 50;
      const route = ['work', 'chain', 'fanout'].includes(body.route) ? body.route : 'work';
      const sleepMs = typeof body.sleepMs === 'number' ? Math.min(Math.max(0, body.sleepMs), 1000) : 100;
      const targets = body.targets || [];

      try {
        await createOrReplaceK6Job(service, {
          vus,
          workMs,
          route,
          targets,
          sleepMs,
        });

        // Trigger an immediate poll to update state quickly
        setTimeout(() => pollCluster().catch(() => {}), 1500);

        return {
          status: 'started',
          service,
          vus,
          workMs,
          route,
          targets,
          sleepMs,
        };
      } catch (err: any) {
        reply.status(500);
        return { error: 'Failed to start load job', message: err.message };
      }
    }
  );

  // PATCH /load/:service
  f.patch<{ Params: { service: string }; Body: { vus: number } }>(
    '/load/:service',
    async (req, reply) => {
      const service = req.params.service.toLowerCase();
      if (!['a', 'b', 'c'].includes(service)) {
        reply.status(400);
        return { error: 'Invalid service. Must be a, b, or c.' };
      }

      const vus = req.body?.vus;
      if (typeof vus !== 'number' || vus < 0 || vus > 500) {
        reply.status(400);
        return { error: 'vus must be an integer between 0 and 500.' };
      }

      try {
        const podIp = await findK6PodIp(service);
        if (!podIp) {
          reply.status(404);
          return { error: `No running load job found for service ${service}` };
        }

        const ok = await updateK6VUs(podIp, vus);
        if (!ok) {
          reply.status(502);
          return { error: 'Failed to update VUs via k6 control API' };
        }

        return { status: 'updated', service, vus };
      } catch (err: any) {
        reply.status(500);
        return { error: 'Failed to update load', message: err.message };
      }
    }
  );

  // POST /load/:service/stop
  f.post<{ Params: { service: string } }>('/load/:service/stop', async (req, reply) => {
    const service = req.params.service.toLowerCase();
    if (!['a', 'b', 'c'].includes(service)) {
      reply.status(400);
      return { error: 'Invalid service. Must be a, b, or c.' };
    }

    try {
      await deleteK6Job(service);
      setTimeout(() => pollCluster().catch(() => {}), 1000);
      return { status: 'stopped', service };
    } catch (err: any) {
      reply.status(500);
      return { error: 'Failed to stop load job', message: err.message };
    }
  });
}

server.register(apiRoutes);
server.register(apiRoutes, { prefix: '/api' });

async function main() {
  try {
    await server.listen({ port: PORT, host: '0.0.0.0' });
    console.log(`[control-api] Server running on port ${PORT}`);
    startPoller(POLL_INTERVAL_MS);
  } catch (err) {
    console.error('[control-api] Startup failed:', err);
    process.exit(1);
  }
}

main();

