import { convertHexToNpub, convertToHex } from "~/lib/nostr-conversion";
import type { ActiveSignerConfig } from "~/lib/nostr-signer-manager.client";

export type ConnectionStatus = "active" | "disconnected" | "stale" | "inactive";

export interface ConnectionLogEntry {
  id: string;
  timestamp: number;
  type:
    | "connect"
    | "disconnect"
    | "error"
    | "health_check"
    | "reconnect"
    | "sign";
  status: "success" | "failure" | "timeout";
  message: string;
  details?: Record<string, unknown>;
}

/** Connection-level metadata (no event history). */
export interface RemoteSignerConnectionMetadata {
  status: ConnectionStatus;
  signerAppName: string | null;
  pubkey: string | null;
  relays: string[];
  connectedAt: number | null;
  lastActivityAt: number | null;
  lastError: string | null;
  createdAt: number;
  updatedAt: number;
}

/** A NIP-46 connection (config + metadata). Contains multiple sessions over time. */
export interface RemoteSignerConnection {
  id: string;
  label: string;
  config: ActiveSignerConfig;
  metadata: RemoteSignerConnectionMetadata;
  /** Session we are currently logging to (null if disconnected). */
  currentSessionId: string | null;
}

/** One time-bound session under a connection; has its own event log. */
export interface RemoteSignerSessionRecord {
  id: string;
  connectionId: string;
  startedAt: number;
  endedAt: number | null;
  history: ConnectionLogEntry[];
}

/**
 * Legacy view: connection + current session history. Used by getActiveSession/getSessionById
 * until all call sites use connections and sessions.
 */
export interface RemoteSignerSession {
  id: string;
  label: string;
  config: ActiveSignerConfig;
  metadata: RemoteSignerConnectionMetadata;
  history: ConnectionLogEntry[];
}

interface MatchOrCreateSessionOptions {
  label?: string;
  signerPubkey?: string | null;
}

/** Legacy v1 storage (flat sessions with history on each). */
interface RemoteSignerSessionsStorageV1 {
  sessions: RemoteSignerSession[];
  activeSessionId: string | null;
  version: 1;
}

/** V2 storage: connections and sessions. */
interface RemoteSignerSessionsStorageV2 {
  version: 2;
  connections: RemoteSignerConnection[];
  sessions: RemoteSignerSessionRecord[];
  activeConnectionId: string | null;
}

const STORAGE_KEY_PREFIX = "__smartflow_remote_signer_sessions_v1";
const STORAGE_KEY_V2_PREFIX = "__smartflow_remote_signer_sessions_v2";
const MAX_HISTORY_ENTRIES = 100;
const MAX_SESSIONS_PER_CONNECTION = 20;
const ACTIVE_SESSION_CHANGED_EVENT = "remote-signer-active-session-changed";
const ACTIVE_CONNECTION_CHANGED_EVENT =
  "remote-signer-active-connection-changed";

/**
 * Current user npub for per-profile storage. When set, sessions are keyed by
 * this npub so each account has its own list on the same device. When null
 * (e.g. logged out or login page), we use a device-scoped key for backward compat.
 */
let currentUserNpub: string | null = null;

function normalizeUserIdentifier(userIdentifier: string | null): string | null {
  if (!userIdentifier) {
    return null;
  }

  const trimmed = userIdentifier.trim();
  if (!trimmed) {
    return null;
  }

  if (/^[0-9a-fA-F]{64}$/.test(trimmed)) {
    return convertHexToNpub(trimmed);
  }

  return trimmed;
}

function getAlternateUserIdentifiers(userIdentifier: string): string[] {
  const alternatives: string[] = [];

  if (userIdentifier.startsWith("npub")) {
    const hex = convertToHex(userIdentifier);
    if (hex) {
      alternatives.push(hex);
    }
  } else if (/^[0-9a-fA-F]{64}$/.test(userIdentifier)) {
    const npub = convertHexToNpub(userIdentifier);
    if (npub !== userIdentifier) {
      alternatives.push(npub);
    }
  }

  return alternatives;
}

/**
 * Set the current user's npub so session storage is read/written for that profile.
 * Call with the logged-in user's npub; call with null on logout or when no user.
 */
export function setCurrentUserNpub(npub: string | null): void {
  currentUserNpub = normalizeUserIdentifier(npub);
}

function getStorageKey(): string {
  if (currentUserNpub) {
    return `${STORAGE_KEY_PREFIX}_${currentUserNpub}`;
  }
  return STORAGE_KEY_PREFIX;
}

