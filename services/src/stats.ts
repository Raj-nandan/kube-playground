export interface RequestRecord {
  timestamp: number;
  durationMs: number;
  isError: boolean;
}

export interface OutboundRecord {
  timestamp: number;
  target: string;
}

export class StatsTracker {
  private windowMs = 10000;
  private requests: RequestRecord[] = [];
  private outbounds: OutboundRecord[] = [];
  private inflight = 0;

  startRequest(): () => void {
    this.inflight++;
    const start = Date.now();
    return () => {
      this.inflight = Math.max(0, this.inflight - 1);
    };
  }

  recordRequest(durationMs: number, statusCode: number): void {
    const isError = statusCode >= 500;
    this.requests.push({
      timestamp: Date.now(),
      durationMs,
      isError,
    });
  }

  recordOutbound(target: string): void {
    this.outbounds.push({
      timestamp: Date.now(),
      target,
    });
  }

  private prune(): { now: number; windowSec: number } {
    const now = Date.now();
    const cutoff = now - this.windowMs;
    this.requests = this.requests.filter((r) => r.timestamp >= cutoff);
    this.outbounds = this.outbounds.filter((o) => o.timestamp >= cutoff);
    return { now, windowSec: this.windowMs / 1000 };
  }

  getStats(service: string, pod: string, release: string, peers: string[]) {
    const { windowSec } = this.prune();
    const reqCount = this.requests.length;
    const rps = Number((reqCount / windowSec).toFixed(1));

    const errCount = this.requests.filter((r) => r.isError).length;
    const errorsPerSec = Number((errCount / windowSec).toFixed(1));

    let p50Ms = 0;
    let p95Ms = 0;

    if (reqCount > 0) {
      const sorted = this.requests.map((r) => r.durationMs).sort((a, b) => a - b);
      const idx50 = Math.min(Math.floor(reqCount * 0.5), reqCount - 1);
      const idx95 = Math.min(Math.floor(reqCount * 0.95), reqCount - 1);
      p50Ms = Math.round(sorted[idx50] ?? 0);
      p95Ms = Math.round(sorted[idx95] ?? 0);
    }

    const outboundRps: Record<string, number> = {};
    for (const peer of peers) {
      const count = this.outbounds.filter((o) => o.target === peer).length;
      outboundRps[peer] = Number((count / windowSec).toFixed(1));
    }

    return {
      service,
      pod,
      release,
      windowSeconds: windowSec,
      rps,
      errorsPerSec,
      p50Ms,
      p95Ms,
      inflight: this.inflight,
      outboundRps,
    };
  }

  getInflight(): number {
    return this.inflight;
  }
}

