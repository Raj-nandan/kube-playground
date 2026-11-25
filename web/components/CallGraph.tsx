'use client';

import React from 'react';
import { CallGraphEdge } from '../lib/types';
import { Network } from 'lucide-react';

interface CallGraphProps {
  edges: CallGraphEdge[];
}

interface NodePos {
  id: string;
  label: string;
  x: number;
  y: number;
}

export const CallGraph: React.FC<CallGraphProps> = ({ edges }) => {
  const nodes: NodePos[] = [
    { id: 'a', label: 'svc-a', x: 120, y: 80 },
    { id: 'b', label: 'svc-b', x: 360, y: 80 },
    { id: 'c', label: 'svc-c', x: 600, y: 80 },
  ];

  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  const activeEdges = edges.filter((e) => e.rps > 0);
  const totalRps = edges.reduce((acc, e) => acc + (e.rps || 0), 0);

  // Helper to calculate edge path and label position
  const getEdgeData = (fromId: string, toId: string) => {
    const from = nodeMap.get(fromId);
    const to = nodeMap.get(toId);
    if (!from || !to) return null;

    const dx = to.x - from.x;
    const isDirectNeighbor = Math.abs(dx) <= 260;
    const isForward = dx > 0;

    let pathD = '';
    let labelX = 0;
    let labelY = 0;

    if (isDirectNeighbor) {
      if (isForward) {
        // A -> B or B -> C (Straight line shifted slightly up)
        const yOffset = -8;
        pathD = `M ${from.x + 36} ${from.y + yOffset} L ${to.x - 36} ${to.y + yOffset}`;
        labelX = (from.x + to.x) / 2;
        labelY = from.y + yOffset - 8;
      } else {
        // B -> A or C -> B (Curve below)
        const yOffset = 8;
        pathD = `M ${from.x - 36} ${from.y + yOffset} L ${to.x + 36} ${to.y + yOffset}`;
        labelX = (from.x + to.x) / 2;
        labelY = from.y + yOffset + 14;
      }
    } else {
      // Leap across (A -> C or C -> A)
      if (isForward) {
        // Arch over the top
        const startX = from.x + 20;
        const startY = from.y - 20;
        const endX = to.x - 20;
        const endY = to.y - 20;
        pathD = `M ${startX} ${startY} Q ${(from.x + to.x) / 2} 10 ${endX} ${endY}`;
        labelX = (from.x + to.x) / 2;
        labelY = 24;
      } else {
        // Arch beneath the bottom
        const startX = from.x - 20;
        const startY = from.y + 20;
        const endX = to.x + 20;
        const endY = to.y + 20;
        pathD = `M ${startX} ${startY} Q ${(from.x + to.x) / 2} 150 ${endX} ${endY}`;
        labelX = (from.x + to.x) / 2;
        labelY = 142;
      }
    }

    return { pathD, labelX, labelY };
  };

  // Predefined potential mesh connections
  const potentialConnections = [
    { from: 'a', to: 'b' },
    { from: 'b', to: 'c' },
    { from: 'a', to: 'c' },
  ];

  return (
    <div className="border border-hairline bg-surface p-4 rounded-sm text-ink space-y-3">
      {/* Topology Header */}
      <div className="flex items-center justify-between pb-2 border-b border-hairline/70">
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs font-bold text-muted bg-paper px-1.5 py-0.5 rounded-[2px] border border-hairline">
            03
          </span>
          <h2 className="font-display font-bold text-lg tracking-tight text-ink flex items-center gap-2">
            <Network className="w-4 h-4 text-muted" />
            Inter-Service Call Graph & Topology
          </h2>
        </div>
        <div className="flex items-center gap-3 text-xs font-mono text-muted">
          <span>
            ACTIVE EDGES: <span className="font-bold text-ink">{activeEdges.length}</span>
          </span>
          <span>
            AGGREGATE RATE:{' '}
            <span className="font-bold text-ink tabular-nums">{totalRps.toFixed(1)} RPS</span>
          </span>
        </div>
      </div>

      {/* SVG Canvas */}
      <div className="relative w-full bg-paper border border-hairline rounded-sm overflow-hidden py-2">
        <svg
          viewBox="0 0 720 160"
          className="w-full h-auto select-none overflow-visible"
        >
          <defs>
            {/* Arrow marker for active vermilion lines */}
            <marker
              id="arrow-active"
              viewBox="0 0 10 10"
              refX="6"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#E4572E" />
            </marker>

            {/* Arrow marker for idle dimmed lines */}
            <marker
              id="arrow-idle"
              viewBox="0 0 10 10"
              refX="6"
              refY="5"
              markerWidth="5"
              markerHeight="5"
              orient="auto-start-reverse"
            >
              <path d="M 0 2 L 6 5 L 0 8 z" fill="#D9D4C7" />
            </marker>
          </defs>

          {/* Idle potential background lines */}
          {potentialConnections.map((conn) => {
            const edgeData = getEdgeData(conn.from, conn.to);
            const isActive = edges.some(
              (e) => e.from === conn.from && e.to === conn.to && e.rps > 0
            );
            if (!edgeData || isActive) return null;

            return (
              <path
                key={`idle-${conn.from}-${conn.to}`}
                d={edgeData.pathD}
                fill="none"
                stroke="currentColor"
                className="text-hairline"
                strokeWidth="1.25"
                strokeDasharray="4,4"
                markerEnd="url(#arrow-idle)"
              />
            );
          })}

          {/* Active Edges */}
          {edges.map((edge) => {
            const edgeData = getEdgeData(edge.from, edge.to);
            if (!edgeData || edge.rps <= 0) return null;

            // Stroke thickness scaled by RPS (1.5px to 5px)
            const strokeWidth = Math.min(5, Math.max(1.5, Math.log2(edge.rps + 1) * 1.1));

            return (
              <g key={`active-${edge.from}-${edge.to}`}>
                {/* Glow/backdrop track */}
                <path
                  d={edgeData.pathD}
                  fill="none"
                  stroke="#E4572E"
                  strokeOpacity="0.15"
                  strokeWidth={strokeWidth + 3}
                />
                {/* Active Line */}
                <path
                  d={edgeData.pathD}
                  fill="none"
                  stroke="#E4572E"
                  strokeWidth={strokeWidth}
                  markerEnd="url(#arrow-active)"
                />
                {/* Rate Badge on Edge */}
                <rect
                  x={edgeData.labelX - 32}
                  y={edgeData.labelY - 9}
                  width="64"
                  height="17"
                  rx="2"
                  className="fill-surface stroke-signal"
                  strokeWidth="0.75"
                />
                <text
                  x={edgeData.labelX}
                  y={edgeData.labelY + 3}
                  textAnchor="middle"
                  className="text-[9.5px] font-mono fill-ink font-semibold tracking-tight"
                >
                  {edge.rps.toFixed(1)} rps
                </text>
              </g>
            );
          })}

          {/* Service Nodes A, B, C */}
          {nodes.map((node) => (
            <g key={node.id} transform={`translate(${node.x}, ${node.y})`}>
              {/* Outer boundary */}
              <rect
                x="-42"
                y="-26"
                width="84"
                height="52"
                rx="2"
                className="fill-surface stroke-hairline"
                strokeWidth="1.25"
              />
              {/* Node ID indicator */}
              <text
                x="0"
                y="-6"
                textAnchor="middle"
                className="font-mono text-[11px] font-bold fill-muted uppercase tracking-widest"
              >
                NODE {node.id.toUpperCase()}
              </text>
              {/* Node Service Name */}
              <text
                x="0"
                y="14"
                textAnchor="middle"
                className="font-display text-sm font-bold fill-ink tracking-tight"
              >
                {node.label}
              </text>
            </g>
          ))}
        </svg>

        {/* Centered empty state help when no inter-service edges exist */}
        {activeEdges.length === 0 && (
          <div className="text-center py-2 text-xs font-mono text-muted border-t border-hairline/60 bg-surface/50">
            No active inter-service traffic. Configure <span className="font-semibold text-ink">Chain</span> or{' '}
            <span className="font-semibold text-ink">Fanout</span> on a load driver to initiate calls.
          </div>
        )}
      </div>
    </div>
  );
};
