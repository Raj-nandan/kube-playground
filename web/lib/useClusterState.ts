'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { StateDocument } from './types';

export function useClusterState(apiUrl = '') {
  const [state, setState] = useState<StateDocument | null>(null);
  const [connected, setConnected] = useState<boolean>(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const isMountedRef = useRef<boolean>(true);

  const fetchState = useCallback(async () => {
    try {
      const url = apiUrl ? `${apiUrl}/state` : '/api/state';
      const res = await fetch(url, { cache: 'no-store' });
      if (res.ok) {
        const data: StateDocument = await res.json();
        if (isMountedRef.current) {
          setState(data);
          setLastUpdated(new Date());
          setConnected(true);
        }
      }
    } catch {
      // Ignore network errors during background polling
    }
  }, [apiUrl]);

  useEffect(() => {
    isMountedRef.current = true;
    let eventSource: EventSource | null = null;
    let retryTimeout: NodeJS.Timeout;
    let fallbackPoller: NodeJS.Timeout;

    // 1. Fetch state immediately on mount (instant display on refresh)
    fetchState();

    // 2. Connect to real-time Server-Sent Events stream
    function connectSSE() {
      const streamUrl = apiUrl ? `${apiUrl}/stream` : '/api/stream';
      try {
        eventSource = new EventSource(streamUrl);

        eventSource.onopen = () => {
          if (isMountedRef.current) setConnected(true);
        };

        eventSource.onmessage = (event) => {
          try {
            const data: StateDocument = JSON.parse(event.data);
            if (isMountedRef.current) {
              setState(data);
              setLastUpdated(new Date());
              setConnected(true);
            }
          } catch (err) {
            console.error('Failed to parse SSE state:', err);
          }
        };

        eventSource.onerror = () => {
          if (isMountedRef.current) setConnected(false);
          eventSource?.close();
          retryTimeout = setTimeout(connectSSE, 3000);
        };
      } catch {
        retryTimeout = setTimeout(connectSSE, 3000);
      }
    }

    connectSSE();

    // 3. Fallback continuous polling every 1.5s so UI is always in sync
    fallbackPoller = setInterval(fetchState, 1500);

    return () => {
      isMountedRef.current = false;
      eventSource?.close();
      clearTimeout(retryTimeout);
      clearInterval(fallbackPoller);
    };
  }, [apiUrl, fetchState]);

  return { state, connected, lastUpdated, refresh: fetchState };
}

