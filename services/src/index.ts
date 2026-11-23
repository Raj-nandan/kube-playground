import fastify, { FastifyInstance } from 'fastify';
import os from 'os';
import client from 'prom-client';
import { StatsTracker } from './stats.js';

// Configuration
const SERVICE_NAME = (process.env.SERVICE_NAME || 'a').toLowerCase();
const PORT = parseInt(process.env.PORT || '8080', 10);
const ADMIN_PORT = parseInt(process.env.ADMIN_PORT || '9090', 10);
const MAX_HOPS = parseInt(process.env.MAX_HOPS || '5', 10);
const PEER_TIMEOUT_MS = parseInt(process.env.PEER_TIMEOUT_MS || '2000', 10);
const RELEASE_LABEL = process.env.RELEASE_LABEL || 'current';
const TRACK = process.env.TRACK || 'stable';
const POD_NAME = process.env.POD_NAME || os.hostname();
const NODE_NAME = process.env.NODE_NAME || 'minikube';
const EXTRA_LATENCY_MS = parseInt(process.env.EXTRA_LATENCY_MS || '0', 10);
const ERROR_RATE = parseFloat(process.env.ERROR_RATE || '0');
const SHUTDOWN_DELAY_MS = parseInt(process.env.SHUTDOWN_DELAY_MS || '5000', 10);
const STARTED_AT = new Date().toISOString();

// Parse PEERS
// Default: a=http://svc-a:8080,b=http://svc-b:8080,c=http://svc-c:8080
const peersEnv = process.env.PEERS || 'a=http://svc-a:8080,b=http://svc-b:8080,c=http://svc-c:8080';
const peerMap = new Map<string, string>();
for (const entry of peersEnv.split(',')) {
  const [k, v] = entry.trim().split('=');
  if (k && v) {
    peerMap.set(k.trim().toLowerCase(), v.trim());
  }
}

// Prometheus metrics setup
const registry = new client.Registry();
client.collectDefaultMetrics({ register: registry });

const httpRequestsTotal = new client.Counter({
  name: 'http_requests_total',
  help: 'Total HTTP requests processed',
  labelNames: ['service', 'route', 'status'],
  registers: [registry],
});

const httpRequestDuration = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['service', 'route'],
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
  registers: [registry],
});

const httpInflightRequests = new client.Gauge({
  name: 'http_inflight_requests',
  help: 'Number of in-flight HTTP requests',
  labelNames: ['service'],
  registers: [registry],
});

const outboundRequestsTotal = new client.Counter({
  name: 'outbound_requests_total',
  help: 'Total outbound requests made to peer services',
  labelNames: ['service', 'target', 'status'],
  registers: [registry],
});

const statsTracker = new StatsTracker();
let isShuttingDown = false;

function burnCpu(ms: number) {
  const start = Date.now();
  while (Date.now() - start < ms) {
    Math.sqrt(Math.random());
  }
}

function copyForwardHeaders(incomingHeaders: Record<string, any>, currentHops: number): Record<string, string> {
  const headers: Record<string, string> = {
    'x-hops': String(currentHops + 1),
  };

  const copyKeys = ['x-request-id', 'traceparent', 'tracestate'];
  for (const k of copyKeys) {
    if (incomingHeaders[k]) {
      headers[k] = String(incomingHeaders[k]);
    }
  }

  for (const [k, v] of Object.entries(incomingHeaders)) {
    if (k.toLowerCase().startsWith('x-b3-') && v) {
      headers[k] = String(v);
    }
  }

  return headers;
}

// Port 8080: Application Server
const appServer: FastifyInstance = fastify({ logger: false });

appServer.addHook('onRequest', async (req, reply) => {
  reply.header('x-release', RELEASE_LABEL);
  httpInflightRequests.set({ service: SERVICE_NAME }, statsTracker.getInflight() + 1);
});

appServer.addHook('onResponse', async (req, reply) => {
  const route = req.routeOptions?.url || req.url.split('?')[0];
  const durationSec = reply.elapsedTime / 1000;
  const statusStr = String(reply.statusCode);

  httpRequestsTotal.inc({ service: SERVICE_NAME, route, status: statusStr });
  httpRequestDuration.observe({ service: SERVICE_NAME, route }, durationSec);
  statsTracker.recordRequest(reply.elapsedTime, reply.statusCode);
  httpInflightRequests.set({ service: SERVICE_NAME }, statsTracker.getInflight());
});

// GET /whoami
appServer.get('/whoami', async () => {
  return {
    service: SERVICE_NAME,
    pod: POD_NAME,
    node: NODE_NAME,
    release: RELEASE_LABEL,
    track: TRACK,
    startedAt: STARTED_AT,
  };
});

