import { SimplePool, getPublicKey } from "nostr-tools";
import { BunkerSigner, parseBunkerInput } from "nostr-tools/nip46";

import {
  Nip07Signer,
  Nip46Signer,
  type NostrSigner,
} from "~/features/auth/nostr-signer.client";
import type { NostrEvent, SignedEvent } from "~/features/nostr/types";

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
    };

const STORAGE_KEY = "__smartflow_active_nostr_signer_v1";

let cachedSigner: NostrSigner | null = null;
let cachedConfigJson: string | null = null;
let wasHidden = false;

/**
 * Clear the in-memory signer cache without removing persisted config.
 * Useful when a NIP-46 remote signer connection becomes stale.
 */
export function resetCachedSigner(): void {
  cachedSigner = null;
}

/**
 * Initialize page visibility detection to reset cached NIP-46 signers
 * when the page becomes visible again after being hidden.
 * This helps recover from stale WebSocket connections when users switch
 * between the browser and signer app on the same device.
 */
function initVisibilityHandler(): void {
  if (typeof document === "undefined") return;

  // Track if page was hidden
  const handleVisibilityChange = () => {
    if (document.hidden) {
      wasHidden = true;
    } else if (wasHidden) {
      // Page became visible again after being hidden
      // Reset cached NIP-46 signer to force reconnection
      const config = getActiveSignerConfig();
      if (config?.type === "nip46" && cachedSigner) {
        // Close existing connections gracefully
        if (cachedSigner.type === "nip46" && cachedSigner.close) {
          const closeFn = cachedSigner.close;
          void (async () => {
            try {
              await closeFn();
            } catch {
              // Ignore errors during cleanup
            }
          })();
        }
        resetCachedSigner();
      }
      wasHidden = false;
    }
  };

  document.addEventListener("visibilitychange", handleVisibilityChange);
}

// Initialize visibility handler when module loads
if (typeof window !== "undefined") {
  initVisibilityHandler();
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function hexToBytes(hex: string): Uint8Array {
  const normalized = hex.trim().toLowerCase();
  if (!/^[0-9a-f]+$/.test(normalized) || normalized.length % 2 !== 0) {
    throw new Error("Invalid hex");
  }
  const out = new Uint8Array(normalized.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(normalized.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

export function serializeSecretKey(key: Uint8Array): string {
  return bytesToHex(key);
}

export function clearActiveSignerConfig(): void {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
  cachedSigner = null;
  cachedConfigJson = null;
}

export function setActiveSignerConfig(config: ActiveSignerConfig): void {
  try {
    const json = JSON.stringify(config);
    sessionStorage.setItem(STORAGE_KEY, json);
    cachedConfigJson = json;
    cachedSigner = null;
  } catch {
    // ignore
  }
}

export function getActiveSignerConfig(): ActiveSignerConfig | null {
  try {
    const json = sessionStorage.getItem(STORAGE_KEY);
    if (!json) return null;
    if (cachedConfigJson === json && cachedSigner) {
      // config unchanged; signer already cached
      return JSON.parse(json) as ActiveSignerConfig;
    }
    return JSON.parse(json) as ActiveSignerConfig;
  } catch {
    return null;
  }
}

/**
 * Verify that a cached NIP-46 signer connection is still valid.
 * Returns true if the signer is available and can be used, false otherwise.
 * Uses a quick health check with a short timeout to avoid blocking.
 */
async function verifySignerConnection(signer: NostrSigner): Promise<boolean> {
  if (signer.type !== "nip46") return true; // NIP-07 doesn't need verification

  try {
    // Quick health check: try to get public key with a short timeout
    // This will fail if the connection is stale or the signer is unreachable
    await Promise.race([
      signer.getPublicKey(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Connection check timeout")), 3000)
      ),
    ]);
    return true;
  } catch {
    // Connection is stale or unreachable
    return false;
  }
}

export async function getActiveSigner(): Promise<NostrSigner | null> {
  // If we have a cached signer, verify it's still valid before returning it
  if (cachedSigner) {
    const isValid = await verifySignerConnection(cachedSigner);
    if (isValid) {
      return cachedSigner;
    }
    // Connection is stale, clear cache and reconnect
    if (cachedSigner.type === "nip46" && cachedSigner.close) {
      const closeFn = cachedSigner.close;
      void (async () => {
        try {
          await closeFn();
        } catch {
          // Ignore errors during cleanup
        }
      })();
    }
    resetCachedSigner();
  }

  const config = getActiveSignerConfig();
  if (!config) return null;

  if (config.type === "nip07") {
    cachedSigner = new Nip07Signer();
    return cachedSigner;
  }

  const clientSecretKey = hexToBytes(config.clientSecretKeyHex);
  const pool = new SimplePool();

  if (config.method === "bunker_input") {
    const bp = await parseBunkerInput(config.bunkerInput);
    if (!bp) {
      throw new Error("Invalid bunker input");
    }
    const inner = BunkerSigner.fromBunker(clientSecretKey, bp, { pool });
    await inner.connect();
    cachedSigner = new Nip46Signer({ pool, inner });
    return cachedSigner;
  }

  // nostrconnect_uri
  const inner = await BunkerSigner.fromURI(
    clientSecretKey,
    config.uri,
    { pool },
    60_000
  );
  cachedSigner = new Nip46Signer({ pool, inner });
  return cachedSigner;
}

/**
 * A minimal signer shape compatible with libraries expecting NIP-07 style `window.nostr`.
 */
export async function getWindowNostrLikeSigner(): Promise<{
  getPublicKey: () => Promise<string>;
  signEvent: (event: NostrEvent) => Promise<SignedEvent>;
} | null> {
  // Prefer configured signer if present
  const active = await getActiveSigner();
  if (active) {
    return {
      getPublicKey: async () => await active.getPublicKey(),
      signEvent: async (event: NostrEvent) => await active.signEvent(event),
    };
  }

  // Fallback to extension if available
  // @ts-ignore - injected at runtime by extensions
  if (typeof window !== "undefined" && window.nostr) {
    // @ts-ignore - injected at runtime by extensions
    return window.nostr;
  }

  return null;
}

export async function getActiveSignerPubkeyHint(): Promise<string | null> {
  const cfg = getActiveSignerConfig();
  if (!cfg) return null;
  if (cfg.type === "nip07") return null;
  try {
    const sk = hexToBytes(cfg.clientSecretKeyHex);
    return getPublicKey(sk);
  } catch {
    return null;
  }
}
