/**
 * Pure derived state and primary action for the reconnect dialog.
 * No React; easy to unit test.
 */

import type { ReconnectState } from "../reconnect-state.client";
import type { ConnectionWithCurrentSession } from "../signer/remote-signer-sessions-types";

export type ReconnectTab = "nostrconnect" | "bunker";

/** Session/connection view used by dialog (connection + currentSession). */
export type ReconnectSessionView = ConnectionWithCurrentSession;

const RETRY_ERROR_SUBSTRING = "Could not reconnect with existing connection";

export function getCanRetryExisting(
  state: ReconnectState,
  error: string | null,
  getActiveSession: () => ReconnectSessionView | null,
  getPendingReconnect: () => unknown
): boolean {
  if (state !== "idle") return false;
  if (!error?.includes(RETRY_ERROR_SUBSTRING)) return false;
  const view = getActiveSession();
  const config = view?.connection.config;
  const hasValidSession = config?.type === "nip46";
  if (!hasValidSession) return false;
  if (getPendingReconnect()) return false;
  return true;
}

export function getReconnectStartLabel(
  state: ReconnectState,
  tab: ReconnectTab,
  canRetryExisting: boolean,
  nostrConnectUri: string | null
): string {
  if (state === "reconnecting_existing") return "Reconnecting…";
  if (state === "waiting") return "Waiting for signer…";
  if (tab === "bunker") return "Connect signer";
  if (canRetryExisting) return "Try again with existing connection";
  return nostrConnectUri ? "Retry" : "Generate link";
}

export function getHandlePrimaryAction(
  canRetryExisting: boolean,
  tab: ReconnectTab,
  getPendingReconnect: () => unknown,
  getActiveSession: () => ReconnectSessionView | null,
  tryReconnectWithExistingConnection: (trigger: "manual_retry") => void,
  tryReconnectWithExistingBunkerConnection: (trigger: "manual_retry") => void,
  resumeReconnectWithPendingUri: () => void,
  connect: () => void
): () => void {
  return () => {
    if (canRetryExisting) {
      const view = getActiveSession();
      const config = view?.connection.config;
      if (config?.type === "nip46" && config.method === "bunker_input") {
        tryReconnectWithExistingBunkerConnection("manual_retry");
      } else {
        tryReconnectWithExistingConnection("manual_retry");
      }
    } else if (tab === "nostrconnect" && getPendingReconnect()) {
      resumeReconnectWithPendingUri();
    } else {
      connect();
    }
  };
}
