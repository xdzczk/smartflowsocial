/**
 * Storage and in-memory cache for active Nostr signer config.
 * Handles sessionStorage read/write and cache key constants.
 */

export type ActiveSignerConfig =
  | { type: "nip07" }
  | {
      type: "nip46";
      method: "bunker_input";
      bunkerInput: string;
      clientSecretKeyHex: string;
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

/** Cache key for active signer config in sessionStorage. */
export const STORAGE_KEY = "__smartflow_active_nostr_signer_v1";

let cachedConfigJson: string | null = null;

export function getActiveSignerConfig(): ActiveSignerConfig | null {
  try {
    const json = sessionStorage.getItem(STORAGE_KEY);
    if (!json) return null;
    return JSON.parse(json) as ActiveSignerConfig;
  } catch {
    return null;
  }
}

export function setActiveSignerConfig(config: ActiveSignerConfig): void {
  try {
    const json = JSON.stringify(config);
    sessionStorage.setItem(STORAGE_KEY, json);
    cachedConfigJson = json;
  } catch {
    // ignore
  }
}

export function clearActiveSignerConfig(): void {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
  cachedConfigJson = null;
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
    return sessionStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

/** Set cached config JSON after caching a signer from login (no sessionStorage write). */
export function setCachedConfigJson(json: string): void {
  cachedConfigJson = json;
}
