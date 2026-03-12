/**
 * Shared payment helpers: env parsing, relay error detection, NWC relay overrides.
 * Used by payment commands, handlers, and queries.
 */

import { env } from "~/lib/env.server";

export function parseCsvEnv(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
}

export function isLikelyWebsocketRelayError(message: string): boolean {
  const m = message.toLowerCase();
  return (
    m.includes("failed to connect to any relay") ||
    m.includes("failed to connect to wss://") ||
    m.includes("network error") ||
    m.includes("received network error") ||
    m.includes("non-101 status code") ||
    m.includes("econnrefused") ||
    m.includes("timeout") ||
    m.includes("nip47networkerror")
  );
}

/**
 * Apply relay overrides to an OWNER_NWC (nostr+walletconnect://...) URL.
 *
 * Supported env vars:
 * - OWNER_NWC_RELAYS: comma-separated list of relay URLs (overrides relays in OWNER_NWC)
 * - OWNER_NWC_RELAY: single relay URL (same as OWNER_NWC_RELAYS with one entry)
 */
export function getOwnerNwcWithRelayOverrides(ownerNwc: string): {
  credentials: string;
  relays: string[];
} {
  const relaysEnv = env.OWNER_NWC_RELAYS;
  const relayEnv = env.OWNER_NWC_RELAY;
  const overrideRelays =
    parseCsvEnv(relaysEnv).length > 0
      ? parseCsvEnv(relaysEnv)
      : parseCsvEnv(relayEnv);

  if (overrideRelays.length === 0) {
    try {
      const url = new URL(ownerNwc);
      return {
        credentials: ownerNwc,
        relays: url.searchParams.getAll("relay"),
      };
    } catch {
      return { credentials: ownerNwc, relays: [] };
    }
  }

  try {
    const url = new URL(ownerNwc);
    url.searchParams.delete("relay");
    for (const relay of overrideRelays) {
      url.searchParams.append("relay", relay);
    }
    return { credentials: url.toString(), relays: overrideRelays };
  } catch {
    return { credentials: ownerNwc, relays: overrideRelays };
  }
}
