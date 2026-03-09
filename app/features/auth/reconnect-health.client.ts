/**
 * Connection health for reconnect flow: event subscription and optional polling.
 * Use when dialog needs to close on external reconnect (e.g. user started session in Primal).
 */

import { useCallback, useEffect, useRef, useState } from "react";

import { testConnection } from "~/lib/remote-signer-health.client";
import { getActiveConnection } from "~/lib/remote-signer-sessions.client";
import type { RemoteSignerConnection } from "~/lib/remote-signer-sessions.client";

const NOSTR_CONNECTION_HEALTHY_EVENT = "nostr-connection-healthy";

export interface UseRemoteSignerHealthPollingOptions {
  /** When true, subscribe to nostr-connection-healthy and invoke onConnectionHealthy when fired. */
  subscribe?: boolean;
  /** Polling interval in ms; 0 or undefined = no polling. */
  pollIntervalMs?: number;
}

export interface RemoteSignerHealthResult {
  connectionStatus: RemoteSignerConnection | null;
  lastChecked: number | null;
  healthy: boolean | null;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useRemoteSignerHealthPolling(
  options: UseRemoteSignerHealthPollingOptions = {}
): RemoteSignerHealthResult & {
  onConnectionHealthy: (callback: () => void) => () => void;
} {
  const { subscribe = true, pollIntervalMs } = options;
  const [connectionStatus, setConnectionStatus] =
    useState<RemoteSignerConnection | null>(null);
  const [lastChecked, setLastChecked] = useState<number | null>(null);
  const [healthy, setHealthy] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const callbacksRef = useRef<Set<() => void>>(new Set());

  const refetch = useCallback(async () => {
    const conn = getActiveConnection();
    setConnectionStatus(conn);
    if (!conn) {
      setHealthy(false);
      setError(null);
      setLastChecked(Date.now());
      return;
    }
    try {
      const result = await testConnection(3000, {
        tryReconnectIfDisconnected: false,
      });
      setHealthy(result.healthy);
      setError(result.error ?? null);
      setLastChecked(Date.now());
    } catch (e) {
      setHealthy(false);
      setError(e instanceof Error ? e.message : String(e));
      setLastChecked(Date.now());
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => setConnectionStatus(getActiveConnection()));
  }, []);

  useEffect(() => {
    if (!subscribe || typeof window === "undefined") return;
    const handleConnectionHealthy = () => {
      setConnectionStatus(getActiveConnection());
      setHealthy(true);
      setError(null);
      setLastChecked(Date.now());
      for (const notify of callbacksRef.current) {
        notify();
      }
    };
    window.addEventListener(
      NOSTR_CONNECTION_HEALTHY_EVENT,
      handleConnectionHealthy
    );
    return () => {
      window.removeEventListener(
        NOSTR_CONNECTION_HEALTHY_EVENT,
        handleConnectionHealthy
      );
    };
  }, [subscribe]);

  useEffect(() => {
    if (!pollIntervalMs || pollIntervalMs <= 0) return;
    const id = setInterval(() => {
      void refetch();
    }, pollIntervalMs);
    return () => clearInterval(id);
  }, [pollIntervalMs, refetch]);

  const onConnectionHealthy = useCallback((listener: () => void) => {
    callbacksRef.current.add(listener);
    return () => callbacksRef.current.delete(listener);
  }, []);

  return {
    connectionStatus,
    lastChecked,
    healthy,
    error,
    refetch,
    onConnectionHealthy,
  };
}

export { NOSTR_CONNECTION_HEALTHY_EVENT };
