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

interface RemoteSignerSessionsStorage {
  sessions: RemoteSignerSession[];
  activeSessionId: string | null;
  version: number;
}

const STORAGE_KEY_PREFIX = "__smartflow_remote_signer_sessions_v1";
const MAX_HISTORY_ENTRIES = 100;

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

export function createSession(
  config: ActiveSignerConfig,
  label?: string
): RemoteSignerSession {
  const storage = getStorage();
  const now = Date.now();

  // Generate default label if not provided
  const defaultLabel = label ?? `Session ${storage.sessions.length + 1}`;

  // Detect signer app name
  const signerAppName = detectSignerAppName(config);

  // Extract relays from config
  const relays =
    config.type === "nip46" && config.method === "nostrconnect_uri"
      ? config.relays
      : [];

  const session: RemoteSignerSession = {
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

  storage.sessions.push(session);
  saveStorage(storage);

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
  const storage = getStorage();
  const sessionIndex = storage.sessions.findIndex((s) => s.id === id);
  if (sessionIndex === -1) {
    return;
  }

  const session = storage.sessions[sessionIndex];
  if (!session) {
    return;
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
  saveStorage(storage);

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
  const storage = getStorage();
  const session = storage.sessions.find((s) => s.id === id);
  if (!session) {
    return;
  }

  // Update old active session status if exists
  if (storage.activeSessionId && storage.activeSessionId !== id) {
    const oldActive = storage.sessions.find(
      (s) => s.id === storage.activeSessionId
    );
    if (oldActive?.metadata.status === "active") {
      updateSession(storage.activeSessionId, {
        metadata: { ...oldActive.metadata, status: "disconnected" },
      });
      // Import and call recordConnectionEvent asynchronously to avoid circular dependency
      void (async () => {
        const module = await import("~/lib/remote-signer-status.client");
        module.recordConnectionEvent(storage.activeSessionId!, {
          type: "disconnected",
          reason: "Switched to different session",
        });
      })();
    }
  }

  storage.activeSessionId = id;
  saveStorage(storage);

  // Update sessionStorage for backward compatibility
  if (typeof window !== "undefined" && typeof sessionStorage !== "undefined") {
    try {
      sessionStorage.setItem(
        "__smartflow_active_nostr_signer_v1",
        JSON.stringify(session.config)
      );
    } catch {
      // ignore
    }
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
      new CustomEvent("remote-signer-active-session-changed", {
        detail: { sessionId: id },
      })
    );
  }
}

export function clearActiveSession(): void {
  const storage = getStorage();
  storage.activeSessionId = null;
  saveStorage(storage);

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
      new CustomEvent("remote-signer-active-session-changed", {
        detail: { sessionId: null },
      })
    );
  }
}

export function removeSession(id: string): void {
  const storage = getStorage();

  // If removing active session, clear active
  if (storage.activeSessionId === id) {
    clearActiveSession();
  }

  storage.sessions = storage.sessions.filter((s) => s.id !== id);
  saveStorage(storage);

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
  const storage = getStorage();
  const sessionIndex = storage.sessions.findIndex((s) => s.id === sessionId);
  if (sessionIndex === -1) {
    return;
  }

  const session = storage.sessions[sessionIndex];
  if (!session) {
    return;
  }

  const logEntry: ConnectionLogEntry = {
    id: generateId(),
    timestamp: Date.now(),
    ...entry,
  };

  // Add to history and limit size
  const history = [logEntry, ...session.history].slice(0, MAX_HISTORY_ENTRIES);

  storage.sessions[sessionIndex] = {
    ...session,
    history,
  };
  saveStorage(storage);
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
