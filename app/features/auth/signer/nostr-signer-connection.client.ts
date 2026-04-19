/**
 * NIP-46/Bunker connection lifecycle: connect, disconnect, reconnect, and
 * signer cache.
 *
 * The previous implementation tracked a small army of cooldowns, generations,
 * "needs reprobe" flags, verify timestamps, and visibility-resume probes.
 * Those were all working around the same root cause: the underlying SimplePool
 * used to disconnect silently. Now that the shared pool keeps its sockets
 * healthy and `Nip46Signer` RPCs are bounded, this module can stay tiny: cache
 * a signer, reuse it while the transport is open, and rebuild it once on
 * demand if the transport drops. We do nothing on visibility change — the pool
 * auto-reconnects sockets, and the next user sign discovers liveness on its
 * own.
 */

import {
  Nip07Signer,
  type NostrSigner,
} from "~/features/auth/nostr-signer.client";

import {
  cacheNip46SignerFromLogin as cacheNip46SignerFromLoginImpl,
  getCachedSigner,
  getInFlightSignerConfigJson,
  getInFlightSignerPromise,
  resetCachedSigner,
  setCachedSigner,
  setInFlightSignerConfigJson,
  setInFlightSignerPromise,
} from "./connection-cache.client";
import { createNip46SignerFromStoredConfig as createNip46SignerFromStoredConfigImpl } from "./connection-connect.client";
import {
  NIP46_SIGNER_TYPE,
  NOSTR_CONNECTION_HEALTHY_EVENT,
  NOSTR_CONNECTION_STALE_EVENT,
} from "./connection-constants";
import { syncRelaysWithRemoteSigner } from "./connection-health.client";
import { resolveNip46SignerFromConfig } from "./connection-resolve.client";
import {
  getActiveSignerConfig,
  persistActiveSignerConfigWithoutReset,
  setActiveSignerConfig,
} from "./nostr-signer-storage.client";
import {
  detectSignerAppName,
  getActiveConnection,
  updateSession,
} from "./remote-signer-sessions.client";
import { recordConnectionEvent } from "./remote-signer-status.client";

export { NOSTR_CONNECTION_STALE_EVENT, NOSTR_CONNECTION_HEALTHY_EVENT };
export { syncRelaysWithRemoteSigner };

export interface GetActiveSignerOptions {
  allowReconnect?: boolean;
}

/**
 * Clear the in-memory signer cache without removing persisted config.
 */
export { resetCachedSigner };

function clearCachedNip46Signer(): void {
  const config = getActiveSignerConfig();
  const cachedSigner = getCachedSigner();
  if (config?.type !== NIP46_SIGNER_TYPE || !cachedSigner) return;

  if (cachedSigner.type === NIP46_SIGNER_TYPE && cachedSigner.close) {
    const closeFn = cachedSigner.close;
    void (async () => {
      try {
        await closeFn();
      } catch {
        // ignore
      }
    })();
  }
  const connection = getActiveConnection();
  if (connection?.config.type === NIP46_SIGNER_TYPE) {
    recordConnectionEvent(connection.id, {
      type: "disconnected",
      reason: "Connection closed",
    });
  }
  resetCachedSigner();
}

export function teardownActiveNip46Signer(): void {
  clearCachedNip46Signer();
}

export function cacheNip46SignerFromLogin(signer: NostrSigner): void {
  cacheNip46SignerFromLoginImpl(signer);
}

export { createNip46SignerFromStoredConfigImpl as createNip46SignerFromStoredConfig };

/**
 * Reuse the cached signer if we have one. We deliberately do not ping the
 * bunker or inspect the shared pool before every reuse: the pool already
 * auto-reconnects sockets and `BunkerSigner` re-creates its REQ subscription
 * on `sendRequest` if it was closed. The previous transport-health gate could
 * also wrongly throw away a freshly-cached login signer (e.g. for
 * bunker_input configs the persisted `relays` field can be empty), forcing
 * the next sign call to rebuild a new BunkerSigner subscription that the
 * remote signer app may not see in time. We now trust the cached signer and
 * let the next real RPC discover liveness on its own — the adapter has a
 * reconnect-and-retry path for the rare case where it does fail.
 */
function tryGetValidCachedSigner(): NostrSigner | null {
  return getCachedSigner();
}

function isConnectionRelatedError(err: unknown): boolean {
  const msg =
    err instanceof Error
      ? err.message.toLowerCase()
      : String(err).toLowerCase();
  const keywords = [
    "subscription closed",
    "websocket",
    "closed",
    "connection",
    "connecting",
    "timeout",
    "too long",
  ];
  return keywords.some((k) => msg.includes(k));
}

