/**
 * Health check and relay sync for NIP-46 signer connection.
 */

import type { NostrSigner } from "~/features/auth/nostr-signer.client";

import {
  getCachedSigner,
  getConnectionEstablishedAt,
  getLastActivityTime,
  getLastRelaySyncAt,
  getLastVerificationTime,
  setLastActivityTime,
  setLastRelaySyncAt,
  setLastVerificationTime,
} from "./connection-cache.client";
import {
  NIP46_SIGNER_TYPE,
  NOSTR_CONNECTION_STALE_EVENT,
  RECONNECT_GRACE_MS,
  RELAY_SYNC_COOLDOWN_MS,
  VERIFY_BEFORE_USE_TIMEOUT_MS,
} from "./connection-constants";
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
    const now = Date.now();
    setLastActivityTime(now);
    setLastVerificationTime(now);
    return true;
  } catch {
    return false;
  }
}

let healthCheckInterval: ReturnType<typeof setInterval> | null = null;

export function startHealthCheckMonitoring(): void {
  if (healthCheckInterval) return;

  healthCheckInterval = setInterval(
    () => {
      void (async () => {
        const config = getActiveSignerConfig();
        const cachedSigner = getCachedSigner();
        if (config?.type !== NIP46_SIGNER_TYPE || !cachedSigner) {
          if (healthCheckInterval) {
            clearInterval(healthCheckInterval);
            healthCheckInterval = null;
          }
          return;
        }

        const now = Date.now();
        const _lastVerificationTime = getLastVerificationTime();
        const _lastRelaySyncAt = getLastRelaySyncAt();
        const connectionEstablishedAt = getConnectionEstablishedAt();
        const _lastActivityTime = getLastActivityTime();

        const timeSinceLastVerification = _lastVerificationTime
          ? now - _lastVerificationTime
          : Infinity;
        const shouldSyncRelays =
          cachedSigner.type === NIP46_SIGNER_TYPE &&
          (_lastRelaySyncAt == null ||
            now - _lastRelaySyncAt > RELAY_SYNC_COOLDOWN_MS);

        const connectionAge = connectionEstablishedAt
          ? now - connectionEstablishedAt
          : 0;
        const idleLongEnough =
          (_lastActivityTime ? now - _lastActivityTime : Infinity) >
          5 * 60 * 1000;
        const verificationStale = timeSinceLastVerification > 5 * 60 * 1000;

        if (
          connectionEstablishedAt &&
          connectionAge > RECONNECT_GRACE_MS &&
          (idleLongEnough || verificationStale)
        ) {
          const signerToCheck = cachedSigner;
          const isValid = await verifySignerConnection(
            signerToCheck,
            VERIFY_BEFORE_USE_TIMEOUT_MS
          );
          if (!isValid) {
            if (
              getCachedSigner() === signerToCheck &&
              typeof window !== "undefined"
            ) {
              window.dispatchEvent(
                new CustomEvent(NOSTR_CONNECTION_STALE_EVENT, {
                  detail: { signerType: NIP46_SIGNER_TYPE },
                })
              );
            }
          } else if (getCachedSigner() === signerToCheck) {
            setLastActivityTime(Date.now());
          }
        }

        if (shouldSyncRelays && getCachedSigner()?.type === NIP46_SIGNER_TYPE) {
          try {
            await syncRelaysWithRemoteSigner(getCachedSigner()!);
          } catch {
            // best-effort
          }
        }
      })();
    },
    1 * 60 * 1000
  );
}

export function stopHealthCheckMonitoring(): void {
  if (healthCheckInterval) {
    clearInterval(healthCheckInterval);
    healthCheckInterval = null;
  }
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

  const switched = await signer.switchRelays();
  setLastRelaySyncAt(Date.now());
  if (!switched) {
    debugTrace("switch_relays returned no updates");
    return { changed: false, reason: "no_change" };
  }

  const normalized = normalizeRelayList(switched);
  const currentRelays =
    config.method === "nostrconnect_uri"
      ? config.relays
      : ((config as { relays?: string[] }).relays ?? []);
  if (normalized.length === 0 || relayListsEqual(normalized, currentRelays)) {
    debugTrace("switch_relays result unchanged/invalid", {
      relayCount: normalized.length,
    });
    return { changed: false, reason: "unchanged" };
  }

  persistActiveSignerConfigWithoutReset({ ...config, relays: normalized });

  const activeConnection = getActiveConnection();
  if (activeConnection?.config.type === NIP46_SIGNER_TYPE) {
    const updatedConfig = { ...activeConnection.config, relays: normalized };
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
