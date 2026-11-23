'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Play, Square, Flame, Sliders, ArrowRight } from 'lucide-react';
import { ServiceState } from '../lib/types';

interface LoadPanelProps {
  service: ServiceState;
  onUpdate?: () => void;
}

export const LoadPanel: React.FC<LoadPanelProps> = ({ service, onUpdate }) => {
  const isRunning = service.load?.running ?? false;

  const [vus, setVus] = useState<number>(service.load?.vus || 40);
  const [workMs, setWorkMs] = useState<number>(service.load?.workMs || 50);
  const [route, setRoute] = useState<'work' | 'chain' | 'fanout'>(service.load?.route || 'work');
  const [targets, setTargets] = useState<string[]>(service.load?.targets || []);
  const [loadingAction, setLoadingAction] = useState<boolean>(false);

  // Sync with incoming server state when not dragging
  useEffect(() => {
    if (isRunning) {
      if (service.load?.vus !== undefined) setVus(service.load.vus);
      if (service.load?.workMs !== undefined) setWorkMs(service.load.workMs);
      if (service.load?.route) setRoute(service.load.route);
      if (service.load?.targets) setTargets(service.load.targets);
    }
  }, [isRunning, service.load]);

  // Debounce PATCH /load/:service when VUs slider moves while running
  const patchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleVuChange = (newVus: number) => {
    setVus(newVus);
    if (!isRunning) return;

    if (patchTimeoutRef.current) {
      clearTimeout(patchTimeoutRef.current);
    }

    patchTimeoutRef.current = setTimeout(async () => {
      try {
        await fetch(`/api/load/${service.name}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ vus: newVus }),
        });
        onUpdate?.();
      } catch (err) {
        console.error('Failed to patch VUs:', err);
      }
    }, 300);
  };

  const handleStart = async () => {
    setLoadingAction(true);
    try {
      await fetch(`/api/load/${service.name}/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vus,
          workMs,
          route,
          targets,
          sleepMs: 100,
        }),
      });
      onUpdate?.();
      setTimeout(() => onUpdate?.(), 1000);
      setTimeout(() => onUpdate?.(), 2500);
    } catch (err) {
      console.error('Failed to start load:', err);
    } finally {
      setLoadingAction(false);
    }
  };

  const handleStop = async () => {
    setLoadingAction(true);
    try {
      await fetch(`/api/load/${service.name}/stop`, {
        method: 'POST',
      });
      onUpdate?.();
      setTimeout(() => onUpdate?.(), 1000);
      setTimeout(() => onUpdate?.(), 2500);
    } catch (err) {
      console.error('Failed to stop load:', err);
    } finally {
      setLoadingAction(false);
    }
  };

  const toggleTarget = (targetSvc: string) => {
    if (targets.includes(targetSvc)) {
      setTargets(targets.filter((t) => t !== targetSvc));
    } else {
      setTargets([...targets, targetSvc]);
    }
  };

  const availableTargets = ['a', 'b', 'c'].filter((t) => t !== service.name);

  return (
    <div className="bg-[#161b22] border border-[#30363d] rounded-xl p-4 flex flex-col justify-between shadow-sm">
      {/* Header */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <span className="w-6 h-6 rounded-md bg-blue-600/20 text-blue-400 font-bold flex items-center justify-center text-xs border border-blue-500/30">
              {service.name.toUpperCase()}
            </span>
            <h3 className="font-bold text-white text-sm">Load Driver: svc-{service.name}</h3>
          </div>
          <span
            className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
              isRunning
                ? 'bg-emerald-950/50 text-emerald-300 border-emerald-700/60 animate-pulse'
                : 'bg-gray-800 text-gray-400 border-gray-700'
            }`}
          >
            {isRunning ? `Running (${vus} VUs)` : 'Idle'}
          </span>
        </div>

        {/* Sliders */}
        <div className="space-y-4 text-xs">
          {/* Virtual Users Slider */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <span className="text-gray-400 flex items-center gap-1">
                <Sliders className="w-3.5 h-3.5 text-cyan-400" />
                Virtual Users (VUs)
              </span>
              <span className="font-mono font-bold text-white bg-[#0d1117] px-2 py-0.5 rounded border border-[#30363d]">
                {vus}
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="150"
              step="5"
              value={vus}
              onChange={(e) => handleVuChange(parseInt(e.target.value, 10))}
              className="w-full accent-blue-500 bg-[#21262d] rounded-lg h-1.5 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-gray-500 mt-0.5">
              <span>0</span>
              <span>75</span>
              <span>150</span>
            </div>
          </div>

          {/* Work Duration Slider */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <span className="text-gray-400 flex items-center gap-1">
                <Flame className="w-3.5 h-3.5 text-rose-400" />
                CPU Work Per Request
              </span>
              <span className="font-mono font-bold text-white bg-[#0d1117] px-2 py-0.5 rounded border border-[#30363d]">
                {workMs} ms
              </span>
            </div>
            <input
              type="range"
              min="10"
              max="200"
              step="10"
              disabled={isRunning}
              value={workMs}
              onChange={(e) => setWorkMs(parseInt(e.target.value, 10))}
              className="w-full accent-rose-500 bg-[#21262d] rounded-lg h-1.5 cursor-pointer disabled:opacity-50"
            />
            <div className="flex justify-between text-[10px] text-gray-500 mt-0.5">
              <span>10ms</span>
              <span>100ms</span>
              <span>200ms</span>
            </div>
          </div>

          {/* Route Mode Selection */}
          <div>
            <label className="text-gray-400 block mb-1.5 font-medium">Route Type</label>
            <div className="grid grid-cols-3 gap-1 bg-[#0d1117] p-1 rounded-lg border border-[#30363d]">
              {(['work', 'chain', 'fanout'] as const).map((r) => (
                <button
                  key={r}
                  type="button"
                  disabled={isRunning}
                  onClick={() => setRoute(r)}
                  className={`py-1 rounded text-[11px] font-medium capitalize transition-colors ${
                    route === r
                      ? 'bg-blue-600 text-white font-semibold shadow'
                      : 'text-gray-400 hover:text-gray-200'
                  } disabled:cursor-not-allowed`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          {/* Targets (if route is chain or fanout) */}
          {(route === 'chain' || route === 'fanout') && (
            <div className="bg-[#0d1117] p-2 rounded-lg border border-[#30363d]">
              <span className="text-gray-400 block mb-1 text-[11px]">Downstream Targets:</span>
              <div className="flex items-center gap-2">
                {availableTargets.map((t) => {
                  const active = targets.includes(t);
                  return (
                    <button
                      key={t}
                      type="button"
                      disabled={isRunning}
                      onClick={() => toggleTarget(t)}
                      className={`px-2.5 py-1 rounded text-[11px] font-mono border transition-colors ${
                        active
                          ? 'bg-cyan-950/60 border-cyan-500 text-cyan-300 font-semibold'
                          : 'border-[#30363d] text-gray-400 hover:border-gray-500'
                      }`}
                    >
                      svc-{t}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Start / Stop Button */}
      <div className="mt-5 pt-3 border-t border-[#21262d]">
        {isRunning ? (
          <button
            type="button"
            disabled={loadingAction}
            onClick={handleStop}
            className="w-full flex items-center justify-center gap-2 bg-rose-600 hover:bg-rose-500 text-white py-2 rounded-lg font-semibold text-xs transition shadow-sm disabled:opacity-50"
          >
            <Square className="w-3.5 h-3.5 fill-current" />
            Stop Load
          </button>
        ) : (
          <button
            type="button"
            disabled={loadingAction}
            onClick={handleStart}
            className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white py-2 rounded-lg font-semibold text-xs transition shadow-sm disabled:opacity-50"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            Start Load
          </button>
        )}
      </div>
    </div>
  );
};