function handleSignerConnectionError(err: unknown): void {
  resetCachedSigner();

  const activeConnection = getActiveConnection();
  if (activeConnection) {
    const fullErrorMessage = err instanceof Error ? err.message : String(err);
    recordConnectionEvent(activeConnection.id, {
      type: "error",
      error: fullErrorMessage,
    });
    recordConnectionEvent(activeConnection.id, {
      type: "disconnected",
      reason: fullErrorMessage,
    });
  }
}

export async function getActiveSigner(
  options?: GetActiveSignerOptions
): Promise<NostrSigner | null> {
  const allowReconnect = options?.allowReconnect ?? true;

  const fromCache = tryGetValidCachedSigner();
  if (fromCache) return fromCache;

  const config = getActiveSignerConfig();
  if (!config) return null;

  if (config.type === "nip07") {
    const nip07 = new Nip07Signer();
    setCachedSigner(nip07);
    return nip07;
  }

  const nip46Config = config;
  const configJson = JSON.stringify(config);
  if (!allowReconnect) return null;
  const inFlight = getInFlightSignerPromise();
  if (inFlight && getInFlightSignerConfigJson() === configJson) {
    return await inFlight;
  }

  const isRequestCurrent = () => {
    const latest = getActiveSignerConfig();
    return latest !== null && JSON.stringify(latest) === configJson;
  };

  const connectPromise = resolveNip46SignerFromConfig(nip46Config, {
    isRequestCurrent,
    setCachedSigner,
    getCachedSigner,
    getActiveConnection,
    updateSession,
    recordConnectionEvent,
    syncRelaysWithRemoteSigner,
    persistActiveSignerConfigWithoutReset,
  });

  setInFlightSignerPromise(connectPromise);
  setInFlightSignerConfigJson(configJson);
  try {
    return await connectPromise;
  } catch (err: unknown) {
    if (isConnectionRelatedError(err)) {
      handleSignerConnectionError(err);
    }
    throw err;
  } finally {
    if (getInFlightSignerPromise() === connectPromise) {
      setInFlightSignerPromise(null);
      setInFlightSignerConfigJson(null);
    }
  }
}

let backgroundReconnectInProgress = false;
const BACKGROUND_RECONNECT_TIMEOUT_MS = 20_000;

export async function tryBackgroundReconnect(): Promise<boolean> {
  if (backgroundReconnectInProgress) return false;
  const config = getActiveSignerConfig();
  if (config?.type !== NIP46_SIGNER_TYPE) return false;
  const connection = getActiveConnection();
  if (!connection) return false;

  backgroundReconnectInProgress = true;
  // Capture the previous cached signer BEFORE we build the new one so we can
  // close it after the swap. Closing it before the swap would leave a window
  // where signing calls have nothing to talk to; not capturing it would leak
  // the old BunkerSigner subscription and listeners. The shared pool stays up
  // either way.
  const previousSigner = getCachedSigner();
  try {
    const { signer, pubkey } = await createNip46SignerFromStoredConfigImpl(
      config,
      {
        timeoutMs: BACKGROUND_RECONNECT_TIMEOUT_MS,
      }
    );
    const detectedAppName = detectSignerAppName(config);
    setActiveSignerConfig(config);
    cacheNip46SignerFromLogin(signer);
    if (
      previousSigner &&
      previousSigner !== (signer as unknown as NostrSigner) &&
      previousSigner.type === NIP46_SIGNER_TYPE &&
      typeof previousSigner.close === "function"
    ) {
      const closeFn = previousSigner.close;
      void (async () => {
        try {
          await closeFn();
        } catch {
          // ignore - swap is already complete, leak of subscription is best-effort cleanup
        }
      })();
    }
    updateSession(connection.id, {
      metadata: {
        ...connection.metadata,
        pubkey,
        signerAppName: detectedAppName,
        status: "active",
        connectedAt: Date.now(),
        lastActivityAt: Date.now(),
        lastError: null,
      },
    });
    recordConnectionEvent(connection.id, { type: "connected", pubkey });
    await syncRelaysWithRemoteSigner(signer);
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent(NOSTR_CONNECTION_HEALTHY_EVENT));
    }
    void (async () => {
      try {
        const { reportSignerReconnectOutcome } =
          await import("~/lib/telemetry/signer-reconnect-report.client");
        reportSignerReconnectOutcome({ success: true });
      } catch {
        /* ignore */
      }
    })();
    return true;
  } catch (err: unknown) {
    void (async () => {
      try {
        const { reportSignerReconnectOutcome, mapReconnectErrorToBucket } =
          await import("~/lib/telemetry/signer-reconnect-report.client");
        reportSignerReconnectOutcome({
          success: false,
          failureBucket: mapReconnectErrorToBucket(err),
        });
      } catch {
        /* ignore */
      }
    })();
    return false;
  } finally {
    backgroundReconnectInProgress = false;
  }
}
