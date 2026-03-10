/**
 * Public API for Nostr signer management. Composes storage, connection, and key modules.
 * Re-exports all symbols used by the rest of the app.
 */

import { getPublicKey } from "nostr-tools";

import type { NostrEvent, SignedEvent } from "~/features/nostr/types";
import { isMobile } from "~/lib/is-mobile";

import {
  cacheNip46SignerFromLogin,
  createNip46SignerFromStoredConfig,
  getActiveSigner,
  NOSTR_CONNECTION_HEALTHY_EVENT,
  recordSuccessfulSign,
  resetCachedSigner,
  syncRelaysWithRemoteSigner,
  teardownActiveNip46Signer,
  teardownVisibilityHandler,
  tryBackgroundReconnect,
} from "./nostr-signer-connection.client";
import {
  hexToBytes,
  parseSecretKeyHex,
  serializeSecretKey,
} from "./nostr-signer-keys.client";
import {
  clearActiveSignerConfig as storageClearActiveSignerConfig,
  getActiveSignerConfig as storageGetActiveSignerConfig,
  setActiveSignerConfig as storageSetActiveSignerConfig,
  type ActiveSignerConfig,
  STORAGE_KEY,
} from "./nostr-signer-storage.client";

// Re-export types and storage key
export type { ActiveSignerConfig };
export { STORAGE_KEY };

/** Fired when remote signer reconnect succeeds so composers clear "Waiting for signer approval". */
export { NOSTR_CONNECTION_HEALTHY_EVENT };

/** Fired when signer config was missing and we defaulted to NIP-07 so components can re-read. */
export const SIGNER_CONFIG_HYDRATED_EVENT = "smartflow:signer-config-hydrated";

// Storage: get is pass-through; set/clear also reset connection cache
export const getActiveSignerConfig = storageGetActiveSignerConfig;

export function setActiveSignerConfig(config: ActiveSignerConfig): void {
  storageSetActiveSignerConfig(config);
  resetCachedSigner();
}

export function clearActiveSignerConfig(): void {
  storageClearActiveSignerConfig();
  resetCachedSigner();
}

// Connection lifecycle and cache
export {
  cacheNip46SignerFromLogin,
  createNip46SignerFromStoredConfig,
  getActiveSigner,
  recordSuccessfulSign,
  resetCachedSigner,
  syncRelaysWithRemoteSigner,
  teardownActiveNip46Signer,
  teardownVisibilityHandler,
  tryBackgroundReconnect,
};

// Keys
export { parseSecretKeyHex, serializeSecretKey };

export { isMobile };

/**
 * A minimal signer shape compatible with libraries expecting NIP-07 style `window.nostr`.
 */
export async function getWindowNostrLikeSigner(): Promise<{
  getPublicKey: () => Promise<string>;
  signEvent: (event: NostrEvent) => Promise<SignedEvent>;
} | null> {
  const active = await getActiveSigner();
  if (active) {
    return {
      getPublicKey: async () => await active.getPublicKey(),
      signEvent: async (event: NostrEvent) => await active.signEvent(event),
    };
  }
  if (typeof window !== "undefined" && window.nostr) {
    return window.nostr as {
      getPublicKey: () => Promise<string>;
      signEvent: (event: NostrEvent) => Promise<SignedEvent>;
    };
  }
  return null;
}

export async function getActiveSignerPubkeyHint(): Promise<string | null> {
  const cfg = storageGetActiveSignerConfig();
  if (!cfg) return null;
  if (cfg.type === "nip07") return null;
  try {
    const sk = hexToBytes(cfg.clientSecretKeyHex);
    return getPublicKey(sk);
  } catch {
    return null;
  }
}
