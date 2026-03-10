/**
 * Relay connectivity check: open WebSockets, report status per URL.
 * Used by NostrLoginPanel (and optionally elsewhere) to show relay status before NIP-46 connect.
 */

import { useCallback, useRef } from "react";

import type { RelayStatus } from "./login-flow.client";

const RELAY_CHECK_TIMEOUT_MS = 2500;

export function useRelayCheck(
  setRelayStatuses: React.Dispatch<
    React.SetStateAction<Record<string, RelayStatus>>
  >
): {
  startRelayChecks: (relays: string[]) => void;
  closeRelaySockets: () => void;
} {
  const relayCheckAttemptIdRef = useRef(0);
  const relaySocketsRef = useRef<Map<string, WebSocket>>(new Map());

  const closeRelaySockets = useCallback(() => {
    relayCheckAttemptIdRef.current += 1;
    relaySocketsRef.current.forEach((ws) => {
      try {
        ws.close();
      } catch {
        // ignore
      }
    });
    relaySocketsRef.current.clear();
  }, []);

  const startRelayChecks = useCallback(
    (relays: string[]) => {
      if (typeof window === "undefined") return;
      const attemptId = (relayCheckAttemptIdRef.current += 1);

      relaySocketsRef.current.forEach((ws) => {
        try {
          ws.close();
        } catch {
          // ignore
        }
      });
      relaySocketsRef.current.clear();

      const now = Date.now();
      setRelayStatuses(
        Object.fromEntries(
          relays.map((url) => [
            url,
            { url, status: "checking", checkedAt: now } satisfies RelayStatus,
          ])
        )
      );

      for (const url of relays) {
        try {
          const ws = new WebSocket(url);
          relaySocketsRef.current.set(url, ws);

          let opened = false;
          let closedByUs = false;

          const timeout = window.setTimeout(() => {
            if (attemptId !== relayCheckAttemptIdRef.current) return;
            if (opened) return;
            setRelayStatuses((prev) => ({
              ...prev,
              [url]: {
                url,
                status: "failed",
                checkedAt: Date.now(),
                error: "Timed out while connecting",
              },
            }));
            try {
              closedByUs = true;
              ws.close();
            } catch {
              // ignore
            }
          }, RELAY_CHECK_TIMEOUT_MS);

          ws.onopen = () => {
            opened = true;
            window.clearTimeout(timeout);
            if (attemptId !== relayCheckAttemptIdRef.current) {
              try {
                closedByUs = true;
                ws.close();
              } catch {
                // ignore
              }
              return;
            }
            setRelayStatuses((prev) => ({
              ...prev,
              [url]: { url, status: "connected", checkedAt: Date.now() },
            }));
            try {
              closedByUs = true;
              ws.close();
            } catch {
              // ignore
            }
          };

          ws.onerror = () => {
            window.clearTimeout(timeout);
            if (attemptId !== relayCheckAttemptIdRef.current) return;
            setRelayStatuses((prev) => ({
              ...prev,
              [url]: {
                url,
                status: "failed",
                checkedAt: Date.now(),
                error: "Connection error",
              },
            }));
          };

          ws.onclose = (ev) => {
            window.clearTimeout(timeout);
            if (attemptId !== relayCheckAttemptIdRef.current) return;
            if (opened) return;
            if (closedByUs) return;
            const reason = ev.reason ? ` (${ev.reason})` : "";
            setRelayStatuses((prev) => ({
              ...prev,
              [url]: {
                url,
                status: "failed",
                checkedAt: Date.now(),
                error: `Closed before connect (code ${ev.code})${reason}`,
              },
            }));
          };
        } catch (e) {
          if (attemptId !== relayCheckAttemptIdRef.current) return;
          const msg =
            e instanceof Error ? e.message : "Failed to create WebSocket";
          setRelayStatuses((prev) => ({
            ...prev,
            [url]: {
              url,
              status: "failed",
              checkedAt: Date.now(),
              error: msg,
            },
          }));
        }
      }
    },
    [setRelayStatuses]
  );

  return { startRelayChecks, closeRelaySockets };
}
