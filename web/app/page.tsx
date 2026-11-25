'use client';

import React from 'react';
import { useClusterState } from '../lib/useClusterState';
import { TopRibbon } from '../components/TopRibbon';
import { LoadRail } from '../components/LoadRail';
import { ServiceLane } from '../components/ServiceLane';
import { CallGraph } from '../components/CallGraph';
import { EventFeed } from '../components/EventFeed';

export default function DashboardPage() {
  const { state, connected, lastUpdated, refresh } = useClusterState();

  const services = state?.services || [
    {
      name: 'a' as const,
      hpa: { min: 1, max: 5, current: 1, desired: 1, targetCpuPct: 50, avgCpuPct: 0 },
      rps: 0,
      errorsPerSec: 0,
      p95Ms: 0,
      load: { running: false, vus: 40, workMs: 50, route: 'work' as const, targets: [], sleepMs: 100 },
      traffic: [{ release: 'blue', weight: 100 }],
      pods: [],
    },
    {
      name: 'b' as const,
      hpa: { min: 1, max: 5, current: 1, desired: 1, targetCpuPct: 50, avgCpuPct: 0 },
      rps: 0,
      errorsPerSec: 0,
      p95Ms: 0,
      load: { running: false, vus: 40, workMs: 50, route: 'work' as const, targets: [], sleepMs: 100 },
      traffic: [{ release: 'stable', weight: 100 }],
      pods: [],
    },
    {
      name: 'c' as const,
      hpa: { min: 1, max: 5, current: 1, desired: 1, targetCpuPct: 50, avgCpuPct: 0 },
      rps: 0,
      errorsPerSec: 0,
      p95Ms: 0,
      load: { running: false, vus: 40, workMs: 50, route: 'work' as const, targets: [], sleepMs: 100 },
      traffic: [{ release: 'current', weight: 100 }],
      pods: [],
    },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-paper text-ink font-sans selection:bg-signal/20">
      {/* Top Ribbon: Telemetry stream & cluster counters */}
      <TopRibbon
        connected={connected}
        totals={state?.totals}
        lastUpdated={lastUpdated}
      />

      {/* Main Container: Fixed/Sticky Left Load Control Rail + Right Swimlanes */}
      <div className="flex-1 max-w-[1600px] w-full mx-auto p-4 sm:p-6 flex flex-col lg:flex-row gap-6 items-start">
        {/* Section 01: Load Controls Rail */}
        <LoadRail services={services} onUpdate={refresh} />

        {/* Main Work Area: Services, Topology, Events */}
        <main className="flex-1 min-w-0 w-full space-y-6">
          {/* Section 02: Microservice Workload Swimlanes */}
          <section className="space-y-4">
            <div className="flex items-center justify-between pb-1 border-b border-hairline">
              <div className="flex items-center space-x-2">
                <span className="text-[11px] font-mono font-bold tracking-widest text-muted uppercase">
                  02 // MICROSERVICE SWIMLANES
                </span>
              </div>
              <span className="text-[10px] font-mono text-muted">
                3 WORKLOADS • BLUE-GREEN / CANARY / ROLLING
              </span>
            </div>

            <div className="space-y-4">
              {services.map((svc) => (
                <ServiceLane key={svc.name} service={svc} />
              ))}
            </div>
          </section>

          {/* Section 03: Inter-Service Call Graph Topology */}
          <section>
            <CallGraph edges={state?.callGraph || []} />
          </section>

          {/* Section 04: Cluster Scaling & Lifecycle Event Log */}
          <section>
            <EventFeed events={state?.events || []} />
          </section>
        </main>
      </div>

      {/* Technical Console Footer (Removed Milestone 1 & dev text) */}
      <footer className="border-t border-hairline bg-surface py-3 px-6 text-center text-[10px] font-mono text-muted">
        KUBE PLAYGROUND • IN-CLUSTER TELEMETRY & WORKLOAD ORCHESTRATION CONSOLE
      </footer>
    </div>
  );
}
