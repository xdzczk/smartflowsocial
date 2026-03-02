import { convertHexToNpub, convertToHex } from "~/lib/nostr-conversion";
import type { ActiveSignerConfig } from "~/lib/nostr-signer-manager.client";

export type ConnectionStatus = "active" | "disconnected" | "stale" | "inactive";

export interface ConnectionLogEntry {
  id: string;
  timestamp: number;
  type: "connect" | "disconnect" | "error" | "health_check" | "reconnect";
  status: "success" | "failure" | "timeout";
  message: string;
  details?: Record<string, unknown>;
}

export interface RemoteSignerSession {
  id: string;
  label: string;
  config: ActiveSignerConfig;
  metadata: {
    status: ConnectionStatus;
    signerAppName: string | null;
    pubkey: string | null;
    relays: string[];
    connectedAt: number | null;
    lastActivityAt: number | null;
    lastError: string | null;
    createdAt: number;
    updatedAt: number;
  };
  history: ConnectionLogEntry[];
}

interface MatchOrCreateSessionOptions {
  label?: string;
  signerPubkey?: string | null;
}

interface RemoteSignerSessionsStorage {
  sessions: RemoteSignerSession[];
  activeSessionId: string | null;
  version: number;
}

const STORAGE_KEY_PREFIX = "__smartflow_remote_signer_sessions_v1";
const MAX_HISTORY_ENTRIES = 100;
const ACTIVE_SESSION_CHANGED_EVENT = "remote-signer-active-session-changed";

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

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

function getStorage(): RemoteSignerSessionsStorage {
  if (typeof window === "undefined" || typeof localStorage === "undefined") {
    return { sessions: [], activeSessionId: null, version: 1 };
  }

  try {
    const key = getStorageKey();
    const stored = localStorage.getItem(key);
    if (!stored) {
      // Backward compatibility: if profile identifier format changed
      // (hex <-> npub), read from the old key and migrate.
      if (currentUserNpub) {
        for (const alternate of getAlternateUserIdentifiers(currentUserNpub)) {
          const alternateKey = `${STORAGE_KEY_PREFIX}_${alternate}`;
          const alternateStored = localStorage.getItem(alternateKey);
          if (!alternateStored) {
            continue;
          }
          try {
            const parsed = JSON.parse(
              alternateStored
            ) as RemoteSignerSessionsStorage;
            localStorage.setItem(key, JSON.stringify(parsed));
            return parsed;
          } catch {
            // Ignore invalid legacy data and continue fallback lookup.
          }
        }
      }
      return { sessions: [], activeSessionId: null, version: 1 };
    }
    return JSON.parse(stored) as RemoteSignerSessionsStorage;
  } catch {
    return { sessions: [], activeSessionId: null, version: 1 };
  }
}

function saveStorage(storage: RemoteSignerSessionsStorage): void {
  if (typeof window === "undefined" || typeof localStorage === "undefined") {
    return;
  }

  try {
    localStorage.setItem(getStorageKey(), JSON.stringify(storage));
  } catch (error) {
    console.warn("Failed to save remote signer sessions:", error);
  }
}

function normalizeActiveSessionId(storage: RemoteSignerSessionsStorage): void {
  if (
    storage.activeSessionId &&
    !storage.sessions.some((session) => session.id === storage.activeSessionId)
  ) {
    storage.activeSessionId = null;
  }
}

function updateStorage<T>(
  mutator: (storage: RemoteSignerSessionsStorage) => T
): T {
  const storage = getStorage();
  const result = mutator(storage);
  normalizeActiveSessionId(storage);
  saveStorage(storage);
  return result;
}

export function getAllSessions(): RemoteSignerSession[] {
  const storage = getStorage();
  return storage.sessions;
}

export function getActiveSession(): RemoteSignerSession | null {
  const storage = getStorage();
  if (!storage.activeSessionId) {
    return null;
  }
  return storage.sessions.find((s) => s.id === storage.activeSessionId) ?? null;
}

