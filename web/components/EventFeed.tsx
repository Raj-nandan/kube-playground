'use client';

import React from 'react';
import { EventItem } from '../lib/types';
import { Bell, AlertCircle, CheckCircle2 } from 'lucide-react';

interface EventFeedProps {
  events: EventItem[];
}

export const EventFeed: React.FC<EventFeedProps> = ({ events }) => {
  return (
    <div className="bg-[#161b22] border border-[#30363d] rounded-xl p-4 shadow-sm">
      <div className="flex items-center space-x-2 mb-3">
        <Bell className="w-4 h-4 text-amber-400" />
        <h3 className="font-bold text-white text-sm">Cluster Scaling & Lifecycle Event Feed</h3>
      </div>

      <div className="max-h-56 overflow-y-auto space-y-2 pr-1">
        {events.length === 0 ? (
          <div className="text-gray-500 text-xs py-4 text-center">No recent events.</div>
        ) : (
          events.map((evt, idx) => {
            const isScale = evt.reason.includes('Scale') || evt.reason.includes('Scaling');
            const isWarning = evt.reason === 'Unhealthy' || evt.reason === 'Failed';

            return (
              <div
                key={idx}
                className="flex items-start space-x-2.5 text-xs bg-[#0d1117] p-2.5 rounded-lg border border-[#21262d] transition"
              >
                {isWarning ? (
                  <AlertCircle className="w-4 h-4 text-rose-400 mt-0.5 shrink-0" />
                ) : isScale ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
                ) : (
                  <Bell className="w-4 h-4 text-blue-400 mt-0.5 shrink-0" />
                )}

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-gray-200">{evt.reason}</span>
                    <span className="text-[10px] text-gray-500 font-mono shrink-0">
                      {new Date(evt.at).toLocaleTimeString()}
                    </span>
                  </div>
                  <p className="text-gray-400 mt-0.5 text-[11px] break-words">{evt.message}</p>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