function getStorageKeyV2(): string {
  if (currentUserNpub) {
    return `${STORAGE_KEY_V2_PREFIX}_${currentUserNpub}`;
  }
  return STORAGE_KEY_V2_PREFIX;
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

const EMPTY_V2: RemoteSignerSessionsStorageV2 = {
  version: 2,
  connections: [],
  sessions: [],
  activeConnectionId: null,
};

function migrateV1ToV2(
  v1: RemoteSignerSessionsStorageV1
): RemoteSignerSessionsStorageV2 {
  const connections: RemoteSignerConnection[] = [];
  const sessions: RemoteSignerSessionRecord[] = [];
  for (const old of v1.sessions) {
    const connectionId = old.id;
    const sessionId = generateId();
    connections.push({
      id: connectionId,
      label: old.label,
      config: old.config,
      metadata: old.metadata,
      currentSessionId: sessionId,
    });
    sessions.push({
      id: sessionId,
      connectionId,
      startedAt: old.metadata.createdAt,
      endedAt: null,
      history: old.history,
    });
  }
  return {
    version: 2,
    connections,
    sessions,
    activeConnectionId: v1.activeSessionId,
  };
}

function readV1Storage(): RemoteSignerSessionsStorageV1 | null {
  const key = getStorageKey();
  const stored = localStorage.getItem(key);
  if (stored) {
    try {
      return JSON.parse(stored) as RemoteSignerSessionsStorageV1;
    } catch {
      // fall through
    }
  }
  if (currentUserNpub) {
    for (const alternate of getAlternateUserIdentifiers(currentUserNpub)) {
      const alternateKey = `${STORAGE_KEY_PREFIX}_${alternate}`;
      const alternateStored = localStorage.getItem(alternateKey);
      if (!alternateStored) continue;
      try {
        return JSON.parse(alternateStored) as RemoteSignerSessionsStorageV1;
      } catch {
        // continue
      }
    }
  }
  return null;
}

function getStorage(): RemoteSignerSessionsStorageV2 {
  if (typeof window === "undefined" || typeof localStorage === "undefined") {
    return { ...EMPTY_V2 };
  }
  try {
    const keyV2 = getStorageKeyV2();
    const storedV2 = localStorage.getItem(keyV2);
    if (storedV2) {
      const parsed = JSON.parse(storedV2) as RemoteSignerSessionsStorageV2;
      if (Array.isArray(parsed.connections) && Array.isArray(parsed.sessions)) {
        return parsed;
      }
    }
    const v1 = readV1Storage();
    if (v1?.version === 1 && Array.isArray(v1.sessions)) {
      const v2 = migrateV1ToV2(v1);
      localStorage.setItem(keyV2, JSON.stringify(v2));
      return v2;
    }
    return { ...EMPTY_V2 };
  } catch {
    return { ...EMPTY_V2 };
  }
}

function saveStorage(storage: RemoteSignerSessionsStorageV2): void {
  if (typeof window === "undefined" || typeof localStorage === "undefined") {
    return;
  }

  try {
    localStorage.setItem(getStorageKeyV2(), JSON.stringify(storage));
  } catch (error) {
    console.warn("Failed to save remote signer sessions:", error);
  }
}

function normalizeActiveConnectionId(
  storage: RemoteSignerSessionsStorageV2
): void {
  if (
    storage.activeConnectionId &&
    !storage.connections.some((c) => c.id === storage.activeConnectionId)
  ) {
    storage.activeConnectionId = null;
  }
}

function normalizeCurrentSessionIds(
  storage: RemoteSignerSessionsStorageV2
): void {
  for (const conn of storage.connections) {
    if (
      conn.currentSessionId &&
      !storage.sessions.some(
        (s) => s.id === conn.currentSessionId && s.connectionId === conn.id
      )
    ) {
      (conn as { currentSessionId: string | null }).currentSessionId = null;
    }
  }
}

function updateStorage<T>(
  mutator: (storage: RemoteSignerSessionsStorageV2) => T
): T {
  const storage = getStorage();
  const result = mutator(storage);
  normalizeActiveConnectionId(storage);
  normalizeCurrentSessionIds(storage);
  saveStorage(storage);
  return result;
}

function _sessionRecordToLegacyView(
  conn: RemoteSignerConnection,
  session: RemoteSignerSessionRecord
): RemoteSignerSession {
  return {
    id: conn.id,
    label: conn.label,
    config: conn.config,
    metadata: conn.metadata,
    history: session.history,
  };
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
// Prefer getAllConnections, getActiveConnection, getSessionsForConnection, etc.
// when adding new code. These remain for backward compatibility with existing call sites.

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
        const mod = await import("~/lib/remote-signer-status.client");
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
  // Only clear the signer cache when switching to a *different* connection.
  // Do not clear when previousId is null (first time setting after login) or when
  // re-setting the same id (revalidation); otherwise the second sign after login
  // would see no cached signer and get stuck.
  if (
    typeof window !== "undefined" &&
    previousId != null &&
    previousId !== id
  ) {
    setTimeout(() => {
      void (async () => {
        const mod = await import("~/lib/nostr-signer-manager.client");
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
    // Invalid URL, continue
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

    // Check relays for known patterns
    for (const relay of relays) {
      const appName = detectAppFromHostname(relay);
      if (appName) {
        return appName;
      }
    }
  } catch {
    // Invalid URL, continue
  }
  return null;
}

export function detectSignerAppName(config: ActiveSignerConfig): string | null {
  if (config.type === "nip07") {
    return "Browser Extension";
  }

  // TypeScript narrows config.type to "nip46" here
  if (config.method === "bunker_input") {
    return detectFromBunkerInput(config.bunkerInput);
  }
  // TypeScript narrows to "nostrconnect_uri" here
  return detectFromNostrConnectUri(config.uri, config.relays);
}

export function maskConnectionUri(uri: string): string {
  if (uri.length <= 50) {
    return uri;
  }
  return `${uri.slice(0, 20)}...${uri.slice(-10)}`;
}
