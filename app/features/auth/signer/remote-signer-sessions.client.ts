/**
 * Remote signer sessions: public CRUD and legacy session API.
 * Types and storage live in remote-signer-sessions-types and remote-signer-sessions-storage.
 */

import { convertToHex } from "~/lib/nostr-conversion";

import type { ActiveSignerConfig } from "./nostr-signer-storage.client";
import {
  getStorage,
  updateStorage,
  setCurrentUserNpub as storageSetCurrentUserNpub,
  generateId,
} from "./remote-signer-sessions-storage.client";
import type {
  ConnectionLogEntry,
  RemoteSignerConnection,
  RemoteSignerSession,
  RemoteSignerSessionRecord,
  MatchOrCreateSessionOptions,
} from "./remote-signer-sessions-types";
import {
  MAX_HISTORY_ENTRIES,
  MAX_SESSIONS_PER_CONNECTION,
  ACTIVE_SESSION_CHANGED_EVENT,
  ACTIVE_CONNECTION_CHANGED_EVENT,
} from "./remote-signer-sessions-types";

// Re-export types for consumers
export type {
  ConnectionStatus,
  ConnectionLogEntry,
  RemoteSignerConnectionMetadata,
  RemoteSignerConnection,
  RemoteSignerSessionRecord,
  RemoteSignerSession,
} from "./remote-signer-sessions-types";
export type { MatchOrCreateSessionOptions } from "./remote-signer-sessions-types";

export function setCurrentUserNpub(npub: string | null): void {
  storageSetCurrentUserNpub(npub);
}

function connectionToLegacyView(
  conn: RemoteSignerConnection,
  currentSession: RemoteSignerSessionRecord | null
): RemoteSignerSession {
  return {
    id: conn.id,
    label: conn.label,
    config: conn.config,
    metadata: conn.metadata,
    history: currentSession?.history ?? [],
  };
}

// ---------- New connection/session APIs ----------

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

// ---------- Legacy session APIs (connection + current session view) ----------

export function getAllSessions(): RemoteSignerSession[] {
  const storage = getStorage();
  return storage.connections.map((conn) => {
    const current = conn.currentSessionId
      ? storage.sessions.find(
          (s) => s.id === conn.currentSessionId && s.connectionId === conn.id
        )
      : null;
    return connectionToLegacyView(conn, current ?? null);
  });
}

export function getActiveSession(): RemoteSignerSession | null {
  const conn = getActiveConnection();
  if (!conn) return null;
  const current = getCurrentSessionForConnection(conn.id);
  return connectionToLegacyView(conn, current);
}

export function getSessionByIdLegacy(id: string): RemoteSignerSession | null {
  const conn = getConnectionById(id);
  if (!conn) return null;
  const current = getCurrentSessionForConnection(conn.id);
  return connectionToLegacyView(conn, current);
}

function normalizePubkeyHex(pubkey: string | null | undefined): string | null {
  if (!pubkey) {
    return null;
  }
  const normalized = convertToHex(pubkey) ?? pubkey;
  const trimmed = normalized.trim().toLowerCase();
  return /^[0-9a-f]{64}$/.test(trimmed) ? trimmed : null;
}

function normalizeUriForIdentity(uri: string): string {
  const trimmed = uri.trim();
  try {
    const parsed = new URL(trimmed);
    parsed.searchParams.delete("callback");
    const next = new URLSearchParams();
    const entries = Array.from(parsed.searchParams.entries()).sort(([a], [b]) =>
      a.localeCompare(b)
    );
    for (const [key, value] of entries) {
      next.append(key, value);
    }
    const normalizedQuery = next.toString();
    return `${parsed.protocol}//${parsed.host}${parsed.pathname}${normalizedQuery ? `?${normalizedQuery}` : ""}`;
  } catch {
    return trimmed;
  }
}

function isConfigEquivalent(
  existing: ActiveSignerConfig,
  incoming: ActiveSignerConfig
): boolean {
  if (existing.type !== "nip46" || incoming.type !== "nip46") {
    return false;
  }
  if (existing.method !== incoming.method) {
    return false;
  }
  if (
    existing.method === "nostrconnect_uri" &&
    incoming.method === "nostrconnect_uri"
  ) {
    return (
      normalizeUriForIdentity(existing.uri) ===
        normalizeUriForIdentity(incoming.uri) &&
      existing.clientSecretKeyHex === incoming.clientSecretKeyHex
    );
  }
  if (
    existing.method === "bunker_input" &&
    incoming.method === "bunker_input"
  ) {
    return (
      existing.bunkerInput.trim() === incoming.bunkerInput.trim() &&
      existing.clientSecretKeyHex === incoming.clientSecretKeyHex
    );
  }
  return false;
}

function getLatestConnection(
  connections: RemoteSignerConnection[]
): RemoteSignerConnection | null {
  if (connections.length === 0) return null;
  return connections.reduce((latest, c) =>
    c.metadata.updatedAt > latest.metadata.updatedAt ? c : latest
  );
}