export function getSessionById(id: string): RemoteSignerSession | null {
  const storage = getStorage();
  return storage.sessions.find((s) => s.id === id) ?? null;
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

function getLatestSession(
  sessions: RemoteSignerSession[]
): RemoteSignerSession | null {
  if (sessions.length === 0) {
    return null;
  }
  return sessions.reduce((latest, candidate) =>
    candidate.metadata.updatedAt > latest.metadata.updatedAt
      ? candidate
      : latest
  );
}

export function findMatchingSessionForConfig(
  config: ActiveSignerConfig,
  signerPubkey?: string | null
): RemoteSignerSession | null {
  const sessions = getAllSessions();
  if (config.type !== "nip46") {
    return null;
  }

  const pubkeyHex = normalizePubkeyHex(signerPubkey);
  if (pubkeyHex) {
    const matchedByPubkey = sessions.filter((session) => {
      if (
        session.config.type !== "nip46" ||
        session.config.method !== config.method
      ) {
        return false;
      }
      return normalizePubkeyHex(session.metadata.pubkey) === pubkeyHex;
    });
    const latestByPubkey = getLatestSession(matchedByPubkey);
    if (latestByPubkey) {
      return latestByPubkey;
    }
  }

  const matchedByConfig = sessions.filter((session) =>
    isConfigEquivalent(session.config, config)
  );
  return getLatestSession(matchedByConfig);
}

export function matchOrCreateSession(
  config: ActiveSignerConfig,
  options?: MatchOrCreateSessionOptions
): RemoteSignerSession {
  const existing = findMatchingSessionForConfig(config, options?.signerPubkey);
  if (existing) {
    const updates: Partial<RemoteSignerSession> = {};
    if (options?.label && existing.label !== options.label) {
      updates.label = options.label;
    }
    if (existing.config !== config) {
      updates.config = config;
    }
    if (Object.keys(updates).length > 0) {
      updateSession(existing.id, updates);
      return getSessionById(existing.id) ?? { ...existing, ...updates };
    }
    return existing;
  }
  return createSession(config, options?.label);
}

export function createSession(
  config: ActiveSignerConfig,
  label?: string
): RemoteSignerSession {
  const session = updateStorage((storage) => {
    const now = Date.now();
    const defaultLabel = label ?? `Session ${storage.sessions.length + 1}`;
    const signerAppName = detectSignerAppName(config);
    const relays =
      config.type === "nip46" && config.method === "nostrconnect_uri"
        ? config.relays
        : [];

    const created: RemoteSignerSession = {
      id: generateId(),
      label: defaultLabel,
      config,
      metadata: {
        status: "inactive",
        signerAppName,
        pubkey: null,
        relays,
        connectedAt: null,
        lastActivityAt: null,
        lastError: null,
        createdAt: now,
        updatedAt: now,
      },
      history: [],
    };

    storage.sessions.push(created);
    return created;
  });

  // Emit event
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("remote-signer-session-created", {
        detail: { sessionId: session.id },
      })
    );
  }

  return session;
}

export function updateSession(
  id: string,
  updates: Partial<RemoteSignerSession>
): void {
  const updated = updateStorage((storage) => {
    const sessionIndex = storage.sessions.findIndex((s) => s.id === id);
    if (sessionIndex === -1) {
      return false;
    }

    const session = storage.sessions[sessionIndex];
    if (!session) {
      return false;
    }

    const updatedSession: RemoteSignerSession = {
      ...session,
      ...updates,
      metadata: {
        ...session.metadata,
        ...(updates.metadata ?? {}),
        updatedAt: Date.now(),
      },
      history: updates.history ?? session.history,
    };

    storage.sessions[sessionIndex] = updatedSession;
    return true;
  });
  if (!updated) {
    return;
  }

  // Emit event
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("remote-signer-session-updated", {
        detail: { sessionId: id },
      })
    );
  }
}

