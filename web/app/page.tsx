'use client';

import React from 'react';
import { useClusterState } from '../lib/useClusterState';
import { TopBar } from '../components/TopBar';
import { LoadPanel } from '../components/LoadPanel';
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
    <div className="min-h-screen flex flex-col bg-[#090d16]">
      {/* Top Bar */}
      <TopBar connected={connected} totals={state?.totals} lastUpdated={lastUpdated} />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-6 space-y-6">
        {/* Load Driver Panels Grid */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-bold uppercase tracking-wider text-gray-400">
              Load Drivers (In-Cluster k6 Jobs)
            </h2>
            <span className="text-xs text-gray-500">
              Move sliders to dynamically tune traffic and observe HPA reaction
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {services.map((svc) => (
              <LoadPanel key={svc.name} service={svc} onUpdate={refresh} />
            ))}
          </div>
        </section>

        {/* Live Call Graph */}
        <section>
          <CallGraph edges={state?.callGraph || []} />
        </section>

        {/* Microservice Lanes */}
        <section className="space-y-4">
          <h2 className="text-xs font-bold uppercase tracking-wider text-gray-400">
            Microservice Workload Lanes & Pod Lifecycles
          </h2>
          <div className="space-y-4">
            {services.map((svc) => (
              <ServiceLane key={svc.name} service={svc} />
            ))}
          </div>
        </section>

        {/* Scaling & Lifecycle Events Feed */}
        <section>
          <EventFeed events={state?.events || []} />
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-[#21262d] py-4 text-center text-xs text-gray-500">
        Kube Playground • Milestone 1 • Hand-Authored YAML Driven Learning
      </footer>
    </div>
  );
}

