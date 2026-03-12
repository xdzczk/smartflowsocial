/**
 * Storage layer for remote signer sessions (V2 only).
 * On first access, if V2 is missing, any existing V1 data is migrated once to V2
 * and V1 keys are cleared. Thereafter only V2 is read.
 */

import { convertHexToNpub, convertToHex } from "~/lib/nostr-conversion";

import type {
  RemoteSignerConnection,
  RemoteSignerSessionRecord,
  RemoteSignerSessionsStorageV1,
  RemoteSignerSessionsStorageV2,
} from "./remote-signer-sessions-types";
import {
  STORAGE_KEY_PREFIX,
  STORAGE_KEY_V2_PREFIX,
} from "./remote-signer-sessions-types";

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

export function getStorageKey(): string {
  if (currentUserNpub) {
    return `${STORAGE_KEY_PREFIX}_${currentUserNpub}`;
  }
  return STORAGE_KEY_PREFIX;
}

export function getStorageKeyV2(): string {
  if (currentUserNpub) {
    return `${STORAGE_KEY_V2_PREFIX}_${currentUserNpub}`;
  }
  return STORAGE_KEY_V2_PREFIX;
}

export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

const EMPTY_V2: RemoteSignerSessionsStorageV2 = {
  version: 2,
  connections: [],
  sessions: [],
  activeConnectionId: null,
};

/**
 * One-time migration from V1 to V2. Reads V1 from storage, writes V2, and clears V1 keys.
 * Only used when V2 is missing so that the read path is V2-only after first load.
 */
function migrateV1ToV2OnceAndClearV1(
  keyV2: string
): RemoteSignerSessionsStorageV2 {
  const keyV1 = getStorageKey();
  let v1: RemoteSignerSessionsStorageV1 | null = null;
  let v1KeyReadFrom: string | null = null;

  const stored = localStorage.getItem(keyV1);
  if (stored) {
    try {
      const parsed = JSON.parse(stored) as RemoteSignerSessionsStorageV1;
      /* eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- runtime check for v1 shape */
      if (parsed?.version === 1 && Array.isArray(parsed.sessions)) {
        v1 = parsed;
        v1KeyReadFrom = keyV1;
      }
    } catch {
      // ignore
    }
  }
  if (!v1 && currentUserNpub) {
    for (const alternate of getAlternateUserIdentifiers(currentUserNpub)) {
      const altKey = `${STORAGE_KEY_PREFIX}_${alternate}`;
      const altStored = localStorage.getItem(altKey);
      if (!altStored) continue;
      try {
        const parsed = JSON.parse(altStored) as RemoteSignerSessionsStorageV1;
        /* eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- runtime check for v1 shape */
        if (parsed?.version === 1 && Array.isArray(parsed.sessions)) {
          v1 = parsed;
          v1KeyReadFrom = altKey;
          break;
        }
      } catch {
        // continue
      }
    }
  }

  if (!v1) return { ...EMPTY_V2 };

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
  const v2: RemoteSignerSessionsStorageV2 = {
    version: 2,
    connections,
    sessions,
    activeConnectionId: v1.activeSessionId,
  };
  localStorage.setItem(keyV2, JSON.stringify(v2));
  if (v1KeyReadFrom) localStorage.removeItem(v1KeyReadFrom);
  localStorage.removeItem(keyV1);
  if (currentUserNpub) {
    for (const alternate of getAlternateUserIdentifiers(currentUserNpub)) {
      localStorage.removeItem(`${STORAGE_KEY_PREFIX}_${alternate}`);
    }
  }
  return v2;
}

export function getStorage(): RemoteSignerSessionsStorageV2 {
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
    return migrateV1ToV2OnceAndClearV1(keyV2);
  } catch {
    return { ...EMPTY_V2 };
  }
}

export function saveStorage(storage: RemoteSignerSessionsStorageV2): void {
  if (typeof window === "undefined" || typeof localStorage === "undefined") {
    return;
  }

  try {
    localStorage.setItem(getStorageKeyV2(), JSON.stringify(storage));
  } catch (error) {
    console.warn("Failed to save remote signer sessions:", error);
  }
}

export function normalizeActiveConnectionId(
  storage: RemoteSignerSessionsStorageV2
): void {
  if (
    storage.activeConnectionId &&
    !storage.connections.some((c) => c.id === storage.activeConnectionId)
  ) {
    storage.activeConnectionId = null;
  }
}

export function normalizeCurrentSessionIds(
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

export function updateStorage<T>(
  mutator: (storage: RemoteSignerSessionsStorageV2) => T
): T {
  const storage = getStorage();
  const result = mutator(storage);
  normalizeActiveConnectionId(storage);
  normalizeCurrentSessionIds(storage);
  saveStorage(storage);
  return result;
}
