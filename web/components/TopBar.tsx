'use client';

import React from 'react';
import { Activity, Server, Box, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Totals } from '../lib/types';

interface TopBarProps {
  connected: boolean;
  totals?: Totals;
  lastUpdated?: Date | null;
}

export const TopBar: React.FC<TopBarProps> = ({ connected, totals, lastUpdated }) => {
  return (
    <header className="border-b border-[#30363d] bg-[#161b22]/90 backdrop-blur sticky top-0 z-50 px-6 py-3">
      <div className="flex flex-wrap items-center justify-between gap-4 max-w-7xl mx-auto">
        {/* Title & Brand */}
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 rounded-lg bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 font-bold">
            K8s
          </div>
          <div>
            <h1 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
              Kube Playground
              <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-blue-900/50 text-blue-300 border border-blue-700/50">
                Milestone 1
              </span>
            </h1>
            <p className="text-xs text-gray-400">Live Kubernetes Autoscaling & Load Lab</p>
          </div>
        </div>

        {/* Global Cluster Stats */}
        <div className="flex items-center space-x-6 text-sm">
          <div className="flex items-center space-x-2 bg-[#0d1117] px-3 py-1.5 rounded-md border border-[#30363d]">
            <Server className="w-4 h-4 text-emerald-400" />
            <span className="text-gray-400">Total Pods:</span>
            <span className="font-semibold text-white">{totals?.pods ?? 0}</span>
          </div>

          <div className="flex items-center space-x-2 bg-[#0d1117] px-3 py-1.5 rounded-md border border-[#30363d]">
            <Box className="w-4 h-4 text-cyan-400" />
            <span className="text-gray-400">Containers:</span>
            <span className="font-semibold text-white">
              {totals?.readyContainers ?? 0} / {totals?.containers ?? 0}
            </span>
          </div>

          {/* Connection Status Pill */}
          <div
            className={`flex items-center space-x-2 px-3 py-1.5 rounded-md text-xs font-semibold border ${
              connected
                ? 'bg-emerald-950/40 text-emerald-400 border-emerald-800/50'
                : 'bg-rose-950/40 text-rose-400 border-rose-800/50 animate-pulse'
            }`}
          >
            {connected ? (
              <>
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>Live Stream</span>
              </>
            ) : (
              <>
                <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                <span>Disconnected</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Disconnection Banner if disconnected */}
      {!connected && (
        <div className="mt-2 bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs px-4 py-2 rounded-md flex items-center justify-between max-w-7xl mx-auto">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-400" />
            <span>Connection to cluster control-api lost. Retrying automatically...</span>
          </div>
          {lastUpdated && (
            <span className="text-rose-400/80">Last seen: {lastUpdated.toLocaleTimeString()}</span>
          )}
        </div>
      )}
    </header>
  );
};

