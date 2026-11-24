'use client';

import React from 'react';
import { ServiceState } from '../lib/types';
import { PodCard } from './PodCard';
import { Layers, Activity, Clock, ShieldAlert } from 'lucide-react';

interface ServiceLaneProps {
  service: ServiceState;
}

export const ServiceLane: React.FC<ServiceLaneProps> = ({ service }) => {
  const currentReplicas = service.hpa?.current ?? service.pods.length;
  const desiredReplicas = service.hpa?.desired ?? currentReplicas;
  const isScaling = currentReplicas !== desiredReplicas;

  return (
    <div className="bg-[#161b22] border border-[#30363d] rounded-xl p-5 shadow-sm">
      {/* Service Header & Stats Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-[#21262d] mb-4">
        {/* Service Name & Scaling Indicator */}
        <div className="flex items-center space-x-3">
          <div className="w-9 h-9 rounded-lg bg-blue-600/20 text-blue-400 font-bold flex items-center justify-center text-sm border border-blue-500/30">
            {service.name.toUpperCase()}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-white tracking-tight">
                Service: svc-{service.name}
              </h2>
              {isScaling && (
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-900/40 text-amber-300 border border-amber-700/50 animate-pulse">
                  Scaling ({currentReplicas} → {desiredReplicas})
                </span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2 mt-0.5">
              <p className="text-xs text-gray-400 font-mono">
                Strategy: {service.name === 'a' ? 'Blue-Green' : service.name === 'b' ? 'Canary' : 'RollingUpdate'}
              </p>
              {service.traffic && service.traffic.length > 0 && (
                <div className="flex items-center gap-1.5 ml-1">
                  {service.traffic.map((t, idx) => (
                    <span
                      key={idx}
                      className="text-[10px] font-mono px-1.5 py-0.5 rounded border border-cyan-800/60 bg-cyan-950/40 text-cyan-300 font-semibold"
                    >
                      {t.release}: {t.weight}%
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* HPA & Performance Metrics Pill Row */}
        <div className="flex flex-wrap items-center gap-3 text-xs">
          {/* Replicas Metric */}
          <div className="bg-[#0d1117] px-3 py-1.5 rounded-md border border-[#30363d] flex items-center gap-2">
            <Layers className="w-3.5 h-3.5 text-blue-400" />
            <span className="text-gray-400">Replicas:</span>
            <span className="font-mono font-bold text-white">
              {currentReplicas} / {desiredReplicas}{' '}
              <span className="text-gray-500 text-[10px]">
                ({service.hpa.min}-{service.hpa.max})
              </span>
            </span>
          </div>

          {/* Average CPU vs Target Metric */}
          <div className="bg-[#0d1117] px-3 py-1.5 rounded-md border border-[#30363d] flex items-center gap-2">
            <Activity className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-gray-400">Avg CPU:</span>
            <span
              className={`font-mono font-bold ${
                service.hpa.avgCpuPct >= 50 ? 'text-amber-400' : 'text-emerald-400'
              }`}
            >
              {service.hpa.avgCpuPct}%{' '}
              <span className="text-gray-500 text-[10px]">(target: {service.hpa.targetCpuPct}%)</span>
            </span>
          </div>

          {/* RPS */}
          <div className="bg-[#0d1117] px-3 py-1.5 rounded-md border border-[#30363d] flex items-center gap-2">
            <span className="text-yellow-400 font-bold">⚡</span>
            <span className="text-gray-400">RPS:</span>
            <span className="font-mono font-bold text-white">{service.rps.toFixed(1)}</span>
          </div>

          {/* p95 Latency */}
          <div className="bg-[#0d1117] px-3 py-1.5 rounded-md border border-[#30363d] flex items-center gap-2">
            <Clock className="w-3.5 h-3.5 text-purple-400" />
            <span className="text-gray-400">p95:</span>
            <span className="font-mono font-bold text-white">{service.p95Ms} ms</span>
          </div>

          {/* Errors */}
          {service.errorsPerSec > 0 && (
            <div className="bg-rose-950/40 px-3 py-1.5 rounded-md border border-rose-800/60 flex items-center gap-2 text-rose-300">
              <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
              <span>Errors:</span>
              <span className="font-mono font-bold">{service.errorsPerSec.toFixed(1)}/s</span>
            </div>
          )}
        </div>
      </div>

      {/* Pods Grid */}
      <div>
        <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
          Running Pods ({service.pods.length})
        </h4>

        {service.pods.length === 0 ? (
          <div className="text-center py-8 text-gray-500 text-xs bg-[#0d1117] rounded-lg border border-dashed border-[#30363d]">
            No active pods for svc-{service.name}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {service.pods.map((pod) => (
              <PodCard key={pod.name} pod={pod} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

