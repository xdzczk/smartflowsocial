/**
 * Health check and relay sync for NIP-46 signer connection.
 *
 * Health is now derived from the shared SimplePool's WebSocket state instead
 * of a periodic ping, mirroring what Ditto does. `verifySignerConnection`
 * stays available for the Settings "Test connection" button. The previous
 * 60s setInterval that nudged stale events has been removed because it added
 * noise during normal use without preventing real failures (the pool now
 * auto-reconnects sockets, so transient disconnects heal themselves).
 */

import { normalizeURL } from "nostr-tools/utils";

import type { NostrSigner } from "~/features/auth/nostr-signer.client";
import { getSharedPool } from "~/features/nostr/shared-pool.client";

import { NIP46_SIGNER_TYPE } from "./connection-constants";
import {
  normalizeRelayList,
  relayListsEqual,
} from "./connection-relay-utils.client";
import {
  getActiveSignerConfig,
  persistActiveSignerConfigWithoutReset,
} from "./nostr-signer-storage.client";
import {
  addConnectionLog,
  getActiveConnection,
  updateSession,
} from "./remote-signer-sessions.client";

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

export async function syncRelaysWithRemoteSigner(
  signer: NostrSigner
): Promise<{ changed: boolean; relays?: string[]; reason?: string }> {
  if (
    signer.type !== NIP46_SIGNER_TYPE ||
    typeof signer.switchRelays !== "function"
  ) {
    return { changed: false, reason: "unsupported" };
  }

  const config = getActiveSignerConfig();
  if (config?.type !== NIP46_SIGNER_TYPE) {
    return { changed: false, reason: "not_nip46" };
  }

  if (config.method !== "nostrconnect_uri") {
    return { changed: false, reason: "not_nostrconnect_uri" };
  }

  const switched = await signer.switchRelays();
  if (!switched) {
    debugTrace("switch_relays returned no updates");
    return { changed: false, reason: "no_change" };
  }

  const normalized = normalizeRelayList(switched);
  const currentRelays = config.relays;
  if (normalized.length === 0 || relayListsEqual(normalized, currentRelays)) {
    debugTrace("switch_relays result unchanged/invalid", {
      relayCount: normalized.length,
    });
    return { changed: false, reason: "unchanged" };
  }

  persistActiveSignerConfigWithoutReset({ ...config, relays: normalized });

  const activeConnection = getActiveConnection();
  if (activeConnection?.config.type === NIP46_SIGNER_TYPE) {
    const updatedConfig =
      activeConnection.config.method === "nostrconnect_uri"
        ? { ...activeConnection.config, relays: normalized }
        : activeConnection.config;
    updateSession(activeConnection.id, {
      config: updatedConfig,
      metadata: {
        ...activeConnection.metadata,
        relays: normalized,
        lastActivityAt: Date.now(),
      },
    });
    addConnectionLog(activeConnection.id, {
      type: "health_check",
      status: "success",
      message: "Relays updated via switch_relays",
      details: { relayCount: normalized.length },
    });
  }

  debugTrace("switch_relays updated relay set", {
    relayCount: normalized.length,
  });

  return { changed: true, relays: normalized };
}
