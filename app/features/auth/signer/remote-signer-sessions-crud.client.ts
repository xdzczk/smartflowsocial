/**
 * Remote signer sessions: storage CRUD and legacy session view.
 * Used by remote-signer-sessions (facade) and remote-signer-sessions-matching.
 */

import type { ActiveSignerConfig } from "./nostr-signer-storage.client";
import {
  getStorage,
  updateStorage,
  generateId,
} from "./remote-signer-sessions-storage.client";
import type {
  ConnectionLogEntry,
  RemoteSignerConnection,
  RemoteSignerSessionRecord,
  ConnectionWithCurrentSession,
} from "./remote-signer-sessions-types";
import {
  MAX_HISTORY_ENTRIES,
  MAX_SESSIONS_PER_CONNECTION,
  ACTIVE_SESSION_CHANGED_EVENT,
  ACTIVE_CONNECTION_CHANGED_EVENT,
} from "./remote-signer-sessions-types";

export function getConnectionWithCurrentSession(
  connectionId: string
): ConnectionWithCurrentSession | null {
  const conn = getConnectionById(connectionId);
  if (!conn) return null;
  const currentSession = getCurrentSessionForConnection(conn.id);
  return { connection: conn, currentSession };
}

export function getActiveConnectionWithCurrentSession(): ConnectionWithCurrentSession | null {
  const conn = getActiveConnection();
  if (!conn) return null;
  const currentSession = getCurrentSessionForConnection(conn.id);
  return { connection: conn, currentSession };
}

export function getAllConnections(): RemoteSignerConnection[] {
  const storage = getStorage();
  return storage.connections;
}

export function getActiveConnection(): RemoteSignerConnection | null {
  const storage = getStorage();
  if (!storage.activeConnectionId) return null;
  return (
    storage.connections.find((c) => c.id === storage.activeConnectionId) ?? null
  );
}

export function getActiveConnectionId(): string | null {
  return getStorage().activeConnectionId;
}

export function getConnectionById(id: string): RemoteSignerConnection | null {
  const storage = getStorage();
  return storage.connections.find((c) => c.id === id) ?? null;
}

export function getSessionsForConnection(
  connectionId: string,
  limit = MAX_SESSIONS_PER_CONNECTION
): RemoteSignerSessionRecord[] {
  const storage = getStorage();
  const list = storage.sessions
    .filter((s) => s.connectionId === connectionId)
    .sort((a, b) => b.startedAt - a.startedAt);
  return list.slice(0, limit);
}

export function getSessionById(
  sessionId: string
): RemoteSignerSessionRecord | null {
  const storage = getStorage();
  return storage.sessions.find((s) => s.id === sessionId) ?? null;
}

export function getCurrentSessionForConnection(
  connectionId: string
): RemoteSignerSessionRecord | null {
  const conn = getConnectionById(connectionId);
  if (!conn?.currentSessionId) return null;
  const session = getSessionById(conn.currentSessionId);
  if (session?.connectionId !== connectionId) return null;
  if (session.endedAt != null) return null;
  return session;
}

export function startNewSessionForConnection(
  connectionId: string
): RemoteSignerSessionRecord {
  return updateStorage((storage) => {
    const conn = storage.connections.find((c) => c.id === connectionId);
    if (!conn) {
      throw new Error(`Connection not found: ${connectionId}`);
    }
    const now = Date.now();
    const session: RemoteSignerSessionRecord = {
      id: generateId(),
      connectionId,
      startedAt: now,
      endedAt: null,
      history: [],
    };
    storage.sessions.push(session);
    const cap = MAX_SESSIONS_PER_CONNECTION;
    const forConn = storage.sessions
      .filter((s) => s.connectionId === connectionId)
      .sort((a, b) => b.startedAt - a.startedAt);
    if (forConn.length > cap) {
      const toRemove = forConn.slice(cap).map((s) => s.id);
      storage.sessions = storage.sessions.filter(
        (s) => s.connectionId !== connectionId || !toRemove.includes(s.id)
      );
    }
    (conn as { currentSessionId: string | null }).currentSessionId = session.id;
    return session;
  });
}

export function endCurrentSessionForConnection(connectionId: string): void {
  updateStorage((storage) => {
    const conn = storage.connections.find((c) => c.id === connectionId);
    if (!conn?.currentSessionId) return;
    const session = storage.sessions.find(
      (s) => s.id === conn.currentSessionId && s.connectionId === connectionId
    );
    if (session) {
      session.endedAt = Date.now();
    }
    (conn as { currentSessionId: string | null }).currentSessionId = null;
  });
}

export function createConnection(
  config: ActiveSignerConfig,
  label: string
): RemoteSignerConnection {
  return updateStorage((storage) => {
    const now = Date.now();
    const conn: RemoteSignerConnection = {
      id: generateId(),
      label,
      config,
      metadata: {
        status: "disconnected",
        signerAppName: null,
        pubkey: null,
        relays: [],
        connectedAt: null,
        lastActivityAt: null,
        lastError: null,
        createdAt: now,
        updatedAt: now,
      },
      currentSessionId: null,
    };
    storage.connections.push(conn);
    return conn;
  });
}

