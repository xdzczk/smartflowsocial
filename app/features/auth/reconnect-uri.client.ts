/**
 * Bunker and Nostr Connect URI handling for reconnect flow.
 * Pending reconnect storage survives app backgrounding (e.g. user switches to signer app).
 */

import { parseBunkerInput as nip46ParseBunkerInput } from "nostr-tools/nip46";

import { parseSecretKeyHex, serializeSecretKey } from "~/features/auth/signer";
import { isStandalonePWA } from "~/lib/is-standalone-pwa";

import {
  createNip46NostrConnectUri as createUriFromSigner,
  getNostrConnectAppMetadata,
} from "./nostr-signer.client";
import { parseRelayList } from "./parse-relay-list";

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

/** Append callback so Primal redirects back to app (skip in standalone PWA). */
export function appendPrimalCallback(uri: string): string {
  if (isStandalonePWA()) return uri;
  if (typeof window === "undefined") return uri;
  if (uri.includes("callback=")) return uri;

  const callbackUrl =
    window.location.origin + window.location.pathname + window.location.search;
  const separator = uri.includes("?") ? "&" : "?";
  return `${uri}${separator}callback=${encodeURIComponent(callbackUrl)}`;
}

/** Create NIP-46 Nostr Connect URI with app metadata. */
export function createNip46NostrConnectUri(relays: string[]) {
  return createUriFromSigner({
    relays,
    appName: "SmartFlowSocial",
    ...getNostrConnectAppMetadata(),
  });
}

const PENDING_RECONNECT_STORAGE_KEY = "__smartflow_pending_reconnect_nip46_v1";

export interface PendingReconnect {
  uri: string;
  clientSecretKey: Uint8Array;
  relays: string[];
}

export function getPendingReconnect(): PendingReconnect | null {
  try {
    const raw =
      typeof sessionStorage !== "undefined"
        ? sessionStorage.getItem(PENDING_RECONNECT_STORAGE_KEY)
        : null;
    if (!raw) return null;
    const parsed = JSON.parse(raw) as {
      uri: string;
      clientSecretKeyHex: string;
      relays: string[];
    };
    return {
      uri: parsed.uri,
      clientSecretKey: parseSecretKeyHex(parsed.clientSecretKeyHex),
      relays: parsed.relays,
    };
  } catch {
    return null;
  }
}

export function setPendingReconnect(
  uri: string,
  clientSecretKey: Uint8Array,
  relays: string[]
): void {
  const payload = {
    uri,
    clientSecretKeyHex: serializeSecretKey(clientSecretKey),
    relays,
  };
  try {
    if (typeof sessionStorage !== "undefined") {
      sessionStorage.setItem(
        PENDING_RECONNECT_STORAGE_KEY,
        JSON.stringify(payload)
      );
    }
  } catch {
    // ignore
  }
}

export function clearPendingReconnectStorage(): void {
  try {
    if (typeof sessionStorage !== "undefined") {
      sessionStorage.removeItem(PENDING_RECONNECT_STORAGE_KEY);
    }
  } catch {
    // ignore
  }
}
