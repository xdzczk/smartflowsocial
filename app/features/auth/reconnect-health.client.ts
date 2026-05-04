/**
 * Connection-healthy event subscriber for the reconnect dialog.
 *
 * Used so the dialog can auto-close when the user starts the session in their
 * signer app and the existing connection comes back online (a real sign or
 * background reconnect dispatches `nostr-connection-healthy`).
 *
 * Previously this module also exposed periodic polling and an on-demand
 * refetch via `testConnection`, but no consumer used either path  -  Settings
 * has its own dedicated "Test connection" button and we deliberately do not
 * ping the bunker on a timer.
 */

import { useCallback, useEffect, useRef } from "react";

const NOSTR_CONNECTION_HEALTHY_EVENT = "nostr-connection-healthy";

export interface UseRemoteSignerHealthPollingOptions {
  /** When true, subscribe to nostr-connection-healthy and invoke onConnectionHealthy when fired. */
  subscribe?: boolean;
}

export function useRemoteSignerHealthPolling(
  options: UseRemoteSignerHealthPollingOptions = {}
): {
  onConnectionHealthy: (callback: () => void) => () => void;
} {
  const { subscribe = true } = options;
  const callbacksRef = useRef<Set<() => void>>(new Set());

  useEffect(() => {
    if (!subscribe || typeof window === "undefined") return;
    const handleConnectionHealthy = () => {
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

  const onConnectionHealthy = useCallback((listener: () => void) => {
    callbacksRef.current.add(listener);
    return () => callbacksRef.current.delete(listener);
  }, []);

  return { onConnectionHealthy };
}

export { NOSTR_CONNECTION_HEALTHY_EVENT };
