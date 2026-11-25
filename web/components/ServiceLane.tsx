'use client';

import React from 'react';
import { ServiceState } from '../lib/types';
import { PodCell, PodStateLegend } from './PodCell';
import { TrendChart } from './TrendChart';
import { Layers, Activity, ArrowUpRight, ArrowDownRight, Clock } from 'lucide-react';

interface ServiceLaneProps {
  service: ServiceState;
}

export const ServiceLane: React.FC<ServiceLaneProps> = ({ service }) => {
  const currentReplicas = service.hpa?.current ?? service.pods.length;
  const desiredReplicas = service.hpa?.desired ?? currentReplicas;
  const minReplicas = service.hpa?.min ?? 1;
  const maxReplicas = service.hpa?.max ?? 5;
  const totalPods = service.pods.length;

  // Breakdown pods by track to resolve "svc-a says Replicas 1/1 while running 2 pods"
  const trackCounts: Record<string, number> = {};
  for (const pod of service.pods) {
    const track = pod.track || 'default';
    trackCounts[track] = (trackCounts[track] || 0) + 1;
  }
  const trackEntries = Object.entries(trackCounts);

  // Strategy naming
  const strategyName =
    service.name === 'a'
      ? 'Blue-Green'
      : service.name === 'b'
      ? 'Canary'
      : 'RollingUpdate';

  // HPA Status determination
  let hpaStatus: 'Idle' | 'Scaling up' | 'Scaling down' | 'Stabilizing' = 'Idle';
  if (desiredReplicas > currentReplicas) {
    hpaStatus = 'Scaling up';
  } else if (desiredReplicas < currentReplicas) {
    hpaStatus = 'Scaling down';
  } else if (service.rps > 0 && Math.abs(service.hpa.avgCpuPct - service.hpa.targetCpuPct) <= 10) {
    hpaStatus = 'Stabilizing';
  }

  // CPU sample age from pods
  let latestCpuSampleAt: number | null = null;
  for (const p of service.pods) {
    if (p.cpuSampledAt) {
      const t = new Date(p.cpuSampledAt).getTime();
      if (!isNaN(t) && (!latestCpuSampleAt || t > latestCpuSampleAt)) {
        latestCpuSampleAt = t;
      }
    }
  }
  const cpuAgeSec = latestCpuSampleAt
    ? Math.max(0, Math.floor((Date.now() - latestCpuSampleAt) / 1000))
    : 15;

  // ReplicaSlots: Segmented bar with one slot per allowed replica up to max
  const slotCount = Math.max(maxReplicas, totalPods);
  const slots = Array.from({ length: slotCount }, (_, idx) => {
    const pod = service.pods[idx];
    const isDesired = idx < desiredReplicas;
    return { idx, pod, isDesired };
  });

  // Rollout readiness
  const readyPods = service.pods.filter((p) => p.state === 'Ready').length;
  const isProgressing = service.pods.some((p) => p.state === 'Pending' || p.state === 'Terminating');

  return (
    <div className="border border-hairline bg-surface p-4 rounded-sm text-ink space-y-4">
      {/* 1. Lane Header & Top Controls */}
      <div className="flex flex-wrap items-start justify-between gap-4 pb-3 border-b border-hairline/70">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <span className="font-mono text-xs uppercase px-1.5 py-0.5 rounded-[2px] bg-paper border border-hairline font-bold text-muted">
              SVC-{service.name.toUpperCase()}
            </span>
            <h2 className="font-display font-bold text-2xl tracking-tight text-ink">
              svc-{service.name}
            </h2>
            <span
              className="text-[11px] font-mono px-2 py-0.5 rounded-[2px] bg-paper border border-hairline text-muted uppercase tracking-wider"
              title="Deployment Rollout Strategy"
            >
              {strategyName}
            </span>

            {/* Scaling Activity Badge */}
            {hpaStatus !== 'Idle' && (
              <span
                className={`inline-flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded-[2px] border uppercase tracking-wider ${
                  hpaStatus === 'Scaling up'
                    ? 'border-signal bg-signal/10 text-signal font-semibold'
                    : hpaStatus === 'Scaling down'
                    ? 'border-state-pending/40 bg-state-pending/10 text-state-pending'
                    : 'border-hairline bg-paper text-ink'
                }`}
              >
                {hpaStatus === 'Scaling up' && <ArrowUpRight className="w-3 h-3" />}
                {hpaStatus === 'Scaling down' && <ArrowDownRight className="w-3 h-3" />}
                <span>
                  {hpaStatus} ({currentReplicas} → {desiredReplicas})
                </span>
              </span>
            )}
          </div>

          {/* Track Breakdown (Solves multi-track count ambiguity) */}
          <div className="flex flex-wrap items-center gap-2 text-xs font-mono text-muted">
            <span>TRACKS:</span>
            {trackEntries.length > 0 ? (
              trackEntries.map(([track, count]) => (
                <span
                  key={track}
                  className="px-1.5 py-0.2 rounded-[2px] bg-paper border border-hairline text-ink font-semibold"
                >
                  {track}: {count} {count === 1 ? 'pod' : 'pods'}
                </span>
              ))
            ) : (
              <span>0 active pods</span>
            )}
            <span className="text-muted/60">•</span>
            <span>TOTAL RUNNING: {totalPods}</span>
          </div>
        </div>

        {/* Large Replicas Readout & Capacity Bar */}
        <div className="flex flex-col items-end gap-1">
          <div className="flex items-baseline gap-2">
            <span className="text-[11px] font-mono text-muted uppercase">REPLICAS</span>
            <span
              className="text-3xl font-mono font-bold tracking-tight text-ink tabular-nums"
              title={`HPA Current: ${currentReplicas} | Desired: ${desiredReplicas} | Actual Pods: ${totalPods}`}
            >
              {totalPods}
            </span>
            <span className="font-mono text-xs text-muted">/ max {maxReplicas}</span>
          </div>

          {/* ReplicaSlots segmented capacity bar */}
          <div className="flex items-center gap-1" title={`Capacity: ${totalPods} active of max ${maxReplicas} allowed`}>
            {slots.map(({ idx, pod, isDesired }) => {
              let slotClass = 'bg-transparent border-hairline';
              if (pod) {
                if (pod.state === 'Ready') slotClass = 'bg-state-ready border-state-ready';
                else if (pod.state === 'Pending') slotClass = 'bg-state-pending border-state-pending';
                else if (pod.state === 'Terminating') slotClass = 'pattern-hatched border-state-terminating';
                else slotClass = 'bg-state-failed border-state-failed';
              }
              return (
                <div
                  key={idx}
                  className={`w-4 h-2.5 rounded-[1px] border transition-all ${slotClass} ${
                    idx === desiredReplicas - 1 ? 'ring-1 ring-ink' : ''
                  }`}
                  title={
                    pod
                      ? `Slot ${idx + 1}: ${pod.name} (${pod.state})`
                      : `Slot ${idx + 1}: Free capacity ${isDesired ? '(HPA Desired Target)' : ''}`
                  }
                />
              );
            })}
          </div>
        </div>
      </div>

      {/* 2. Middle Row: HPA Panel & TrendChart & TrafficSplit */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
        {/* HPA Instrument Panel (4 cols) */}
        <div className="lg:col-span-4 border border-hairline bg-paper p-3 rounded-sm space-y-2">
          <div className="flex items-center justify-between pb-1.5 border-b border-hairline/60">
            <span className="text-[10px] font-mono uppercase tracking-wider text-muted font-sans font-semibold flex items-center gap-1.5">
              <Layers className="w-3 h-3 text-ink/70" />
              HPA Controller
            </span>
            <span
              className={`text-[9px] font-mono px-1.5 py-0.5 rounded-[2px] uppercase ${
                hpaStatus === 'Scaling up'
                  ? 'bg-signal/15 text-signal font-bold'
                  : 'bg-hairline text-ink'
              }`}
            >
              {hpaStatus}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs font-mono">
            <div>
              <div className="text-[10px] text-muted uppercase">Target CPU</div>
              <div className="text-ink font-semibold tabular-nums">{service.hpa.targetCpuPct}%</div>
            </div>
            <div>
              <div className="text-[10px] text-muted uppercase">Average CPU</div>
              <div
                className={`font-semibold tabular-nums ${
                  service.hpa.avgCpuPct >= service.hpa.targetCpuPct ? 'text-signal' : 'text-ink'
                }`}
              >
                {service.hpa.avgCpuPct}%
              </div>
            </div>
            <div>
              <div className="text-[10px] text-muted uppercase">HPA Replicas</div>
              <div className="text-ink font-semibold tabular-nums">
                {currentReplicas} <span className="text-muted font-normal">cur</span> / {desiredReplicas}{' '}
                <span className="text-muted font-normal">des</span>
              </div>
            </div>
            <div>
              <div className="text-[10px] text-muted uppercase">Min / Max Range</div>
              <div className="text-ink font-semibold tabular-nums">
                {minReplicas} – {maxReplicas}
              </div>
            </div>
          </div>

          {/* Rollout Strip (Read-only Deployment Status) */}
          <div className="pt-2 border-t border-hairline/60 text-[10px] font-mono text-muted space-y-1">
            <div className="flex items-center justify-between">
              <span>ROLLOUT:</span>
              <span
                className={`px-1 py-0.2 rounded-[2px] border ${
                  isProgressing
                    ? 'border-signal/50 bg-signal/10 text-signal font-semibold'
                    : 'border-state-ready/40 text-state-ready bg-state-ready/5'
                }`}
              >
                {isProgressing ? 'PROGRESSING' : 'STABLE'}
              </span>
            </div>
            {/* TODO: backend deployment status fields (revision, unavailable) */}
            <div className="flex items-center justify-between text-[9px] text-muted/80">
              <span>Ready / Available:</span>
              <span className="text-ink tabular-nums">
                {readyPods} / {totalPods}
              </span>
            </div>
          </div>
        </div>

        {/* 3-Minute TrendChart (5 cols) */}
        <div className="lg:col-span-5">
          <TrendChart
            currentReplicas={totalPods}
            avgCpuPct={service.hpa.avgCpuPct}
            targetCpuPct={service.hpa.targetCpuPct}
            maxReplicas={maxReplicas}
          />
        </div>

        {/* TrafficSplit Bar & Metrics Readout (3 cols) */}
        <div className="lg:col-span-3 border border-hairline bg-paper p-3 rounded-sm flex flex-col justify-between">
          <div className="space-y-2">
            <div className="text-[10px] font-mono uppercase tracking-wider text-muted font-sans font-semibold pb-1 border-b border-hairline/60 flex items-center justify-between">
              <span>Traffic & Throughput</span>
              <span className="font-mono text-[9px] text-ink font-semibold">
                {service.rps.toFixed(1)} RPS
              </span>
            </div>

            {/* Traffic Split Weight Bar (Istio VirtualService Weights) */}
            {service.traffic && service.traffic.length > 0 ? (
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[10px] font-mono">
                  <span className="text-muted">MESH WEIGHTS</span>
                  <div className="flex gap-1.5">
                    {service.traffic.map((t, idx) => (
                      <span key={idx} className="font-semibold text-ink">
                        {t.release}: {t.weight}%
                      </span>
                    ))}
                  </div>
                </div>
                {/* Visual segmented weight bar */}
                <div className="w-full h-2 bg-hairline rounded-[1px] flex overflow-hidden">
                  {service.traffic.map((t, idx) => {
                    const isFirst = idx === 0;
                    return (
                      <div
                        key={idx}
                        className={`h-full transition-all duration-300 ${
                          isFirst ? 'bg-ink' : 'bg-signal'
                        }`}
                        style={{ width: `${t.weight}%` }}
                        title={`${t.release}: ${t.weight}%`}
                      />
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="text-[10px] font-mono text-muted italic">
                Direct single track routing
              </div>
            )}
          </div>

          {/* Performance chips: p95, errors */}
          <div className="pt-2 border-t border-hairline/60 grid grid-cols-2 gap-1 text-[10px] font-mono">
            <div>
              <span className="text-muted">P95 LATENCY</span>
              <div className="text-ink font-semibold tabular-nums">{service.p95Ms} ms</div>
            </div>
            <div>
              <span className="text-muted">ERROR RATE</span>
              <div
                className={`font-semibold tabular-nums ${
                  service.errorsPerSec > 0 ? 'text-state-failed' : 'text-ink'
                }`}
              >
                {service.errorsPerSec.toFixed(1)} /s
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 3. MetricsRow: Sample age notice */}
      <div className="flex flex-wrap items-center justify-between text-[10px] font-mono text-muted px-1">
        <div className="flex items-center gap-1.5">
          <Clock className="w-3 h-3 text-muted/70" />
          <span>
            CPU sampled ~{cpuAgeSec}s ago{' '}
            <span className="text-muted/70">(metrics-server polling lag ~15s)</span>
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span>HPA SAMPLING INTERVAL: 15s</span>
          <span>SCALE DOWN STABILIZATION: 300s</span>
        </div>
      </div>

      {/* 4. Active Pods Grid */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-[11px] font-mono uppercase tracking-wider text-muted font-sans font-semibold">
            Active Pods ({totalPods})
          </h3>
          <span className="text-[10px] font-mono text-muted">
            Target CPU: 50m / 100m req
          </span>
        </div>

        {totalPods === 0 ? (
          <div className="text-center py-6 text-muted text-xs bg-paper border border-dashed border-hairline rounded-sm font-mono">
            No active pods currently running for svc-{service.name}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-2.5">
            {service.pods.map((pod) => (
              <PodCell key={pod.name} pod={pod} />
            ))}
          </div>
        )}

        {/* Legend */}
        <PodStateLegend />
      </div>
    </div>
  );
};
