'use client';

import React from 'react';
import { ServiceState } from '../lib/types';
import { LoadDriver } from './LoadDriver';

interface LoadRailProps {
  services: ServiceState[];
  onUpdate?: () => void;
}

export const LoadRail: React.FC<LoadRailProps> = ({ services, onUpdate }) => {
  const anyRunning = services.some((s) => s.load?.running);

  return (
    <aside className="w-full lg:w-80 flex-shrink-0 space-y-4">
      {/* Rail Section Title */}
      <div className="flex items-center justify-between pb-1 border-b border-hairline">
        <div className="flex items-center space-x-2">
          <span className="text-[11px] font-mono font-bold tracking-widest text-muted uppercase">
            01 // LOAD CONTROLS
          </span>
        </div>
        {anyRunning && (
          <span className="text-[10px] font-mono px-1.5 py-0.5 bg-signal-muted text-signal border border-signal/40 font-semibold animate-pulse">
            ACTIVE JOBS
          </span>
        )}
      </div>

      <p className="text-[11px] text-muted font-sans leading-tight">
        Tune VUs and work duration to trigger real-time CPU saturation and observe HPA reactions across the cluster.
      </p>

      {/* Driver Stack */}
      <div className="space-y-3">
        {services.map((svc) => (
          <LoadDriver key={svc.name} service={svc} onUpdate={onUpdate} />
        ))}
      </div>
    </aside>
  );
};
