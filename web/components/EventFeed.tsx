'use client';

import React, { useState } from 'react';
import { EventItem } from '../lib/types';
import { ScrollText, Filter } from 'lucide-react';

interface EventFeedProps {
  events: EventItem[];
}

export const EventFeed: React.FC<EventFeedProps> = ({ events }) => {
  const [filter, setFilter] = useState<'all' | 'a' | 'b' | 'c'>('all');

  // Format timestamp (e.g. 15:04:22)
  const formatTime = (isoString: string) => {
    try {
      const d = new Date(isoString);
      return isNaN(d.getTime()) ? isoString : d.toLocaleTimeString([], { hour12: false });
    } catch {
      return isoString;
    }
  };

  // Infer service from message or reason
  const getServiceTag = (msg: string, reason: string): string => {
    const text = `${msg} ${reason}`.toLowerCase();
    if (text.includes('svc-a') || text.includes('a-blue') || text.includes('a-green')) return 'svc-a';
    if (text.includes('svc-b') || text.includes('b-stable') || text.includes('b-canary')) return 'svc-b';
    if (text.includes('svc-c') || text.includes('c-current')) return 'svc-c';
    return 'cluster';
  };

  // Filter events
  const filteredEvents = events.filter((evt) => {
    if (filter === 'all') return true;
    const tag = getServiceTag(evt.message, evt.reason);
    return tag === `svc-${filter}`;
  });

  // Newest first
  const sortedEvents = [...filteredEvents].reverse();

  return (
    <div className="border border-hairline bg-surface p-4 rounded-sm text-ink space-y-3">
      {/* Section Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-2 border-b border-hairline/70">
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs font-bold text-muted bg-paper px-1.5 py-0.5 rounded-[2px] border border-hairline">
            04
          </span>
          <h2 className="font-display font-bold text-lg tracking-tight text-ink flex items-center gap-2">
            <ScrollText className="w-4 h-4 text-muted" />
            Cluster Scaling & Lifecycle Event Log
          </h2>
        </div>

        {/* Service filter tabs */}
        <div className="flex items-center gap-1 text-xs font-mono">
          <span className="text-muted flex items-center gap-1 mr-1 text-[11px]">
            <Filter className="w-3 h-3" />
            FILTER:
          </span>
          {(['all', 'a', 'b', 'c'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setFilter(tab)}
              className={`px-2 py-0.5 rounded-[2px] border text-[10px] uppercase tracking-wider transition ${
                filter === tab
                  ? 'border-ink bg-ink text-paper font-semibold'
                  : 'border-hairline bg-paper text-muted hover:text-ink'
              }`}
            >
              {tab === 'all' ? 'All' : `svc-${tab}`}
            </button>
          ))}
        </div>
      </div>

      {/* Events Table */}
      <div className="border border-hairline bg-paper rounded-sm overflow-hidden">
        {sortedEvents.length === 0 ? (
          <div className="py-8 text-center text-xs font-mono text-muted">
            No cluster scaling or lifecycle events recorded in this session.
          </div>
        ) : (
          <div className="max-h-72 overflow-y-auto divide-y divide-hairline/70">
            {/* Table Header */}
            <div className="grid grid-cols-12 gap-2 px-3 py-1.5 bg-surface text-[10px] font-mono text-muted uppercase tracking-wider border-b border-hairline sticky top-0 z-10">
              <div className="col-span-2 sm:col-span-2">Time</div>
              <div className="col-span-2 sm:col-span-2">Target</div>
              <div className="col-span-3 sm:col-span-3">Reason</div>
              <div className="col-span-5 sm:col-span-5">Message</div>
            </div>

            {/* Event Rows */}
            {sortedEvents.map((evt, idx) => {
              const svcTag = getServiceTag(evt.message, evt.reason);
              const isScale =
                evt.reason.toLowerCase().includes('scale') ||
                evt.reason.toLowerCase().includes('scaling');
              const isWarning =
                evt.reason.toLowerCase().includes('unhealthy') ||
                evt.reason.toLowerCase().includes('fail') ||
                evt.reason.toLowerCase().includes('kill');

              // Highlight first 2 newest rows
              const isNewest = idx < 2;

              return (
                <div
                  key={`${evt.at}-${idx}`}
                  className={`grid grid-cols-12 gap-2 px-3 py-2 text-xs font-mono transition-colors ${
                    isNewest ? 'bg-signal/5' : 'hover:bg-surface/60'
                  }`}
                >
                  {/* Timestamp */}
                  <div className="col-span-2 sm:col-span-2 text-[11px] text-muted tabular-nums shrink-0">
                    {formatTime(evt.at)}
                  </div>

                  {/* Service Target Tag */}
                  <div className="col-span-2 sm:col-span-2">
                    <span className="px-1.5 py-0.2 rounded-[2px] border border-hairline bg-surface text-[10px] uppercase font-semibold text-ink">
                      {svcTag}
                    </span>
                  </div>

                  {/* Reason */}
                  <div className="col-span-3 sm:col-span-3">
                    <span
                      className={`inline-block px-1.5 py-0.2 rounded-[2px] text-[10px] font-medium border ${
                        isScale
                          ? 'border-signal/40 bg-signal/10 text-signal'
                          : isWarning
                          ? 'border-state-failed/40 bg-state-failed/10 text-state-failed'
                          : 'border-hairline bg-surface text-ink'
                      }`}
                    >
                      {evt.reason}
                    </span>
                  </div>

                  {/* Message */}
                  <div className="col-span-5 sm:col-span-5 text-[11px] text-ink break-words leading-relaxed">
                    {evt.message}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer Info */}
      <div className="flex items-center justify-between text-[10px] font-mono text-muted pt-1">
        <span>RECORD COUNT: {sortedEvents.length}</span>
        <span>EVENT STREAM: Kubernetes Kubelet & HPA Controller</span>
      </div>
    </div>
  );
};
