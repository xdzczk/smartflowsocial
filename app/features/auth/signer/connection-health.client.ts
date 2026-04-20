/**
 * Health check and transport-state probe for NIP-46 signer connection.
 *
 * Health is derived from the shared SimplePool's WebSocket state instead
 * of a periodic ping, mirroring what Ditto does. `verifySignerConnection`
 * stays available for the Settings "Test connection" button. The previous
 * 60s setInterval that nudged stale events has been removed because it added
 * noise during normal use without preventing real failures (the pool now
 * auto-reconnects sockets, so transient disconnects heal themselves).
 *
 * Relay sync via `switch_relays` used to live here as well. It was removed
 * after we discovered that Primal Signer never replies to it, so every
 * call timed out 8s, contributed to per-client rate limits on damus.io,
 * and — most importantly — left Primal's session in a state where the
 * NEXT NIP-46 RPC was silently dropped. The relay set captured at login
 * is sufficient for ongoing use; if the user changes relays inside their
 * signer app to a non-overlapping set, they re-pair. Mirrors Nostrify's
 * `NConnectSigner`, which also has no relay-sync path.
 */

import { normalizeURL } from "nostr-tools/utils";

import type { NostrSigner } from "~/features/auth/nostr-signer.client";
import { getSharedPool } from "~/features/nostr/shared-pool.client";

import { NIP46_SIGNER_TYPE } from "./connection-constants";
import { getActiveSignerConfig } from "./nostr-signer-storage.client";

function debugTrace(message: string, details?: Record<string, unknown>): void {
  if (details) {
    console.info(`[remote-signer-sign] ${message}`, details);
    return;
  }
  console.info(`[remote-signer-sign] ${message}`);
}

export async function verifySignerConnection(
  signer: NostrSigner,
  timeoutMs = 5000
): Promise<boolean> {
  if (signer.type !== NIP46_SIGNER_TYPE) return true;

  if (typeof signer.ping !== "function") {
    debugTrace("Ping unavailable, skipping verification");
    return true;
  }

  try {
    debugTrace("Running ping-based signer health check");
    await Promise.race([
      signer.ping(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Ping check timeout")), timeoutMs)
      ),
    ]);
    return true;
  } catch {
    return false;
  }
}

/**
 * Cheap, synchronous transport-health check based on the shared pool's
 * WebSocket state. Returns true if at least one of the bunker's relays has an
 * open socket. We do not RPC the bunker here — that would add a per-call
 * ping, which is what the periodic monitor used to do and which we
 * intentionally removed.
 */
export function isTransportLikelyHealthy(): boolean {
  const cfg = getActiveSignerConfig();
  if (cfg?.type !== NIP46_SIGNER_TYPE) return false;

  const relays =
    cfg.method === "bunker_input"
      ? (cfg.relays ?? [])
      : (cfg.bunkerPointer?.relays ?? cfg.relays);
  if (relays.length === 0) return false;

  const pool = getSharedPool();
  const internalRelays = (
    pool as unknown as {
      relays: Map<string, { connected?: boolean }>;
    }
  ).relays;

  return relays.some((url) => {
    try {
      const r = internalRelays.get(normalizeURL(url));
      return r?.connected === true;
    } catch {
      return false;
    }
  });
}
