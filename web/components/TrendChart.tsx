'use client';

import React, { useEffect, useRef, useState } from 'react';

interface TrendPoint {
  time: number;
  cpu: number;
  replicas: number;
}

interface TrendChartProps {
  currentReplicas: number;
  avgCpuPct: number;
  targetCpuPct: number;
  maxReplicas?: number;
}

const HISTORY_WINDOW_MS = 180000; // 3 minutes

export const TrendChart: React.FC<TrendChartProps> = ({
  currentReplicas,
  avgCpuPct,
  targetCpuPct,
  maxReplicas = 5,
}) => {
  const [history, setHistory] = useState<TrendPoint[]>(() => [
    { time: Date.now(), cpu: avgCpuPct, replicas: currentReplicas },
  ]);

  const lastRecordedRef = useRef<number>(Date.now());

  // Record historical points at most every 1.5s or on changes
  useEffect(() => {
    const now = Date.now();
    // Only append if at least 1000ms has elapsed
    if (now - lastRecordedRef.current >= 1000) {
      lastRecordedRef.current = now;
      setHistory((prev) => {
        const cutoff = now - HISTORY_WINDOW_MS;
        const filtered = prev.filter((p) => p.time >= cutoff);
        return [...filtered, { time: now, cpu: avgCpuPct, replicas: currentReplicas }];
      });
    }
  }, [avgCpuPct, currentReplicas]);

  // Periodic pruning ticker every 5s so chart slides even if no new events arrive
  useEffect(() => {
    const timer = setInterval(() => {
      const now = Date.now();
      const cutoff = now - HISTORY_WINDOW_MS;
      setHistory((prev) => {
        const filtered = prev.filter((p) => p.time >= cutoff);
        // keep at least 1 point
        return filtered.length > 0 ? filtered : [{ time: now, cpu: avgCpuPct, replicas: currentReplicas }];
      });
    }, 5000);
    return () => clearInterval(timer);
  }, [avgCpuPct, currentReplicas]);

  // SVG dimensions
  const width = 280;
  const height = 64;
  const padding = { top: 6, bottom: 14, left: 24, right: 24 };

  const plotW = width - padding.left - padding.right;
  const plotH = height - padding.top - padding.bottom;

  const now = Date.now();
  const startTime = now - HISTORY_WINDOW_MS;

  // Map CPU (0 - 100%) to Y
  const getCpuY = (cpu: number) => {
    const clamped = Math.max(0, Math.min(100, cpu));
    return padding.top + plotH - (clamped / 100) * plotH;
  };

  // Map Replicas (0 - maxReplicas) to Y
  const getReplicaY = (reps: number) => {
    const clamped = Math.max(0, Math.min(maxReplicas, reps));
    return padding.top + plotH - (clamped / maxReplicas) * plotH;
  };

  // Map Time to X
  const getX = (time: number) => {
    const progress = Math.max(0, Math.min(1, (time - startTime) / HISTORY_WINDOW_MS));
    return padding.left + progress * plotW;
  };

  // Build CPU line & area path
  let cpuPathD = '';
  let cpuAreaD = '';
  let repPathD = '';

  if (history.length > 0) {
    const points = history.map((pt) => ({
      x: getX(pt.time),
      yCpu: getCpuY(pt.cpu),
      yRep: getReplicaY(pt.replicas),
    }));

    // Replicate first point to startTime if needed for continuous left edge
    const firstX = points[0].x;
    const firstYCpu = points[0].yCpu;
    const firstYRep = points[0].yRep;

    const startX = padding.left;
    const endX = padding.left + plotW;
    const baseY = padding.top + plotH;

    // CPU line
    cpuPathD = `M ${startX} ${firstYCpu} L ${points.map((p) => `${p.x.toFixed(1)} ${p.yCpu.toFixed(1)}`).join(' L ')} L ${endX} ${points[points.length - 1].yCpu.toFixed(1)}`;

    // CPU Area
    cpuAreaD = `${cpuPathD} L ${endX} ${baseY} L ${startX} ${baseY} Z`;

    // Replicas Stepped line
    repPathD = `M ${startX} ${firstYRep}`;
    for (let i = 0; i < points.length; i++) {
      const p = points[i];
      repPathD += ` L ${p.x.toFixed(1)} ${p.yRep.toFixed(1)}`;
    }
    repPathD += ` L ${endX} ${points[points.length - 1].yRep.toFixed(1)}`;
  }

  const targetY = getCpuY(targetCpuPct);

  return (
    <div className="border border-hairline bg-surface p-2 rounded-sm text-ink">
      <div className="flex items-center justify-between text-[10px] font-mono mb-1 pb-1 border-b border-hairline/60">
        <span className="uppercase tracking-wider text-muted font-sans font-semibold">
          3-Minute Trend
        </span>
        <div className="flex items-center gap-2 text-[9px]">
          <span className="flex items-center gap-1">
            <span className="inline-block w-2.5 h-[2px] bg-signal" />
            <span>Avg CPU</span>
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-2.5 h-[2px] bg-ink/70" />
            <span>Replicas</span>
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-2.5 h-[1px] border-b border-dashed border-ink/40" />
            <span>Target ({targetCpuPct}%)</span>
          </span>
        </div>
      </div>

      <div className="relative w-full">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-auto overflow-visible select-none"
        >
          {/* Background grid lines */}
          <line
            x1={padding.left}
            y1={padding.top}
            x2={padding.left + plotW}
            y2={padding.top}
            stroke="currentColor"
            className="text-hairline"
            strokeWidth="0.75"
          />
          <line
            x1={padding.left}
            y1={padding.top + plotH / 2}
            x2={padding.left + plotW}
            y2={padding.top + plotH / 2}
            stroke="currentColor"
            className="text-hairline"
            strokeWidth="0.75"
          />
          <line
            x1={padding.left}
            y1={padding.top + plotH}
            x2={padding.left + plotW}
            y2={padding.top + plotH}
            stroke="currentColor"
            className="text-hairline"
            strokeWidth="0.75"
          />

          {/* HPA Target 50% line */}
          <line
            x1={padding.left}
            y1={targetY}
            x2={padding.left + plotW}
            y2={targetY}
            stroke="currentColor"
            className="text-ink/40"
            strokeWidth="1"
            strokeDasharray="2,2"
          />

          {/* CPU fill area */}
          {cpuAreaD && (
            <path
              d={cpuAreaD}
              fill="currentColor"
              className="text-signal/10"
            />
          )}

          {/* Replicas stepped line */}
          {repPathD && (
            <path
              d={repPathD}
              fill="none"
              stroke="currentColor"
              className="text-ink/70"
              strokeWidth="1.5"
            />
          )}

          {/* CPU line */}
          {cpuPathD && (
            <path
              d={cpuPathD}
              fill="none"
              stroke="currentColor"
              className="text-signal"
              strokeWidth="1.5"
            />
          )}

          {/* Axis Labels */}
          {/* Left: CPU % */}
          <text
            x={padding.left - 3}
            y={padding.top + 3}
            textAnchor="end"
            className="text-[8px] font-mono fill-muted"
          >
            100%
          </text>
          <text
            x={padding.left - 3}
            y={targetY + 2.5}
            textAnchor="end"
            className="text-[8px] font-mono fill-ink font-semibold"
          >
            {targetCpuPct}%
          </text>
          <text
            x={padding.left - 3}
            y={padding.top + plotH}
            textAnchor="end"
            className="text-[8px] font-mono fill-muted"
          >
            0%
          </text>

          {/* Right: Replicas */}
          <text
            x={padding.left + plotW + 3}
            y={padding.top + 3}
            textAnchor="start"
            className="text-[8px] font-mono fill-muted"
          >
            {maxReplicas}R
          </text>
          <text
            x={padding.left + plotW + 3}
            y={padding.top + plotH}
            textAnchor="start"
            className="text-[8px] font-mono fill-muted"
          >
            0R
          </text>

          {/* Bottom Time Markers */}
          <text
            x={padding.left}
            y={height - 2}
            textAnchor="start"
            className="text-[7.5px] font-mono fill-muted"
          >
            -3m
          </text>
          <text
            x={padding.left + plotW / 2}
            y={height - 2}
            textAnchor="middle"
            className="text-[7.5px] font-mono fill-muted"
          >
            -90s
          </text>
          <text
            x={padding.left + plotW}
            y={height - 2}
            textAnchor="end"
            className="text-[7.5px] font-mono fill-muted"
          >
            now
          </text>
        </svg>
      </div>
    </div>
  );
};
