import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import { spawn, ChildProcess } from 'node:child_process';
import path from 'node:path';

describe('Microservice Endpoints Test', () => {
  let procA: ChildProcess;
  let procB: ChildProcess;

  before(async () => {
    // Start service A
    procA = spawn('node', ['dist/index.js'], {
      cwd: path.resolve(__dirname, '..'),
      env: {
        ...process.env,
        SERVICE_NAME: 'a',
        PORT: '18080',
        ADMIN_PORT: '19090',
        RELEASE_LABEL: 'blue',
        PEERS: 'a=http://127.0.0.1:18080,b=http://127.0.0.1:18081',
      },
      stdio: 'pipe',
    });

    // Start service B
    procB = spawn('node', ['dist/index.js'], {
      cwd: path.resolve(__dirname, '..'),
      env: {
        ...process.env,
        SERVICE_NAME: 'b',
        PORT: '18081',
        ADMIN_PORT: '19091',
        RELEASE_LABEL: 'stable',
        PEERS: 'a=http://127.0.0.1:18080,b=http://127.0.0.1:18081',
      },
      stdio: 'pipe',
    });

    procA.stdout?.on('data', (d) => console.log(`[procA stdout] ${d}`));
    procA.stderr?.on('data', (d) => console.error(`[procA stderr] ${d}`));
    procB.stdout?.on('data', (d) => console.log(`[procB stdout] ${d}`));
    procB.stderr?.on('data', (d) => console.error(`[procB stderr] ${d}`));
    let ready = false;
    for (let i = 0; i < 30; i++) {
      try {
        const resA = await fetch('http://127.0.0.1:19090/healthz');
        const resB = await fetch('http://127.0.0.1:19091/healthz');
        if (resA.ok && resB.ok) {
          ready = true;
          break;
        }
      } catch {
        // retry
      }
      await new Promise((r) => setTimeout(r, 200));
    }
    assert.strictEqual(ready, true, 'Services failed to start in time');
  });

  after(() => {
    procA?.kill();
    procB?.kill();
  });

  test('GET /whoami returns correct identity and release', async () => {
    const res = await fetch('http://127.0.0.1:18080/whoami');
    assert.strictEqual(res.status, 200);
    const body = (await res.json()) as any;
    assert.strictEqual(body.service, 'a');
    assert.strictEqual(body.release, 'blue');
    assert.strictEqual(res.headers.get('x-release'), 'blue');
  });

  test('GET /work?ms=30 burns CPU and returns workMs', async () => {
    const start = Date.now();
    const res = await fetch('http://127.0.0.1:18080/work?ms=30');
    const elapsed = Date.now() - start;
    assert.strictEqual(res.status, 200);
    const body = (await res.json()) as any;
    assert.strictEqual(body.service, 'a');
    assert.strictEqual(body.workMs, 30);
    assert.ok(elapsed >= 25, `Expected elapsed >= 25ms, got ${elapsed}ms`);
  });

  test('GET /chain?path=b calls downstream service', async () => {
    const res = await fetch('http://127.0.0.1:18080/chain?path=b&ms=20');
    assert.strictEqual(res.status, 200);
    const body = (await res.json()) as any;
    assert.strictEqual(body.service, 'a');
    assert.ok(body.next, 'Expected downstream next response');
    assert.strictEqual(body.next.service, 'b');
    assert.strictEqual(body.next.release, 'stable');
  });

  test('Loop rejection: x-hops >= MAX_HOPS returns 508', async () => {
    const res = await fetch('http://127.0.0.1:18080/chain?path=b', {
      headers: { 'x-hops': '5' },
    });
    assert.strictEqual(res.status, 508);
    const body = (await res.json()) as any;
    assert.strictEqual(body.error, 'loop detected');
  });

  test('GET /healthz and /readyz return 200', async () => {
    const health = await fetch('http://127.0.0.1:19090/healthz');
    assert.strictEqual(health.status, 200);

    const ready = await fetch('http://127.0.0.1:19090/readyz');
    assert.strictEqual(ready.status, 200);
  });

  test('GET /metrics returns prometheus text format', async () => {
    const res = await fetch('http://127.0.0.1:19090/metrics');
    assert.strictEqual(res.status, 200);
    const text = await res.text();
    assert.ok(text.includes('http_requests_total'));
  });

  test('GET /stats returns rolling window stats with RPS', async () => {
    const res = await fetch('http://127.0.0.1:19090/stats');
    assert.strictEqual(res.status, 200);
    const stats = (await res.json()) as any;
    assert.strictEqual(stats.service, 'a');
    assert.strictEqual(stats.release, 'blue');
    assert.strictEqual(stats.windowSeconds, 10);
    assert.ok(typeof stats.rps === 'number');
  });
});
