/**
 * Remote signer sessions: public facade.
 * Re-exports CRUD, matching, and detect; implements session/event wiring.
 */

import { STORAGE_KEY as ACTIVE_SIGNER_CONFIG_STORAGE_KEY } from "./nostr-signer-storage.client";
import {
  getAllConnections,
  getConnectionById,
  getActiveConnectionId,
  endCurrentSessionForConnection,
  updateConnection,
  setActiveConnection,
  clearActiveConnection,
  removeConnection,
  createConnection,
  getConnectionWithCurrentSession,
} from "./remote-signer-sessions-crud.client";
import { setCurrentUserNpub as storageSetCurrentUserNpub } from "./remote-signer-sessions-storage.client";
import type { ConnectionWithCurrentSession } from "./remote-signer-sessions-types";
import { ACTIVE_SESSION_CHANGED_EVENT } from "./remote-signer-sessions-types";

// Re-export types for consumers
export type {
  ConnectionStatus,
  ConnectionLogEntry,
  RemoteSignerConnectionMetadata,
  RemoteSignerConnection,
  RemoteSignerSessionRecord,
  RemoteSignerSession,
  ConnectionWithCurrentSession,
} from "./remote-signer-sessions-types";
export type { MatchOrCreateSessionOptions } from "./remote-signer-sessions-types";

// Re-export from CRUD
export {
  getAllConnections,
  getActiveConnection,
  getActiveConnectionId,
  getConnectionById,
  getSessionsForConnection,
  getSessionById,
  getCurrentSessionForConnection,
  startNewSessionForConnection,
  endCurrentSessionForConnection,
  createConnection,
  updateConnection,
  updateSessionRecord,
  removeConnection,
  setActiveConnection,
  clearActiveConnection,
  addConnectionLog,
  getSessionHistory,
  getConnectionWithCurrentSession,
  getActiveConnectionWithCurrentSession,
  getAllSessions,
  getActiveSession,
  getSessionByIdLegacy,
  getConnectionHistory,
} from "./remote-signer-sessions-crud.client";

// Re-export from matching
export {
  findMatchingConnectionForConfig,
  findMatchingSessionForConfig,
  matchOrCreateConnection,
  matchOrCreateSession,
} from "./remote-signer-sessions-matching.client";

// Re-export from detect
export {
  detectSignerAppName,
  maskConnectionUri,
} from "./remote-signer-sessions-detect.client";

export function setCurrentUserNpub(npub: string | null): void {
  storageSetCurrentUserNpub(npub);
}

export function createSession(
  config: Parameters<typeof createConnection>[0],
  label?: string
): ConnectionWithCurrentSession {
  const defaultLabel = label ?? `Session ${getAllConnections().length + 1}`;
  const conn = createConnection(config, defaultLabel);
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("remote-signer-session-created", {
        detail: { connectionId: conn.id, sessionId: conn.id },
      })
    );
  }
  return (
    getConnectionWithCurrentSession(conn.id) ?? {
      connection: conn,
      currentSession: null,
    }
  );
}

/** Legacy: update connection by id (label, config, metadata). */
export function updateSession(
  id: string,
  updates: Parameters<typeof updateConnection>[1]
): void {
  const conn = getConnectionById(id);
  if (!conn) return;
  updateConnection(id, updates);
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("remote-signer-session-updated", {
        detail: { connectionId: id, sessionId: id },
      })
    );
  }
}

export function setActiveSession(id: string): void {
  const conn = getConnectionById(id);
  if (!conn) return;
  const previousId = getActiveConnectionId();
  if (previousId && previousId !== id) {
    const oldConn = getConnectionById(previousId);
    if (oldConn?.metadata.status === "active") {
      endCurrentSessionForConnection(previousId);
      updateConnection(previousId, {
        metadata: {
          ...oldConn.metadata,
          status: "disconnected",
          updatedAt: Date.now(),
        },
      });
      void (async () => {
        const mod =
          await import("~/features/auth/signer/remote-signer-status.client");
        mod.recordConnectionEvent(previousId, {
          type: "disconnected",
          reason: "Switched to different session",
        });
      })();
    }
  }
  setActiveConnection(id);
  if (typeof window !== "undefined" && typeof localStorage !== "undefined") {
    try {
      localStorage.setItem(
        ACTIVE_SIGNER_CONFIG_STORAGE_KEY,
        JSON.stringify(conn.config)
      );
    } catch {
      // ignore
    }
  }
  if (
    typeof window !== "undefined" &&
    previousId != null &&
    previousId !== id
  ) {
    setTimeout(() => {
      void (async () => {
        const mod =
          await import("~/features/auth/signer/nostr-signer-manager.client");
        mod.resetCachedSigner();
      })();
    }, 0);
  }
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent(ACTIVE_SESSION_CHANGED_EVENT, {
        detail: { connectionId: id, sessionId: id },
      })
    );
  }
}

export function clearActiveSession(): void {
  clearActiveConnection();
  if (typeof window !== "undefined" && typeof localStorage !== "undefined") {
    try {
      localStorage.removeItem(ACTIVE_SIGNER_CONFIG_STORAGE_KEY);
    } catch {
      // ignore
    }
  }
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent(ACTIVE_SESSION_CHANGED_EVENT, {
        detail: { connectionId: null, sessionId: null },
      })
    );
  }
}

export function removeSession(id: string): void {
  const wasActive = getActiveConnectionId() === id;
  removeConnection(id);
  if (wasActive) {
    if (typeof window !== "undefined" && typeof localStorage !== "undefined") {
      try {
        localStorage.removeItem(ACTIVE_SIGNER_CONFIG_STORAGE_KEY);
      } catch {
        // ignore
      }
    }
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent(ACTIVE_SESSION_CHANGED_EVENT, {
          detail: { connectionId: null, sessionId: null },
        })
      );
    }
  }
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("remote-signer-session-removed", {
        detail: { connectionId: id, sessionId: id },
      })
    );
  }
}
