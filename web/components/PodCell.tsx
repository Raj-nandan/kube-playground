'use client';

import React from 'react';
import { PodState } from '../lib/types';
import { RotateCw } from 'lucide-react';

interface PodCellProps {
  pod: PodState;
}

function formatAge(startedAt: string): string {
  if (!startedAt) return '—';
  const start = new Date(startedAt).getTime();
  if (isNaN(start)) return '—';
  const diffSec = Math.max(0, Math.floor((Date.now() - start) / 1000));
  if (diffSec < 60) return `${diffSec}s`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ${diffMin % 60}m`;
  return `${Math.floor(diffHours / 24)}d`;
}

export const PodCell: React.FC<PodCellProps> = ({ pod }) => {
  // Extract short suffix (e.g., svc-a-blue-84555fc655-cgzsf -> …cgzsf)
  const parts = pod.name.split('-');
  const suffix = parts.length > 1 ? `…${parts[parts.length - 1]}` : pod.name;

  // Background and border styles mapped by state:
  // Ready: light shade of green
  // Running: light shade of blue
  // Terminating: light shade of red
  // Pending: light shade of amber
  // Failed/CrashLoop: light shade of red
  let cellBg = 'bg-surface border-hairline hover:border-ink/40';
  let stateSymbol = '●';
  let stateBadgeStyle = 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border-emerald-600/30';
  let isTerminating = false;

  switch (pod.state) {
    case 'Ready':
      stateSymbol = '●';
      cellBg = 'bg-emerald-500/[0.07] dark:bg-emerald-950/25 border-emerald-600/25 dark:border-emerald-800/40 hover:border-emerald-600/50';
      stateBadgeStyle = 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border-emerald-600/40';
      break;
    case 'Running':
      stateSymbol = '◐';
      cellBg = 'bg-blue-500/[0.07] dark:bg-blue-950/25 border-blue-600/25 dark:border-blue-800/40 hover:border-blue-600/50';
      stateBadgeStyle = 'bg-blue-500/15 text-blue-800 dark:text-blue-300 border-blue-600/40';
      break;
    case 'Pending':
      stateSymbol = '◒';
      cellBg = 'bg-amber-500/[0.07] dark:bg-amber-950/25 border-amber-600/25 dark:border-amber-800/40 hover:border-amber-600/50';
      stateBadgeStyle = 'bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-600/40 animate-pulse';
      break;
    case 'Terminating':
      stateSymbol = '▨';
      cellBg = 'bg-rose-500/[0.09] dark:bg-rose-950/30 border-rose-600/35 dark:border-rose-700/50 pattern-hatched opacity-85 border-dashed';
      stateBadgeStyle = 'bg-rose-500/15 text-rose-800 dark:text-rose-300 border-rose-600/40';
      isTerminating = true;
      break;
    case 'CrashLoop':
    case 'OOMKilled':
    case 'ImagePullError':
    default:
      stateSymbol = '✖';
      cellBg = 'bg-red-500/[0.12] dark:bg-red-950/40 border-red-600/40 dark:border-red-700/60 hover:border-red-600/70';
      stateBadgeStyle = 'bg-red-500/20 text-red-800 dark:text-red-300 border-red-600/50 font-semibold';
      break;
  }

  // CPU calculation relative to 250m max limit scale
  const limitScaleMilli = Math.max(250, pod.cpuRequestMilli * 2.5, pod.cpuMilli || 0);
  const cpuPercentOfRequest = Math.round((pod.cpuMilli / (pod.cpuRequestMilli || 1)) * 100);
  const cpuBarWidthPct = Math.min(100, Math.round((pod.cpuMilli / limitScaleMilli) * 100));
  const targetTickPct = Math.round(((pod.cpuRequestMilli * 0.5) / limitScaleMilli) * 100);

  const isOverTarget = cpuPercentOfRequest >= 50;

  return (
    <div
      className={`border p-2.5 rounded-sm transition-all duration-200 text-ink text-xs ${cellBg}`}
    >
      {/* Top row: Pod short suffix + Age + State Indicator */}
      <div className="flex items-center justify-between gap-1.5 pb-2 mb-2 border-b border-hairline/60">
        <div className="flex items-center gap-1.5 min-w-0">
          <span
            className="font-mono font-medium text-xs tracking-tight text-ink hover:underline cursor-help truncate"
            title={`Full Pod Name: ${pod.name}`}
          >
            {suffix}
          </span>
          <span
            className="font-mono text-[10px] text-muted shrink-0"
            title={`Started at ${pod.startedAt || 'unknown'}`}
          >
            {formatAge(pod.startedAt)}
          </span>
        </div>

        {/* State shape badge */}
        <span
          className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-[2px] border text-[10px] font-mono shrink-0 uppercase tracking-wider ${stateBadgeStyle}`}
          title={`Pod Phase: ${pod.phase} | State: ${pod.state}`}
        >
          <span className="text-[9px] leading-none">{stateSymbol}</span>
          <span>{pod.state}</span>
        </span>
      </div>

      {/* Tags row: Release, Track, Containers, Restarts */}
      <div className="flex flex-wrap items-center gap-1 mb-2 font-mono text-[10px]">
        {/* Release tag */}
        <span
          className="px-1.5 py-0.5 rounded-[2px] bg-paper border border-hairline text-ink font-semibold"
          title={`Release: ${pod.release}`}
        >
          {pod.release}
        </span>

        {/* Track tag */}
        <span
          className="px-1.5 py-0.5 rounded-[2px] bg-paper border border-hairline text-muted"
          title={`Track: ${pod.track}`}
        >
          {pod.track}
        </span>

        {/* Dual container chips (app, istio-proxy) */}
        {pod.containers && pod.containers.length > 0 ? (
          pod.containers.map((c) => (
            <span
              key={c.name}
              className={`px-1 py-0.5 rounded-[2px] border text-[9px] ${
                c.ready
                  ? 'border-emerald-600/35 text-emerald-800 dark:text-emerald-300 bg-emerald-500/10'
                  : 'border-rose-600/40 text-rose-800 dark:text-rose-300 bg-rose-500/10'
              }`}
              title={`Container ${c.name}: ${c.ready ? 'Ready' : 'Not Ready'}`}
            >
              {c.name === 'istio-proxy' ? 'mesh' : c.name} {c.ready ? '✓' : '✗'}
            </span>
          ))
        ) : (
          <span className="px-1 py-0.5 rounded-[2px] border border-hairline text-[9px] text-muted">
            0/0
          </span>
        )}

        {/* Restarts badge */}
        <span
          className={`ml-auto px-1.5 py-0.5 rounded-[2px] border flex items-center gap-0.5 cursor-help ${
            pod.restarts > 0
              ? 'border-red-600/40 bg-red-500/10 text-red-700 dark:text-red-300 font-semibold'
              : 'border-hairline text-muted bg-paper'
          }`}
          title={`Restart Count: ${pod.restarts} ${
            pod.restarts > 0 ? '(Pod has restarted during cluster lifecycle)' : '(No restarts)'
          }`}
        >
          <RotateCw className="w-2.5 h-2.5" />
          <span>{pod.restarts}</span>
        </span>
      </div>

      {/* CPU Meter Bar */}
      <div className="mb-2">
        <div className="flex items-center justify-between text-[10px] font-mono text-muted mb-1">
          <span>CPU</span>
          <span className="text-ink font-medium">
            {pod.cpuMilli}m / {pod.cpuRequestMilli}m{' '}
            <span className={isOverTarget ? 'text-signal font-semibold' : 'text-muted'}>
              ({cpuPercentOfRequest}%)
            </span>
          </span>
        </div>
        <div
          className="relative w-full h-1.5 bg-hairline rounded-[1px] overflow-hidden cursor-help"
          title={`Target: 50% of request (${Math.round(pod.cpuRequestMilli * 0.5)}m) | Limit Scale: ${limitScaleMilli}m`}
        >
          {/* Target 50% marker */}
          <div
            className="absolute top-0 bottom-0 w-[2px] bg-ink z-10"
            style={{ left: `${targetTickPct}%` }}
          />
          {/* Filled CPU usage */}
          <div
            className={`h-full transition-all duration-300 ${
              isOverTarget ? 'bg-signal' : 'bg-ink/70'
            }`}
            style={{ width: `${cpuBarWidthPct}%` }}
          />
        </div>
      </div>

      {/* Bottom readouts: RPS & Inflight (Mono Tabular) */}
      <div className="flex items-center justify-between pt-1.5 border-t border-hairline/60 font-mono text-[10px]">
        <div className="flex items-center gap-1">
          <span className="text-muted">RPS</span>
          <span className="font-semibold text-ink">{pod.rps.toFixed(1)}</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-muted">INFLIGHT</span>
          <span className="font-semibold text-ink">{pod.inflight}</span>
        </div>
      </div>
    </div>
  );
};

