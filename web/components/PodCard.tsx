'use client';

import React from 'react';
import { PodState } from '../lib/types';
import { Cpu, Zap, RotateCw } from 'lucide-react';

interface PodCardProps {
  pod: PodState;
}

export const PodCard: React.FC<PodCardProps> = ({ pod }) => {
  // Determine state colors
  let stateBadgeColor = 'bg-blue-900/40 text-blue-300 border-blue-700/50';
  if (pod.state === 'Ready') {
    stateBadgeColor = 'bg-emerald-900/40 text-emerald-300 border-emerald-700/50';
  } else if (pod.state === 'Terminating') {
    stateBadgeColor = 'bg-orange-900/40 text-orange-300 border-orange-700/50 animate-pulse';
  } else if (pod.state === 'Pending') {
    stateBadgeColor = 'bg-yellow-900/40 text-yellow-300 border-yellow-700/50';
  } else if (['CrashLoop', 'OOMKilled', 'ImagePullError'].includes(pod.state)) {
    stateBadgeColor = 'bg-rose-900/40 text-rose-300 border-rose-700/50';
  }

  // Release badge color
  let releaseBadgeColor = 'bg-purple-900/40 text-purple-300 border-purple-700/50';
  if (pod.release === 'blue') releaseBadgeColor = 'bg-blue-900/50 text-blue-300 border-blue-700';
  if (pod.release === 'green') releaseBadgeColor = 'bg-emerald-900/50 text-emerald-300 border-emerald-700';
  if (pod.release === 'canary') releaseBadgeColor = 'bg-amber-900/50 text-amber-300 border-amber-700';
  if (pod.release === 'stable') releaseBadgeColor = 'bg-indigo-900/50 text-indigo-300 border-indigo-700';

  // CPU calculation (target is 50m out of 100m request, 250m limit)
  const cpuPercentOfRequest = Math.round((pod.cpuMilli / pod.cpuRequestMilli) * 100);
  const cpuBarWidth = Math.min(100, Math.round((pod.cpuMilli / 250) * 100));

  return (
    <div
      className={`rounded-lg border p-3 bg-[#0d1117] transition-all duration-300 ${
        pod.state === 'Terminating'
          ? 'border-orange-600/40 opacity-75'
          : 'border-[#30363d] hover:border-gray-500'
      }`}
    >
      {/* Top line: Name & Status */}
      <div className="flex items-center justify-between gap-2 mb-2">
        <span
          className="text-xs font-mono font-semibold text-gray-200 truncate max-w-[170px]"
          title={pod.name}
        >
          {pod.name}
        </span>
        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${stateBadgeColor}`}>
          {pod.state}
        </span>
      </div>

      {/* Badges: Release, Track, Containers */}
      <div className="flex flex-wrap items-center gap-1.5 mb-2.5">
        <span className={`text-[10px] px-1.5 py-0.5 rounded border font-mono ${releaseBadgeColor}`}>
          v:{pod.release}
        </span>
        <span className="text-[10px] px-1.5 py-0.5 rounded border border-[#30363d] bg-[#161b22] text-gray-400 font-mono">
          track:{pod.track}
        </span>
        <span
          className="text-[10px] px-1.5 py-0.5 rounded border border-cyan-800/50 bg-cyan-950/40 text-cyan-300 font-mono"
          title="Containers Ready / Total"
        >
          {pod.containers.filter((c) => c.ready).length}/{pod.containers.length}
        </span>
        {pod.restarts > 0 && (
          <span className="text-[10px] px-1.5 py-0.5 rounded border border-rose-800 bg-rose-950/60 text-rose-300 flex items-center gap-0.5">
            <RotateCw className="w-2.5 h-2.5" />
            {pod.restarts}
          </span>
        )}
      </div>

      {/* CPU Progress Bar with 50% target tick */}
      <div className="mb-2">
        <div className="flex items-center justify-between text-[11px] text-gray-400 mb-1">
          <span className="flex items-center gap-1">
            <Cpu className="w-3 h-3 text-cyan-400" />
            CPU Usage
          </span>
          <span className="font-mono text-gray-300 font-medium">
            {pod.cpuMilli}m / {pod.cpuRequestMilli}m ({cpuPercentOfRequest}%)
          </span>
        </div>
        <div className="relative w-full h-2 bg-[#21262d] rounded-full overflow-hidden">
          {/* Target 50% marker */}
          <div
            className="absolute top-0 bottom-0 w-[2px] bg-yellow-400 z-10"
            style={{ left: '20%' }} // 50m / 250m = 20% of limit bar
            title="HPA Target: 50% of request (50m)"
          />
          <div
            className={`h-full transition-all duration-500 rounded-full ${
              cpuPercentOfRequest >= 50
                ? 'bg-gradient-to-r from-emerald-500 to-rose-500'
                : 'bg-emerald-500'
            }`}
            style={{ width: `${cpuBarWidth}%` }}
          />
        </div>
      </div>

      {/* Bottom metrics: RPS & Inflight */}
      <div className="flex items-center justify-between text-[11px] text-gray-400 pt-1 border-t border-[#21262d]">
        <div className="flex items-center gap-1">
          <Zap className="w-3 h-3 text-yellow-400" />
          <span>RPS:</span>
          <span className="font-mono text-white font-medium">{pod.rps.toFixed(1)}</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-gray-500">Inflight:</span>
          <span className="font-mono text-cyan-300 font-medium">{pod.inflight}</span>
        </div>
      </div>
    </div>
  );
};