export function findMatchingConnectionForConfig(
  config: ActiveSignerConfig,
  signerPubkey?: string | null
): RemoteSignerConnection | null {
  const connections = getAllConnections();
  if (config.type !== "nip46") return null;
  const pubkeyHex = normalizePubkeyHex(signerPubkey);
  if (pubkeyHex) {
    const byPubkey = connections.filter((c) => {
      if (c.config.type !== "nip46" || c.config.method !== config.method)
        return false;
      return normalizePubkeyHex(c.metadata.pubkey) === pubkeyHex;
    });
    const latest = getLatestConnection(byPubkey);
    if (latest) return latest;
  }
  const byConfig = connections.filter((c) =>
    isConfigEquivalent(c.config, config)
  );
  return getLatestConnection(byConfig);
}

export function findMatchingSessionForConfig(
  config: ActiveSignerConfig,
  signerPubkey?: string | null
): RemoteSignerSession | null {
  const conn = findMatchingConnectionForConfig(config, signerPubkey);
  if (!conn) return null;
  return getSessionByIdLegacy(conn.id);
}

export function matchOrCreateConnection(
  config: ActiveSignerConfig,
  options?: MatchOrCreateSessionOptions
): RemoteSignerConnection {
  const existing = findMatchingConnectionForConfig(
    config,
    options?.signerPubkey
  );
  if (existing) {
    const updates: Partial<Pick<RemoteSignerConnection, "label" | "config">> =
      {};
    if (options?.label && existing.label !== options.label)
      updates.label = options.label;
    if (existing.config !== config) updates.config = config;
    if (Object.keys(updates).length > 0) {
      updateConnection(existing.id, updates);
      return getConnectionById(existing.id) ?? { ...existing, ...updates };
    }
    return existing;
  }
  return createConnection(
    config,
    options?.label ?? `Connection ${getAllConnections().length + 1}`
  );
}

export function matchOrCreateSession(
  config: ActiveSignerConfig,
  options?: MatchOrCreateSessionOptions
): RemoteSignerSession {
  const conn = matchOrCreateConnection(config, options);
  return getSessionByIdLegacy(conn.id) ?? connectionToLegacyView(conn, null);
}

export function createSession(
  config: ActiveSignerConfig,
  label?: string
): RemoteSignerSession {
  const defaultLabel = label ?? `Session ${getAllConnections().length + 1}`;
  const conn = createConnection(config, defaultLabel);
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("remote-signer-session-created", {
        detail: { connectionId: conn.id, sessionId: conn.id },
      })
    );
  }
  return getSessionByIdLegacy(conn.id) ?? connectionToLegacyView(conn, null);
}

/** Legacy: update connection by id (label, config, metadata). */
export function updateSession(
  id: string,
  updates: Partial<Pick<RemoteSignerSession, "label" | "config" | "metadata">>
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
  if (typeof window !== "undefined" && typeof sessionStorage !== "undefined") {
    try {
      sessionStorage.setItem(
        "__smartflow_active_nostr_signer_v1",
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
  if (typeof window !== "undefined" && typeof sessionStorage !== "undefined") {
    try {
      sessionStorage.removeItem("__smartflow_active_nostr_signer_v1");
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
    if (
      typeof window !== "undefined" &&
      typeof sessionStorage !== "undefined"
    ) {
      try {
        sessionStorage.removeItem("__smartflow_active_nostr_signer_v1");
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

function detectAppFromHostname(hostname: string): string | null {
  const lowerHostname = hostname.toLowerCase();
  if (lowerHostname.includes("primal")) {
    return "Primal";
  }
  if (lowerHostname.includes("damus")) {
    return "Damus";
  }
  if (lowerHostname.includes("amethyst")) {
    return "Amethyst";
  }
  if (lowerHostname.includes("snort")) {
    return "Snort";
  }
  return null;
}

function detectFromBunkerInput(bunkerInput: string): string | null {
  try {
    const url = new URL(bunkerInput);
    return detectAppFromHostname(url.hostname);
  } catch {
    return null;
  }
}

function detectFromNostrConnectUri(
  uri: string,
  relays: string[]
): string | null {
  try {
    const url = new URL(uri);
    const name = url.searchParams.get("name");
    if (name) {
      return name;
    }

    for (const relay of relays) {
      const appName = detectAppFromHostname(relay);
      if (appName) {
        return appName;
      }
    }
  } catch {
    // continue
  }
  return null;
}

export function detectSignerAppName(config: ActiveSignerConfig): string | null {
  if (config.type === "nip07") {
    return "Browser Extension";
  }

  if (config.method === "bunker_input") {
    return detectFromBunkerInput(config.bunkerInput);
  }
  return detectFromNostrConnectUri(config.uri, config.relays);
}

export function maskConnectionUri(uri: string): string {
  if (uri.length <= 50) {
    return uri;
  }
  return `${uri.slice(0, 20)}...${uri.slice(-10)}`;
}