export const PodStateLegend: React.FC = () => {
  return (
    <div className="flex flex-wrap items-center gap-3 text-[10px] font-mono text-muted py-1 border-t border-hairline/60 mt-3">
      <span className="uppercase text-[9px] tracking-wider text-muted font-sans font-semibold">
        Legend:
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="inline-block w-2.5 h-2.5 rounded-[1px] bg-emerald-500/20 border border-emerald-600/40" />
        <span className="text-emerald-800 dark:text-emerald-300 font-medium">Ready</span>
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="inline-block w-2.5 h-2.5 rounded-[1px] bg-blue-500/20 border border-blue-600/40" />
        <span className="text-blue-800 dark:text-blue-300 font-medium">Running</span>
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="inline-block w-2.5 h-2.5 rounded-[1px] bg-amber-500/20 border border-amber-600/40" />
        <span className="text-amber-800 dark:text-amber-300 font-medium">Pending</span>
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="inline-block w-2.5 h-2.5 rounded-[1px] bg-rose-500/20 border border-rose-600/40 pattern-hatched" />
        <span className="text-rose-800 dark:text-rose-300 font-medium">Terminating</span>
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="inline-block w-2.5 h-2.5 rounded-[1px] bg-red-600/25 border border-red-600/50" />
        <span className="text-red-800 dark:text-red-300 font-medium">Failed</span>
      </span>
      <span className="inline-flex items-center gap-1 ml-auto text-ink">
        <span className="inline-block w-2 h-2 bg-ink/80 rounded-none mr-0.5" /> 50% Target Tick
      </span>
    </div>
  );
};
