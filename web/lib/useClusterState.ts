'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { StateDocument } from './types';

export function useClusterState(apiUrl = '') {
  const [state, setState] = useState<StateDocument | null>(null);
  const [connected, setConnected] = useState<boolean>(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const isMountedRef = useRef<boolean>(true);
  const fallbackPollerRef = useRef<NodeJS.Timeout | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const retryDelayRef = useRef<number>(2000); // Exponential backoff starts at 2s

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

  const stopFallbackPoller = useCallback(() => {
    if (fallbackPollerRef.current) {
      clearInterval(fallbackPollerRef.current);
      fallbackPollerRef.current = null;
    }
  }, []);

  const startFallbackPoller = useCallback(() => {
    if (!fallbackPollerRef.current && isMountedRef.current) {
      // Emergency polling only while disconnected
      fallbackPollerRef.current = setInterval(fetchState, 3000);
    }
  }, [fetchState]);

  const disconnectSSE = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }
  }, []);

  const connectSSE = useCallback(() => {
    // Avoid duplicate connections or connecting if unmounted
    if (eventSourceRef.current || !isMountedRef.current) return;
    // Don't open streams if document is backgrounded/hidden
    if (typeof document !== 'undefined' && document.hidden) return;

    const streamUrl = apiUrl ? `${apiUrl}/stream` : '/api/stream';

    try {
      const es = new EventSource(streamUrl);
      eventSourceRef.current = es;

      es.onopen = () => {
        if (!isMountedRef.current) return;
        setConnected(true);
        retryDelayRef.current = 2000; // Reset backoff delay on successful connection
        stopFallbackPoller(); // STOP all polling: SSE push stream is healthy!
      };

      es.onmessage = (event) => {
        if (!isMountedRef.current) return;
        try {
          const data: StateDocument = JSON.parse(event.data);
          setState(data);
          setLastUpdated(new Date());
          setConnected(true);
        } catch (err) {
          console.error('Failed to parse SSE state:', err);
        }
      };

      es.onerror = () => {
        if (!isMountedRef.current) return;
        setConnected(false);
        disconnectSSE();

        // Start fallback poller only while SSE is disconnected
        startFallbackPoller();

        // Schedule reconnection with exponential backoff (capped at 10s)
        const delay = retryDelayRef.current;
        retryDelayRef.current = Math.min(10000, delay * 1.5);
        retryTimeoutRef.current = setTimeout(connectSSE, delay);
      };
    } catch {
      startFallbackPoller();
      retryTimeoutRef.current = setTimeout(connectSSE, 3000);
    }
  }, [apiUrl, disconnectSSE, startFallbackPoller, stopFallbackPoller]);

  useEffect(() => {
    isMountedRef.current = true;

    // 1. Initial snapshot fetch on mount for instant UI display
    fetchState();

    // 2. Connect to real-time SSE push stream
    connectSSE();

    // 3. Page Visibility API: sleep when tab is in background, wake up on return
    const handleVisibilityChange = () => {
      if (document.hidden) {
        // Tab inactive: close stream and cancel poller to save CPU & tunnel bandwidth
        disconnectSSE();
        stopFallbackPoller();
      } else {
        // Tab active again: fetch fresh state and reconnect stream immediately
        fetchState();
        connectSSE();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      isMountedRef.current = false;
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      disconnectSSE();
      stopFallbackPoller();
    };
  }, [connectSSE, disconnectSSE, fetchState, startFallbackPoller, stopFallbackPoller]);

  return { state, connected, lastUpdated, refresh: fetchState };
}
