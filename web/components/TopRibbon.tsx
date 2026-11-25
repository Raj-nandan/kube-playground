'use client';

import React, { useState, useEffect } from 'react';
import { Totals } from '../lib/types';
import { Sun, Moon } from 'lucide-react';

interface TopRibbonProps {
  connected: boolean;
  totals?: Totals;
  lastUpdated?: Date | null;
}

export const TopRibbon: React.FC<TopRibbonProps> = ({
  connected,
  totals,
}) => {
  const [isDark, setIsDark] = useState<boolean>(false);

  // Sync theme with document class
  useEffect(() => {
    const root = document.documentElement;
    const isCurrentlyDark =
      root.classList.contains('dark') ||
      (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches) ||
      localStorage.getItem('theme') === 'dark';

    if (isCurrentlyDark) {
      root.classList.add('dark');
      setIsDark(true);
    } else {
      root.classList.remove('dark');
      setIsDark(false);
    }
  }, []);

  const toggleTheme = () => {
    const root = document.documentElement;
    if (isDark) {
      root.classList.remove('dark');
      localStorage.setItem('theme', 'light');
      setIsDark(false);
    } else {
      root.classList.add('dark');
      localStorage.setItem('theme', 'dark');
      setIsDark(true);
    }
  };

  return (
    <header className="border-b border-hairline bg-surface sticky top-0 z-50 text-xs">
      <div className="max-w-[1600px] mx-auto px-4 py-2 flex flex-wrap items-center justify-between gap-4">
        {/* Brand & System Spec */}
        <div className="flex items-baseline space-x-3">
          <div className="flex items-center space-x-1.5">
            <span className="w-2.5 h-2.5 bg-signal inline-block" aria-hidden="true" />
            <span className="font-display font-bold text-sm tracking-tight text-ink uppercase">
              Kube Playground
            </span>
          </div>
          <span className="text-[10px] font-mono tracking-widest text-muted uppercase">
            // TELEMETRY CONSOLE
          </span>
        </div>

        {/* Real-time Telemetry Metrics */}
        <div className="flex items-center space-x-6 text-muted font-mono">
          {/* Total Pods */}
          <div className="flex items-baseline space-x-1.5">
            <span className="text-[10px] uppercase tracking-wider text-muted">PODS:</span>
            <span className="text-sm font-semibold text-ink tabular-nums">
              {totals?.pods ?? 0}
            </span>
          </div>

          <span className="text-hairline-dark select-none">|</span>

          {/* Containers */}
          <div className="flex items-baseline space-x-1.5">
            <span className="text-[10px] uppercase tracking-wider text-muted">CONTAINERS:</span>
            <span className="text-sm font-semibold text-ink tabular-nums">
              {totals?.readyContainers ?? 0}
              <span className="text-muted font-normal">/{totals?.containers ?? 0}</span>
            </span>
          </div>

          <span className="text-hairline-dark select-none">|</span>

          {/* Cluster Node Resource Placeholder (TODO: Requires cluster-metrics endpoint from control-api) */}
          <div
            className="hidden sm:flex items-baseline space-x-1.5 text-muted/80 cursor-help"
            title="Cluster-wide node resource allocation (Requires node metrics endpoint from control-api)"
          >
            <span className="text-[10px] uppercase tracking-wider">CLUSTER:</span>
            <span className="text-xs text-muted tabular-nums">CPU: --% · MEM: --%</span>
          </div>

          <span className="text-hairline-dark select-none">|</span>

          {/* Connection Stream Status */}
          <div className="flex items-center space-x-2">
            <div
              className={`w-2 h-2 rounded-full ${
                connected ? 'bg-ready' : 'bg-failed animate-pulse'
              }`}
            />
            <span className="text-[11px] font-mono text-ink">
              {connected ? (
                <span>STREAM ACTIVE</span>
              ) : (
                <span className="text-failed font-semibold">DISCONNECTED</span>
              )}
            </span>
          </div>

          {/* Theme Toggle Button */}
          <button
            onClick={toggleTheme}
            aria-label={isDark ? 'Switch to light paper theme' : 'Switch to dark console theme'}
            className="p-1.5 rounded border border-hairline bg-surface-alt hover:bg-hairline text-ink transition-colors flex items-center justify-center focus:outline-none focus:ring-1 focus:ring-signal"
            title={isDark ? 'Light Paper Theme' : 'Dark Industrial Theme'}
          >
            {isDark ? (
              <Sun className="w-3.5 h-3.5 text-signal" />
            ) : (
              <Moon className="w-3.5 h-3.5 text-muted" />
            )}
          </button>
        </div>
      </div>
    </header>
  );
};