// GET /work?ms=N
appServer.get<{ Querystring: { ms?: string } }>('/work', async (req, reply) => {
  const endInflight = statsTracker.startRequest();
  try {
    const rawMs = parseInt(req.query.ms || '50', 10);
    const workMs = Math.min(Math.max(1, isNaN(rawMs) ? 50 : rawMs), 1000);

    burnCpu(workMs);

    if (EXTRA_LATENCY_MS > 0) {
      await new Promise((r) => setTimeout(r, EXTRA_LATENCY_MS));
    }

    if (ERROR_RATE > 0 && Math.random() < ERROR_RATE) {
      reply.status(500);
      return { error: 'Internal Server Error (simulated)' };
    }

    return {
      service: SERVICE_NAME,
      pod: POD_NAME,
      release: RELEASE_LABEL,
      workMs,
    };
  } finally {
    endInflight();
  }
});

// GET /chain?path=b,c&ms=N
appServer.get<{ Querystring: { path?: string; ms?: string } }>('/chain', async (req, reply) => {
  const endInflight = statsTracker.startRequest();
  try {
    const rawMs = parseInt(req.query.ms || '50', 10);
    const workMs = Math.min(Math.max(1, isNaN(rawMs) ? 50 : rawMs), 1000);

    burnCpu(workMs);

    if (EXTRA_LATENCY_MS > 0) {
      await new Promise((r) => setTimeout(r, EXTRA_LATENCY_MS));
    }

    if (ERROR_RATE > 0 && Math.random() < ERROR_RATE) {
      reply.status(500);
      return { error: 'Internal Server Error (simulated)' };
    }

    const currentHops = parseInt((req.headers['x-hops'] as string) || '0', 10);
    if (currentHops >= MAX_HOPS) {
      reply.status(508);
      return { error: 'loop detected' };
    }

    const pathRaw = req.query.path ? req.query.path.trim() : '';
    if (!pathRaw) {
      return {
        service: SERVICE_NAME,
        pod: POD_NAME,
        release: RELEASE_LABEL,
        workMs,
        next: null,
      };
    }

    const targets = pathRaw.split(',').map((t) => t.trim().toLowerCase()).filter(Boolean);
    if (targets.length === 0) {
      return {
        service: SERVICE_NAME,
        pod: POD_NAME,
        release: RELEASE_LABEL,
        workMs,
        next: null,
      };
    }

    const nextTarget = targets[0];
    const remainingPath = targets.slice(1).join(',');
    const peerUrl = peerMap.get(nextTarget);

    if (!peerUrl) {
      reply.status(400);
      return { error: `Unknown target ${nextTarget}` };
    }

    if (currentHops + 1 > MAX_HOPS) {
      reply.status(508);
      return { error: 'loop detected' };
    }

    const forwardHeaders = copyForwardHeaders(req.headers as Record<string, any>, currentHops);
    const url = `${peerUrl}/chain?path=${encodeURIComponent(remainingPath)}&ms=${workMs}`;

    statsTracker.recordOutbound(nextTarget);

    try {
      const res = await fetch(url, {
        headers: forwardHeaders,
        signal: AbortSignal.timeout(PEER_TIMEOUT_MS),
      });

      outboundRequestsTotal.inc({
        service: SERVICE_NAME,
        target: nextTarget,
        status: String(res.status),
      });

      if (!res.ok) {
        reply.status(502);
        const body = await res.text();
        return {
          error: 'downstream call failed',
          target: nextTarget,
          status: res.status,
          body,
        };
      }

      const downstreamData = await res.json();
      return {
        service: SERVICE_NAME,
        pod: POD_NAME,
        release: RELEASE_LABEL,
        workMs,
        next: downstreamData,
      };
    } catch (err: any) {
      outboundRequestsTotal.inc({
        service: SERVICE_NAME,
        target: nextTarget,
        status: 'error',
      });
      reply.status(502);
      return {
        error: 'downstream call error',
        target: nextTarget,
        message: err.message,
      };
    }
  } finally {
    endInflight();
  }
});

