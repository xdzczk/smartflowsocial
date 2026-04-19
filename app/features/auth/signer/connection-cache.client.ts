/**
 * In-memory cache and in-flight dedup state for NIP-46 signer connection.
 *
 * Trimmed deliberately. The previous implementation tracked a small army of
 * timestamps (`connectionEstablishedAt`, `lastVerificationTime`,
 * `lastRelaySyncAt`, `lastActivityTime`) plus visibility-resume bookkeeping
 * (`wasHidden`, `lastVisibilityReconnectAt`) so heuristics could decide whether
 * a cached signer was "fresh enough" to reuse and whether to reprobe on tab
 * focus. None of those values gate any behavior anymore: reuse is decided
 * exclusively by `isTransportLikelyHealthy()` against the shared pool's
 * WebSocket state, and the pool's own auto-reconnect handles tab resume.
 */

import type { NostrSigner } from "~/features/auth/nostr-signer.client";

import { NIP46_SIGNER_TYPE } from "./connection-constants";
import {
  getActiveSignerConfig,
  setCachedConfigJson,
} from "./nostr-signer-storage.client";

let cachedSigner: NostrSigner | null = null;
let inFlightSignerPromise: Promise<NostrSigner | null> | null = null;
let inFlightSignerConfigJson: string | null = null;

export function getCachedSigner(): NostrSigner | null {
  return cachedSigner;
}
export function setCachedSigner(s: NostrSigner | null): void {
  cachedSigner = s;
}
export function getInFlightSignerPromise(): Promise<NostrSigner | null> | null {
  return inFlightSignerPromise;
}
export function setInFlightSignerPromise(
  p: Promise<NostrSigner | null> | null
): void {
  inFlightSignerPromise = p;
}
export function getInFlightSignerConfigJson(): string | null {
  return inFlightSignerConfigJson;
}
export function setInFlightSignerConfigJson(s: string | null): void {
  inFlightSignerConfigJson = s;
}

/**
 * Clear in-memory signer cache (no close, no health stop).
 */
export function resetCachedSigner(): void {
  cachedSigner = null;
  inFlightSignerPromise = null;
  inFlightSignerConfigJson = null;
}

/**
 * Cache a NIP-46 signer after login; caller can run onCached for any extra side effects.
 */
export function cacheNip46SignerFromLogin(
  signer: NostrSigner,
  onCached?: () => void
): void {
  if (signer.type !== NIP46_SIGNER_TYPE) return;
  const config = getActiveSignerConfig();
  if (config?.type !== NIP46_SIGNER_TYPE) return;
  cachedSigner = signer;
  setCachedConfigJson(JSON.stringify(config));
  onCached?.();
}