export function updateConnection(
  connectionId: string,
  updates: Partial<
    Pick<RemoteSignerConnection, "label" | "config" | "metadata">
  >
): void {
  updateStorage((storage) => {
    const conn = storage.connections.find((c) => c.id === connectionId);
    if (!conn) return;
    if (updates.label !== undefined) conn.label = updates.label;
    if (updates.config !== undefined) conn.config = updates.config;
    if (updates.metadata !== undefined) {
      conn.metadata = {
        ...conn.metadata,
        ...updates.metadata,
        updatedAt: Date.now(),
      };
    }
  });
}

export function updateSessionRecord(
  sessionId: string,
  updates: Partial<Pick<RemoteSignerSessionRecord, "endedAt">>
): void {
  updateStorage((storage) => {
    const session = storage.sessions.find((s) => s.id === sessionId);
    if (!session) return;
    if (updates.endedAt !== undefined) session.endedAt = updates.endedAt;
  });
}

export function removeConnection(connectionId: string): void {
  updateStorage((storage) => {
    storage.connections = storage.connections.filter(
      (c) => c.id !== connectionId
    );
    storage.sessions = storage.sessions.filter(
      (s) => s.connectionId !== connectionId
    );
    if (storage.activeConnectionId === connectionId) {
      storage.activeConnectionId = null;
    }
  });
}

export function setActiveConnection(connectionId: string | null): void {
  updateStorage((storage) => {
    storage.activeConnectionId = connectionId;
  });
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent(ACTIVE_CONNECTION_CHANGED_EVENT, { detail: connectionId })
    );
    window.dispatchEvent(
      new CustomEvent(ACTIVE_SESSION_CHANGED_EVENT, { detail: connectionId })
    );
  }
}

export function clearActiveConnection(): void {
  setActiveConnection(null);
}

/** Append a log entry to the current session of the given connection; creates session if needed. */
export function addConnectionLog(
  connectionId: string,
  entry: Omit<ConnectionLogEntry, "id" | "timestamp">
): void {
  const withMeta: ConnectionLogEntry = {
    ...entry,
    id: generateId(),
    timestamp: Date.now(),
  };
  updateStorage((storage) => {
    const conn = storage.connections.find((c) => c.id === connectionId);
    if (!conn) return;
    let session = conn.currentSessionId
      ? storage.sessions.find(
          (s) =>
            s.id === conn.currentSessionId && s.connectionId === connectionId
        )
      : null;
    if (!session) {
      const newSession: RemoteSignerSessionRecord = {
        id: generateId(),
        connectionId,
        startedAt: withMeta.timestamp,
        endedAt: null,
        history: [],
      };
      storage.sessions.push(newSession);
      (conn as { currentSessionId: string | null }).currentSessionId =
        newSession.id;
      session = newSession;
      const forConn = storage.sessions
        .filter((s) => s.connectionId === connectionId)
        .sort((a, b) => b.startedAt - a.startedAt);
      if (forConn.length > MAX_SESSIONS_PER_CONNECTION) {
        const toRemove = forConn
          .slice(MAX_SESSIONS_PER_CONNECTION)
          .map((s) => s.id);
        storage.sessions = storage.sessions.filter(
          (s) => s.connectionId !== connectionId || !toRemove.includes(s.id)
        );
      }
    }
    session.history.push(withMeta);
    if (session.history.length > MAX_HISTORY_ENTRIES) {
      session.history = session.history.slice(-MAX_HISTORY_ENTRIES);
    }
  });
}

export function getSessionHistory(
  sessionId: string,
  limit = MAX_HISTORY_ENTRIES
): ConnectionLogEntry[] {
  const session = getSessionById(sessionId);
  if (!session) return [];
  return session.history.slice(-limit);
}

export function getAllSessions(): ConnectionWithCurrentSession[] {
  const storage = getStorage();
  return storage.connections.map((conn) => {
    const current = conn.currentSessionId
      ? storage.sessions.find(
          (s) => s.id === conn.currentSessionId && s.connectionId === conn.id
        )
      : null;
    return { connection: conn, currentSession: current ?? null };
  });
}

export function getActiveSession(): ConnectionWithCurrentSession | null {
  return getActiveConnectionWithCurrentSession();
}

/** Get connection + current session by connection id. Prefer getConnectionWithCurrentSession. */
export function getSessionByIdLegacy(
  id: string
): ConnectionWithCurrentSession | null {
  return getConnectionWithCurrentSession(id);
}

/** Returns history for the current session of the given connection (legacy: id was connection id). */
export function getConnectionHistory(
  connectionId: string,
  limit = MAX_HISTORY_ENTRIES
): ConnectionLogEntry[] {
  const session = getCurrentSessionForConnection(connectionId);
  if (!session) return [];
  const history = session.history;
  return limit ? history.slice(-limit) : history;
}
