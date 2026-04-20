/**
 * Bunker and Nostr Connect URI handling for reconnect flow.
 * Pending reconnect storage survives app backgrounding (e.g. user switches to signer app).
 */

import { parseBunkerInput as nip46ParseBunkerInput } from "nostr-tools/nip46";

import { BRAND_NAME } from "~/lib/brand";
import { isStandalonePWA } from "~/lib/is-standalone-pwa";

import {
  createNip46NostrConnectUri as createUriFromSigner,
  getNostrConnectAppMetadata,
} from "./nostr-signer.client";
import { parseRelayList } from "./parse-relay-list";
import {
  clearPendingNip46Handoff,
  readPendingNip46Handoff,
  writePendingNip46Handoff,
} from "./pending-nip46-storage.client";

export { parseRelayList };

/** Re-export for callers that need to parse bunker input. */
export const parseBunkerInput = nip46ParseBunkerInput;

/** Canonical key for bunker identity (pubkey + normalized relays + secret) for reconnect vs new comparison. */
export function bunkerCanonicalKey(bp: {
  pubkey: string;
  relays: string[];
  secret: null | string;
}): string {
  const normalized = bp.relays
    .map((r) => r.trim().toLowerCase())
    .filter((r) => r.startsWith("wss://"));
  const sorted = [...new Set(normalized)].sort();
  return `${bp.pubkey}\n${sorted.join(",")}\n${bp.secret ?? ""}`;
}

/**
 * Path of the dedicated signer-callback page (see
 * `app/routes/auth.signer-callback.tsx`). Pinned to a constant — and
 * pinned to a URL that does NOT match the sign-in page — because the
 * whole point of using a dedicated route is to make iOS Safari open
 * the callback in a NEW tab instead of refocusing the existing
 * sign-in tab. A URL match against the sign-in tab triggers a
 * page-lifecycle transition (hidden -> visible via inter-app handoff
 * with bfcache eligibility) under which WebKit can drop the queued
 * NIP-46 reply frame on the WebSocket; Ditto avoids this by pointing
 * its callback at a separate page, and we mirror that here. Diagnosed
 * against the strict 50/50 alternating `bunker:get_public_key timeout`
 * we saw on Primal Signer + iPhone.
 */
export const SIGNER_CALLBACK_PATH = "/auth/signer-callback";

/** Append callback so Primal redirects back to app (skip in standalone PWA). */
export function appendPrimalCallback(uri: string): string {
  if (isStandalonePWA()) return uri;
  if (typeof window === "undefined") return uri;
  if (uri.includes("callback=")) return uri;

  // Intentionally a different URL from `window.location.{pathname,search}` —
  // see `SIGNER_CALLBACK_PATH` for the iOS Safari rationale.
  const callbackUrl = window.location.origin + SIGNER_CALLBACK_PATH;
  const separator = uri.includes("?") ? "&" : "?";
  return `${uri}${separator}callback=${encodeURIComponent(callbackUrl)}`;
}

/** Create NIP-46 Nostr Connect URI with app metadata. */
export function createNip46NostrConnectUri(relays: string[]) {
  return createUriFromSigner({
    relays,
    appName: BRAND_NAME,
    ...getNostrConnectAppMetadata(),
  });
}

/**
 * Persisted via the shared `pending-nip46-storage` helper so iOS Safari can't
 * drop the handoff between Primal and our HTTPS callback when the deep-link
 * return restores the tab in a fresh browsing context.
 */
const PENDING_RECONNECT_STORAGE_KEY = "__smartflow_pending_reconnect_nip46_v1";

export interface PendingReconnect {
  uri: string;
  clientSecretKey: Uint8Array;
  relays: string[];
}

export function getPendingReconnect(): PendingReconnect | null {
  return readPendingNip46Handoff(PENDING_RECONNECT_STORAGE_KEY);
}

export function setPendingReconnect(
  uri: string,
  clientSecretKey: Uint8Array,
  relays: string[]
): void {
  writePendingNip46Handoff(PENDING_RECONNECT_STORAGE_KEY, {
    uri,
    clientSecretKey,
    relays,
  });
}

export function clearPendingReconnectStorage(): void {
  clearPendingNip46Handoff(PENDING_RECONNECT_STORAGE_KEY);
}