export function setActiveSession(id: string): void {
  const result = updateStorage((storage) => {
    const session = storage.sessions.find((s) => s.id === id);
    if (!session) {
      return null;
    }

    let previousActiveId: string | null = null;
    if (storage.activeSessionId && storage.activeSessionId !== id) {
      const oldActive = storage.sessions.find(
        (s) => s.id === storage.activeSessionId
      );
      if (oldActive?.metadata.status === "active") {
        previousActiveId = oldActive.id;
        oldActive.metadata = {
          ...oldActive.metadata,
          status: "disconnected",
          updatedAt: Date.now(),
        };
      }
    }

    storage.activeSessionId = id;
    return {
      sessionConfig: session.config,
      previousActiveId,
    };
  });
  if (!result) {
    return;
  }

  // Update sessionStorage for backward compatibility
  if (typeof window !== "undefined" && typeof sessionStorage !== "undefined") {
    try {
      sessionStorage.setItem(
        "__smartflow_active_nostr_signer_v1",
        JSON.stringify(result.sessionConfig)
      );
    } catch {
      // ignore
    }
  }

  if (result.previousActiveId) {
    const previousActiveId = result.previousActiveId;
    // Import and call recordConnectionEvent asynchronously to avoid circular dependency
    void (async () => {
      const module = await import("~/lib/remote-signer-status.client");
      module.recordConnectionEvent(previousActiveId, {
        type: "disconnected",
        reason: "Switched to different session",
      });
    })();
  }

  // Clear cached signer so it will reconnect with new session's config
  // This is done asynchronously to avoid circular dependencies
  if (typeof window !== "undefined") {
    setTimeout(() => {
      void (async () => {
        const module = await import("~/lib/nostr-signer-manager.client");
        module.resetCachedSigner();
      })();
    }, 0);
  }

  // Emit event
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent(ACTIVE_SESSION_CHANGED_EVENT, {
        detail: { sessionId: id },
      })
    );
  }
}

export function clearActiveSession(): void {
  updateStorage((storage) => {
    storage.activeSessionId = null;
    return null;
  });

  // Clear sessionStorage for backward compatibility
  if (typeof window !== "undefined" && typeof sessionStorage !== "undefined") {
    try {
      sessionStorage.removeItem("__smartflow_active_nostr_signer_v1");
    } catch {
      // ignore
    }
  }

  // Emit event
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent(ACTIVE_SESSION_CHANGED_EVENT, {
        detail: { sessionId: null },
      })
    );
  }
}

export function removeSession(id: string): void {
  const removedActive = updateStorage((storage) => {
    storage.sessions = storage.sessions.filter((s) => s.id !== id);
    const wasActive = storage.activeSessionId === id;
    if (storage.activeSessionId === id) {
      storage.activeSessionId = null;
    }
    return wasActive;
  });

  if (removedActive) {
    // Keep backward-compatible active signer snapshot in sync.
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
          detail: { sessionId: null },
        })
      );
    }
  }

  // Emit event
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("remote-signer-session-removed", {
        detail: { sessionId: id },
      })
    );
  }
}

export function addConnectionLog(
  sessionId: string,
  entry: Omit<ConnectionLogEntry, "id" | "timestamp">
): void {
  updateStorage((storage) => {
    const sessionIndex = storage.sessions.findIndex((s) => s.id === sessionId);
    if (sessionIndex === -1) {
      return null;
    }

    const session = storage.sessions[sessionIndex];
    if (!session) {
      return null;
    }

    const logEntry: ConnectionLogEntry = {
      id: generateId(),
      timestamp: Date.now(),
      ...entry,
    };

    // Add to history and limit size
    const history = [logEntry, ...session.history].slice(
      0,
      MAX_HISTORY_ENTRIES
    );

    storage.sessions[sessionIndex] = {
      ...session,
      history,
      metadata: {
        ...session.metadata,
        updatedAt: Date.now(),
      },
    };
    return null;
  });
}

export function getConnectionHistory(
  sessionId: string,
  limit?: number
): ConnectionLogEntry[] {
  const session = getSessionById(sessionId);
  if (!session) {
    return [];
  }

  const history = session.history;
  return limit ? history.slice(0, limit) : history;
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
