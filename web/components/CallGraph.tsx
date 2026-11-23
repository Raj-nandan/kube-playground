'use client';

import React from 'react';
import { CallGraphEdge } from '../lib/types';
import { ArrowRight, Network } from 'lucide-react';

interface CallGraphProps {
  edges: CallGraphEdge[];
}

export const CallGraph: React.FC<CallGraphProps> = ({ edges }) => {
  const services = ['a', 'b', 'c'];

  return (
    <div className="bg-[#161b22] border border-[#30363d] rounded-xl p-4 shadow-sm">
      <div className="flex items-center space-x-2 mb-3">
        <Network className="w-4 h-4 text-cyan-400" />
        <h3 className="font-bold text-white text-sm">Inter-Service Call Graph & Traffic Rates</h3>
      </div>

      <div className="flex flex-wrap items-center justify-around gap-4 bg-[#0d1117] p-4 rounded-lg border border-[#30363d]">
        {services.map((svc) => (
          <div key={svc} className="flex items-center space-x-3">
            <div className="flex items-center space-x-2 bg-[#161b22] px-4 py-2 rounded-lg border border-[#30363d] shadow-sm">
              <span className="w-5 h-5 rounded bg-blue-600/30 text-blue-300 font-bold text-xs flex items-center justify-center">
                {svc.toUpperCase()}
              </span>
              <span className="font-mono text-xs font-semibold text-white">svc-{svc}</span>
            </div>

            {/* Render any edges going out from this service */}
            {edges
              .filter((e) => e.from === svc)
              .map((edge) => (
                <div
                  key={`${edge.from}->${edge.to}`}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-cyan-950/40 border border-cyan-800/50 text-[11px] text-cyan-300 animate-pulse font-mono"
                >
                  <ArrowRight className="w-3 h-3 text-cyan-400" />
                  <span>→ svc-{edge.to}:</span>
                  <span className="font-bold text-white">{edge.rps} rps</span>
                </div>
              ))}
          </div>
        ))}

        {edges.length === 0 && (
          <span className="text-xs text-gray-500 italic">
            No inter-service chained or fanout calls currently active.
          </span>
        )}
      </div>
    </div>
  );
};

