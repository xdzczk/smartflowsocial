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
 * Append callback so Primal redirects back to the same sign-in page after
 * the user approves in the signer app (skip in standalone PWA, where there
 * is no separate browser tab to return to and the URL handoff would just
 * relaunch us).
 *
 * We deliberately point the callback at the current sign-in page
 * (`origin + pathname + search`) rather than a dedicated landing route.
 * An earlier iteration used a separate `/auth/signer-callback` page on
 * the theory that returning to the same URL would trigger an iOS Safari
 * bfcache race that drops queued WebSocket frames. Empirically that
 * theory was wrong: the actual cause of the 50/50 alternating
 * `bunker:get_public_key timeout` was an automatic `switch_relays` RPC
 * we used to fire after every successful sign-in, which left Primal's
 * session in a state where the next sign-in's `get_public_key` was
 * silently ignored. Once we removed the auto `switch_relays`, sign-in
 * became fully reliable on the same-tab callback, so the dedicated
 * landing route was reverted in favor of the simpler "Primal returns
 * you to the page you started on" UX.
 */
export function appendPrimalCallback(uri: string): string {
  if (isStandalonePWA()) return uri;
  if (typeof window === "undefined") return uri;
  if (uri.includes("callback=")) return uri;

  const { origin, pathname, search } = window.location;
  const callbackUrl = `${origin}${pathname}${search}`;
  const separator = uri.includes("?") ? "&" : "?";
  return `${uri}${separator}callback=${encodeURIComponent(callbackUrl)}`;
}

/** Amber Android app id (F-Droid / GitHub releases). Used to target Amber via VIEW intent. */
export const AMBER_ANDROID_PACKAGE_ID = "com.greenart7c3.nostrsigner";

/**
 * Wrap a Nostr Connect URI so Chrome/Android opens Amber specifically via intent://
 * (same callback behavior as {@link appendPrimalCallback}). Falls back to `appendPrimalCallback`
 * output if the URI cannot be parsed.
 *
 * @see https://developer.chrome.com/docs/android/intents
 */
export function appendAmberIntentUrl(uri: string): string {
  const withCallback = appendPrimalCallback(uri);
  if (typeof window === "undefined") return withCallback;

  try {
    const u = new URL(withCallback);
    const scheme = u.protocol.replace(/:$/, "");
    if (!scheme) return withCallback;

    const host = u.hostname;
    const path = u.pathname && u.pathname !== "/" ? u.pathname : "";
    const payload = `${host}${path}${u.search}`;
    return `intent://${payload}#Intent;scheme=${scheme};package=${AMBER_ANDROID_PACKAGE_ID};end`;
  } catch {
    return withCallback;
  }
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
