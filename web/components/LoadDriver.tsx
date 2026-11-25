'use client';

import React, { useState, useEffect, useRef } from 'react';
import { ServiceState } from '../lib/types';
import { DASHBOARD_CONFIG } from '../lib/config';

interface LoadDriverProps {
  service: ServiceState;
  onUpdate?: () => void;
}

export const LoadDriver: React.FC<LoadDriverProps> = ({ service, onUpdate }) => {
  const isRunning = service.load?.running ?? false;
  const cfg = DASHBOARD_CONFIG.LOAD_DRIVERS;

  // Local state representing the desired / active parameters
  const [vus, setVus] = useState<number>(() => {
    if (service.load?.running && service.load?.vus > 0) return service.load.vus;
    return cfg.DEFAULT_VUS;
  });
  const [workMs, setWorkMs] = useState<number>(() => service.load?.workMs || cfg.DEFAULT_WORK_MS);
  const [route, setRoute] = useState<'work' | 'chain' | 'fanout'>(() => service.load?.route || 'work');
  const [targets, setTargets] = useState<string[]>(() => service.load?.targets || []);
  const [actionPending, setActionPending] = useState<boolean>(false);

  // Timestamp of the user's latest interaction to prevent server telemetry overwrite
  const lastUserEditRef = useRef<number>(0);

  // Sibling options for chain / fanout (e.g. for svc-a: b, c)
  const allServices = ['a', 'b', 'c'];
  const siblingServices = allServices.filter((s) => s !== service.name);

  // Synchronize state from server only when appropriate
  useEffect(() => {
    // If the user interacted within the last 2.5 seconds, don't overwrite user's input
    if (Date.now() - lastUserEditRef.current < 2500) {
      return;
    }

    if (service.load?.running) {
      // Job is active in cluster: sync with actual live running values from server
      if (typeof service.load.vus === 'number' && service.load.vus > 0) {
        setVus(service.load.vus);
      }
      if (typeof service.load.workMs === 'number' && service.load.workMs > 0) {
        setWorkMs(service.load.workMs);
      }
      if (service.load.route) {
        setRoute(service.load.route);
      }
      if (Array.isArray(service.load.targets)) {
        setTargets(service.load.targets);
      }
    }
    // When NOT running (standby/idle):
    // DO NOT reset vus to 0! When idle, server reports vus:0 to indicate no traffic is currently flowing.
    // The user's slider represents the desired VUs to inject when clicking "Start Load".
  }, [service.load]);

  // Debounced PATCH for live VUs adjustment while load job is running
  const patchTimerRef = useRef<NodeJS.Timeout | null>(null);

  const handleVuChange = (newVus: number) => {
    lastUserEditRef.current = Date.now();
    setVus(newVus);

    // If job is not running, just update local draft state (no PATCH needed)
    if (!isRunning) return;

    // If job is running, debounce sending live PATCH to running k6 job
    if (patchTimerRef.current) clearTimeout(patchTimerRef.current);
    patchTimerRef.current = setTimeout(async () => {
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
    }, cfg.DEBOUNCE_PATCH_MS);
  };

  const handleWorkMsChange = (newWorkMs: number) => {
    lastUserEditRef.current = Date.now();
    setWorkMs(newWorkMs);
  };

  const handleRouteChange = (newRoute: 'work' | 'chain' | 'fanout') => {
    lastUserEditRef.current = Date.now();
    setRoute(newRoute);
    if (targets.length === 0 && siblingServices.length > 0) {
      setTargets([siblingServices[0]]);
    }
  };

  const toggleTarget = (targetSvc: string) => {
    lastUserEditRef.current = Date.now();
    if (targets.includes(targetSvc)) {
      setTargets(targets.filter((t) => t !== targetSvc));
    } else {
      setTargets([...targets, targetSvc]);
    }
  };

  const handleStart = async () => {
    setActionPending(true);
    lastUserEditRef.current = Date.now() + 3000; // Hold user input during launch
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
    } catch (err) {
      console.error('Failed to start load test:', err);
    } finally {
      setActionPending(false);
    }
  };

  const handleStop = async () => {
    setActionPending(true);
    lastUserEditRef.current = Date.now() + 2000;
    try {
      await fetch(`/api/load/${service.name}/stop`, { method: 'POST' });
      onUpdate?.();
    } catch (err) {
      console.error('Failed to stop load test:', err);
    } finally {
      setActionPending(false);
    }
  };

  return (
    <div className="border border-hairline bg-surface p-3.5 space-y-3 font-mono text-xs">
      {/* Header: Service Name & State */}
      <div className="flex items-center justify-between pb-2 border-b border-hairline">
        <div className="flex items-center space-x-2">
          <span className="font-display font-bold text-base text-ink tracking-tight uppercase">
            svc-{service.name}
          </span>
          <span className="text-[10px] font-mono px-1 py-0.2 rounded border border-hairline bg-surface-alt text-muted uppercase">
            {service.name === 'a' ? 'Blue-Green' : service.name === 'b' ? 'Canary' : 'Rolling'}
          </span>
        </div>

        <div className="flex items-center space-x-1.5">
          <span
            className={`w-2 h-2 inline-block ${
              isRunning ? 'bg-signal animate-pulse' : 'bg-muted/40'
            }`}
          />
          <span className={`text-[10px] font-semibold ${isRunning ? 'text-signal font-bold' : 'text-muted'}`}>
            {isRunning ? 'LOAD ACTIVE' : 'STANDBY'}
          </span>
        </div>
      </div>

      {/* Slider 1: Virtual Users (VUs) */}
      <div className="space-y-1">
        <div className="flex justify-between items-baseline text-[11px]">
          <label htmlFor={`vus-slider-${service.name}`} className="text-muted tracking-wider uppercase text-[10px]">
            VIRTUAL USERS (VUs)
          </label>
          <span className="text-ink font-bold text-sm tabular-nums">
            {vus}
            <span className="text-[10px] font-normal text-muted ml-0.5">VUs</span>
          </span>
        </div>
        <input
          id={`vus-slider-${service.name}`}
          type="range"
          min={cfg.MIN_VUS}
          max={cfg.MAX_VUS}
          step={cfg.VUS_STEP}
          value={vus}
          onChange={(e) => handleVuChange(parseInt(e.target.value, 10))}
          className="w-full h-1.5 bg-surface-alt rounded-none appearance-none cursor-pointer accent-signal focus:outline-none focus:ring-1 focus:ring-signal"
          aria-label={`Virtual Users for svc-${service.name}`}
        />
        <div className="flex justify-between text-[9px] text-muted select-none">
          <span>0</span>
          <span>100</span>
          <span>250</span>
          <span>500</span>
        </div>
      </div>

      {/* Slider 2: CPU Work Duration (ms) */}
      <div className="space-y-1">
        <div className="flex justify-between items-baseline text-[11px]">
          <label htmlFor={`work-slider-${service.name}`} className="text-muted tracking-wider uppercase text-[10px]">
            CPU WORK DURATION
          </label>
          <span className="text-ink font-bold text-sm tabular-nums">
            {workMs}
            <span className="text-[10px] font-normal text-muted ml-0.5">ms</span>
          </span>
        </div>
        <input
          id={`work-slider-${service.name}`}
          type="range"
          min={cfg.MIN_WORK_MS}
          max={cfg.MAX_WORK_MS}
          step={cfg.WORK_MS_STEP}
          value={workMs}
          onChange={(e) => handleWorkMsChange(parseInt(e.target.value, 10))}
          className="w-full h-1.5 bg-surface-alt rounded-none appearance-none cursor-pointer accent-signal focus:outline-none focus:ring-1 focus:ring-signal"
          aria-label={`CPU work duration in milliseconds for svc-${service.name}`}
        />
        <div className="flex justify-between text-[9px] text-muted select-none">
          <span>10ms</span>
          <span>100ms</span>
          <span>250ms</span>
          <span>500ms</span>
        </div>
      </div>

      {/* Route Selector: Segmented Button */}
      <div className="space-y-1.5">
        <span className="text-[10px] text-muted tracking-wider uppercase">ROUTE PATTERN</span>
        <div className="grid grid-cols-3 border border-hairline bg-surface-alt">
          {(['work', 'chain', 'fanout'] as const).map((r) => (
            <button
              key={r}
              type="button"
              disabled={isRunning}
              onClick={() => handleRouteChange(r)}
              className={`py-1 text-[11px] font-mono tracking-tight uppercase transition-colors ${
                route === r
                  ? 'bg-ink text-surface font-semibold'
                  : 'text-muted hover:text-ink'
              } disabled:opacity-50`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {/* Dynamic Target Picker: Chain Sequence or Fanout Multi-select */}
      {route !== 'work' && (
        <div className="space-y-1 bg-surface-alt p-2 border border-hairline">
          <div className="flex justify-between items-center text-[10px] text-muted uppercase">
            <span>{route === 'chain' ? 'CHAIN HOPS' : 'FANOUT TARGETS'}:</span>
            <span className="text-ink font-semibold">
              {targets.length > 0 ? targets.join(' → ') : 'None'}
            </span>
          </div>
          <div className="flex gap-1.5 pt-1">
            {siblingServices.map((targetSvc) => {
              const selected = targets.includes(targetSvc);
              const orderIndex = targets.indexOf(targetSvc);
              return (
                <button
                  key={targetSvc}
                  type="button"
                  disabled={isRunning}
                  onClick={() => toggleTarget(targetSvc)}
                  className={`px-2 py-0.5 text-[10px] border transition-colors ${
                    selected
                      ? 'border-signal bg-signal-muted text-signal font-semibold'
                      : 'border-hairline bg-surface text-muted hover:text-ink'
                  } disabled:opacity-50`}
                >
                  svc-{targetSvc}
                  {route === 'chain' && selected && ` (#${orderIndex + 1})`}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Start / Stop Trigger */}
      <div className="pt-1">
        {isRunning ? (
          <button
            type="button"
            disabled={actionPending}
            onClick={handleStop}
            className="w-full py-2 bg-failed hover:bg-failed/90 text-surface font-mono font-bold text-xs uppercase tracking-wider transition-colors flex items-center justify-center space-x-1.5 focus:outline-none focus:ring-1 focus:ring-failed"
          >
            <span>■ STOP LOAD</span>
            {actionPending && <span className="animate-spin text-xs">·</span>}
          </button>
        ) : (
          <button
            type="button"
            disabled={actionPending}
            onClick={handleStart}
            className="w-full py-2 bg-ink hover:bg-ink/80 text-surface font-mono font-bold text-xs uppercase tracking-wider transition-colors flex items-center justify-center space-x-1.5 focus:outline-none focus:ring-1 focus:ring-ink"
          >
            <span>▶ INJECT LOAD</span>
            {actionPending && <span className="animate-spin text-xs">·</span>}
          </button>
        )}
      </div>
    </div>
  );
};