// GET /fanout?targets=b,c&ms=N
appServer.get<{ Querystring: { targets?: string; ms?: string } }>('/fanout', async (req, reply) => {
  const endInflight = statsTracker.startRequest();
  try {
    const rawMs = parseInt(req.query.ms || '50', 10);
    const workMs = Math.min(Math.max(1, isNaN(rawMs) ? 50 : rawMs), 1000);

    burnCpu(workMs);

    if (EXTRA_LATENCY_MS > 0) {
      await new Promise((r) => setTimeout(r, EXTRA_LATENCY_MS));
    }

    if (ERROR_RATE > 0 && Math.random() < ERROR_RATE) {
      reply.status(500);
      return { error: 'Internal Server Error (simulated)' };
    }

    const currentHops = parseInt((req.headers['x-hops'] as string) || '0', 10);
    if (currentHops >= MAX_HOPS) {
      reply.status(508);
      return { error: 'loop detected' };
    }

    const targetsRaw = req.query.targets ? req.query.targets.trim() : '';
    if (!targetsRaw) {
      reply.status(400);
      return { error: 'Missing targets' };
    }

    const targetList = targetsRaw.split(',').map((t) => t.trim().toLowerCase()).filter(Boolean);
    if (targetList.length === 0) {
      reply.status(400);
      return { error: 'Missing targets' };
    }

    for (const t of targetList) {
      if (!peerMap.has(t)) {
        reply.status(400);
        return { error: `Unknown target ${t}` };
      }
    }

    if (currentHops + 1 > MAX_HOPS) {
      reply.status(508);
      return { error: 'loop detected' };
    }

    const forwardHeaders = copyForwardHeaders(req.headers as Record<string, any>, currentHops);

    const calls = targetList.map(async (target) => {
      const peerUrl = peerMap.get(target)!;
      const url = `${peerUrl}/work?ms=${workMs}`;
      statsTracker.recordOutbound(target);

      try {
        const res = await fetch(url, {
          headers: forwardHeaders,
          signal: AbortSignal.timeout(PEER_TIMEOUT_MS),
        });

        outboundRequestsTotal.inc({
          service: SERVICE_NAME,
          target,
          status: String(res.status),
        });

        if (!res.ok) {
          return { target, status: res.status, error: await res.text() };
        }
        return await res.json();
      } catch (err: any) {
        outboundRequestsTotal.inc({
          service: SERVICE_NAME,
          target,
          status: 'error',
        });
        return { target, status: 502, error: err.message };
      }
    });

    const results = await Promise.all(calls);
    const hasFailure = results.some((r) => r && r.status && r.status >= 400);
    if (hasFailure) {
      reply.status(502);
    }

    return {
      service: SERVICE_NAME,
      pod: POD_NAME,
      release: RELEASE_LABEL,
      workMs,
      results,
    };
  } finally {
    endInflight();
  }
});

// Port 9090: Admin Server
const adminServer: FastifyInstance = fastify({ logger: false });

// GET /healthz
adminServer.get('/healthz', async () => {
  return { status: 'ok' };
});

// GET /readyz
adminServer.get('/readyz', async (req, reply) => {
  if (isShuttingDown) {
    reply.status(503);
    return { status: 'shutting down' };
  }
  return { status: 'ready' };
});

// GET /metrics
adminServer.get('/metrics', async (req, reply) => {
  reply.header('content-type', registry.contentType);
  return registry.metrics();
});

// GET /stats
adminServer.get('/stats', async () => {
  const allPeers = Array.from(peerMap.keys()).filter((p) => p !== SERVICE_NAME);
  return statsTracker.getStats(SERVICE_NAME, POD_NAME, RELEASE_LABEL, allPeers);
});

// Start Servers
async function start() {
  try {
    await appServer.listen({ port: PORT, host: '0.0.0.0' });
    console.log(`[svc-${SERVICE_NAME}] App server running on port ${PORT}`);

    await adminServer.listen({ port: ADMIN_PORT, host: '0.0.0.0' });
    console.log(`[svc-${SERVICE_NAME}] Admin server running on port ${ADMIN_PORT}`);
  } catch (err) {
    console.error('Failed to start servers:', err);
    process.exit(1);
  }
}

// Graceful Shutdown
async function handleShutdown(signal: string) {
  console.log(`[svc-${SERVICE_NAME}] ${signal} received. Initiating graceful shutdown...`);
  isShuttingDown = true;

  console.log(`[svc-${SERVICE_NAME}] Waiting ${SHUTDOWN_DELAY_MS}ms for endpoints to drain...`);
  await new Promise((r) => setTimeout(r, SHUTDOWN_DELAY_MS));

  try {
    await appServer.close();
    await adminServer.close();
    console.log(`[svc-${SERVICE_NAME}] Servers closed gracefully.`);
    process.exit(0);
  } catch (err) {
    console.error(`[svc-${SERVICE_NAME}] Error during shutdown:`, err);
    process.exit(1);
  }
}

process.on('SIGTERM', () => handleShutdown('SIGTERM'));
process.on('SIGINT', () => handleShutdown('SIGINT'));

start();

