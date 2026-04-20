/**
 * Storage and in-memory cache for active Nostr signer config.
 *
 * Stored in `localStorage` so the config survives tab close/reopen and is
 * shared across tabs of the same origin. The previous v1 key lived in
 * `sessionStorage`, which forced new tabs to re-bootstrap the signer; we
 * migrate any leftover v1 value into v2 once at startup.
 */

export type ActiveSignerConfig =
  | { type: "nip07" }
  | {
      type: "nip46";
      method: "bunker_input";
      bunkerInput: string;
      clientSecretKeyHex: string;
      /**
       * Bunker relays captured at connection time (parsed from `bunkerInput`).
       * Persisted alongside the input so callers reading `cfg.relays`
       * (Settings UI, transport-health helpers, etc.) don't have to re-parse
       * the bunker URL on every read. Historically this field could also be
       * overwritten by a `switch_relays` response; that path was removed
       * because Primal Signer never replied to it and it broke the next RPC
       * — see `connection-health.client.ts` for the full rationale.
       */
      relays?: string[];
    }
  | {
      type: "nip46";
      method: "nostrconnect_uri";
      uri: string;
      clientSecretKeyHex: string;
      relays: string[];
      /** Remote signer pubkey (hex). Set after first connection so reconnects use Method 1 (fromBunker) instead of fromURI(). */
      signerPubkey?: string;
      /** Full BunkerPointer when available; used for Method 1 reconnect instead of reconstructing from signerPubkey + relays. */
      bunkerPointer?: {
        pubkey: string;
        relays: string[];
        secret: null | string;
      };
    };

/** Cache key for active signer config in localStorage. */
export const STORAGE_KEY = "__smartflow_active_nostr_signer_v2";
/** Legacy sessionStorage key from before the localStorage migration. */
export const LEGACY_STORAGE_KEY = "__smartflow_active_nostr_signer_v1";

let cachedConfigJson: string | null = null;

export function getActiveSignerConfig(): ActiveSignerConfig | null {
  try {
    const json = localStorage.getItem(STORAGE_KEY);
    if (!json) return null;
    return JSON.parse(json) as ActiveSignerConfig;
  } catch {
    return null;
  }
}

export function setActiveSignerConfig(config: ActiveSignerConfig): void {
  try {
    const json = JSON.stringify(config);
    localStorage.setItem(STORAGE_KEY, json);
    cachedConfigJson = json;
  } catch {
    // ignore
  }
}

export function clearActiveSignerConfig(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
  cachedConfigJson = null;
}

/**
 * One-shot migration from legacy sessionStorage v1 to localStorage v2.
 * Idempotent: only copies when v2 is missing, then drops the v1 entry.
 * Safe to call before any other storage usage.
 */
export function migrateLegacyActiveSignerConfig(): void {
  if (typeof window === "undefined") return;
  try {
    const legacy = sessionStorage.getItem(LEGACY_STORAGE_KEY);
    if (legacy && !localStorage.getItem(STORAGE_KEY)) {
      localStorage.setItem(STORAGE_KEY, legacy);
    }
    sessionStorage.removeItem(LEGACY_STORAGE_KEY);
  } catch {
    // ignore
  }
}

/**
 * Persist config (e.g. updated relays) without clearing the in-memory signer cache.
 * Used after relay sync or after first connection when persisting signerPubkey/bunkerPointer.
 */
export function persistActiveSignerConfigWithoutReset(
  config: ActiveSignerConfig
): void {
  setActiveSignerConfig(config);
}

/** Get the last stored config JSON string (for cache comparison in connection layer). */
export function getCachedConfigJson(): string | null {
  if (cachedConfigJson) return cachedConfigJson;
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

/** Set cached config JSON after caching a signer from login (no localStorage write). */
export function setCachedConfigJson(json: string): void {
  cachedConfigJson = json;
}
