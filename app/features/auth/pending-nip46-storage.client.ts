/**
 * Durable pending NIP-46 connect handoff between our app and a signer app
 * (typically Primal) on mobile.
 *
 * Why not just `sessionStorage`?
 *
 * On iOS Safari, when Primal redirects back to our HTTPS callback URL after
 * the user approves, Safari frequently restores the tab in a fresh
 * browsing context (especially when the tab was discarded under memory
 * pressure or when the deep-link return opens a new tab instead of
 * reactivating the original one). `sessionStorage` is per-tab and is wiped
 * in that case, so the pending nostrconnect URI we stored before opening
 * Primal disappears. The login panel's mount effect then can't find any
 * pending session, never calls `resume()`, and the user is left looking at
 * the regular Welcome screen with no progress and no error.
 *
 * `localStorage` survives that whole dance, so we use it as the primary
 * store. We bound it with a TTL so a stale handoff can't haunt the user
 * for a future login (e.g. they bailed out and came back tomorrow), and
 * we still write through to `sessionStorage` as a fallback for any
 * environment where `localStorage` is unavailable (privacy modes, hardened
 * embedded browsers).
 */

import { parseSecretKeyHex, serializeSecretKey } from "~/features/auth/signer";

/** Pending handoff TTL: long enough for the user to approve in their signer
 *  app and switch back, short enough that abandoned attempts don't linger
 *  past a normal session window. */
const PENDING_NIP46_TTL_MS = 10 * 60 * 1000;

interface PersistedPendingNip46 {
  uri: string;
  clientSecretKeyHex: string;
  relays: string[];
  /** Wall-clock ms at which this handoff expires. */
  expiresAt: number;
}

export interface PendingNip46Handoff {
  uri: string;
  clientSecretKey: Uint8Array;
  relays: string[];
}

function safeGetLocal(key: string): string | null {
  try {
    return typeof localStorage !== "undefined"
      ? localStorage.getItem(key)
      : null;
  } catch {
    return null;
  }
}

function safeGetSession(key: string): string | null {
  try {
    return typeof sessionStorage !== "undefined"
      ? sessionStorage.getItem(key)
      : null;
  } catch {
    return null;
  }
}

function safeSetLocal(key: string, value: string): void {
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(key, value);
    }
  } catch {
    // ignore
  }
}

function safeSetSession(key: string, value: string): void {
  try {
    if (typeof sessionStorage !== "undefined") {
      sessionStorage.setItem(key, value);
    }
  } catch {
    // ignore
  }
}

function safeRemoveLocal(key: string): void {
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.removeItem(key);
    }
  } catch {
    // ignore
  }
}

function safeRemoveSession(key: string): void {
  try {
    if (typeof sessionStorage !== "undefined") {
      sessionStorage.removeItem(key);
    }
  } catch {
    // ignore
  }
}

function decodeRecord(raw: string): PersistedPendingNip46 | null {
  try {
    const parsed = JSON.parse(raw) as Partial<PersistedPendingNip46> | null;
    if (
      !parsed ||
      typeof parsed.uri !== "string" ||
      typeof parsed.clientSecretKeyHex !== "string" ||
      !Array.isArray(parsed.relays) ||
      typeof parsed.expiresAt !== "number"
    ) {
      return null;
    }
    return {
      uri: parsed.uri,
      clientSecretKeyHex: parsed.clientSecretKeyHex,
      relays: parsed.relays.filter((r): r is string => typeof r === "string"),
      expiresAt: parsed.expiresAt,
    };
  } catch {
    return null;
  }
}

/**
 * Read a pending handoff. Prefers `localStorage` (durable across iOS Safari
 * tab restores), falls back to `sessionStorage`. Returns `null` and clears
 * both stores when the entry is missing, malformed, or past its TTL.
 */
export function readPendingNip46Handoff(
  key: string,
  now: number = Date.now()
): PendingNip46Handoff | null {
  const raw = safeGetLocal(key) ?? safeGetSession(key);
  if (!raw) return null;

  const record = decodeRecord(raw);
  if (!record) {
    clearPendingNip46Handoff(key);
    return null;
  }

  if (record.expiresAt <= now) {
    clearPendingNip46Handoff(key);
    return null;
  }

  let clientSecretKey: Uint8Array;
  try {
    clientSecretKey = parseSecretKeyHex(record.clientSecretKeyHex);
  } catch {
    clearPendingNip46Handoff(key);
    return null;
  }

  return {
    uri: record.uri,
    clientSecretKey,
    relays: record.relays,
  };
}

/**
 * Persist a pending handoff. Writes to both `localStorage` and
 * `sessionStorage` so the entry survives iOS Safari tab restores while
 * still being available even when third-party `localStorage` is sandboxed.
 */
export function writePendingNip46Handoff(
  key: string,
  handoff: PendingNip46Handoff,
  now: number = Date.now()
): void {
  const record: PersistedPendingNip46 = {
    uri: handoff.uri,
    clientSecretKeyHex: serializeSecretKey(handoff.clientSecretKey),
    relays: [...handoff.relays],
    expiresAt: now + PENDING_NIP46_TTL_MS,
  };
  const serialized = JSON.stringify(record);
  safeSetLocal(key, serialized);
  safeSetSession(key, serialized);
}

/** Clear a pending handoff from both storage tiers. */
export function clearPendingNip46Handoff(key: string): void {
  safeRemoveLocal(key);
  safeRemoveSession(key);
}

/** Exposed for tests. */
export const PENDING_NIP46_TTL_MS_FOR_TESTS = PENDING_NIP46_TTL_MS;
