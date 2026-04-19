/**
 * In-memory cache and in-flight dedup state for NIP-46 signer connection.
 * Used by the connection orchestrator and health module.
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
let connectionEstablishedAt: number | null = null;
let _lastActivityTime: number | null = null;
let _lastVerificationTime: number | null = null;
let _lastRelaySyncAt: number | null = null;
let wasHidden = false;
let lastVisibilityReconnectAt = 0;

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
export function getConnectionEstablishedAt(): number | null {
  return connectionEstablishedAt;
}
export function setConnectionEstablishedAt(n: number | null): void {
  connectionEstablishedAt = n;
}
export function getLastActivityTime(): number | null {
  return _lastActivityTime;
}
export function setLastActivityTime(n: number | null): void {
  _lastActivityTime = n;
}
export function getLastVerificationTime(): number | null {
  return _lastVerificationTime;
}
export function setLastVerificationTime(n: number | null): void {
  _lastVerificationTime = n;
}
export function getLastRelaySyncAt(): number | null {
  return _lastRelaySyncAt;
}
export function setLastRelaySyncAt(n: number | null): void {
  _lastRelaySyncAt = n;
}
export function getWasHidden(): boolean {
  return wasHidden;
}
export function setWasHidden(b: boolean): void {
  wasHidden = b;
}
export function getLastVisibilityReconnectAt(): number {
  return lastVisibilityReconnectAt;
}
export function setLastVisibilityReconnectAt(n: number): void {
  lastVisibilityReconnectAt = n;
}

/**
 * Clear in-memory signer cache (no close, no health stop).
 */
export function resetCachedSigner(): void {
  cachedSigner = null;
  _lastVerificationTime = null;
  _lastRelaySyncAt = null;
  inFlightSignerPromise = null;
  inFlightSignerConfigJson = null;
}

/**
 * Record a successful sign; updates activity and verification timestamps.
 * A successful sign indicates the connection is live, so we update both for consistency with tests and monitoring.
 */
export function recordSuccessfulSign(): void {
  const now = Date.now();
  _lastActivityTime = now;
  _lastVerificationTime = now;
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
  const now = Date.now();
  connectionEstablishedAt = now;
  _lastActivityTime = now;
  _lastVerificationTime = now;
  onCached?.();
}
