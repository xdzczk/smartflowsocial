/**
 * NIP-46/Bunker connection lifecycle: connect, disconnect, reconnect,
 * visibility handling, and signer cache.
 *
 * The previous implementation tracked a small army of cooldowns, generations,
 * "needs reprobe" flags and verify timestamps. Those were all working around
 * the same root cause: the underlying SimplePool used to disconnect silently.
 * Now that the shared pool keeps its sockets healthy and `Nip46Signer` RPCs
 * are bounded, this module can stay tiny: cache a signer, reuse it while the
 * transport is open, and rebuild it once on demand if the transport drops.
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
  getLastActivityTime,
  recordSuccessfulSign as recordSuccessfulSignImpl,
  resetCachedSigner,
  setCachedSigner,
  setConnectionEstablishedAt,
  setInFlightSignerConfigJson,
  setInFlightSignerPromise,
  setLastActivityTime,
  setLastVisibilityReconnectAt,
  setWasHidden,
  getWasHidden,
  getLastVisibilityReconnectAt,
} from "./connection-cache.client";
import { createNip46SignerFromStoredConfig as createNip46SignerFromStoredConfigImpl } from "./connection-connect.client";
import {
  NIP46_SIGNER_TYPE,
  NOSTR_CONNECTION_HEALTHY_EVENT,
  NOSTR_CONNECTION_STALE_EVENT,
  VISIBILITY_RECONNECT_THROTTLE_MS,
} from "./connection-constants";
import {
  isTransportLikelyHealthy,
  syncRelaysWithRemoteSigner,
  verifySignerConnection,
} from "./connection-health.client";
import { resolveNip46SignerFromConfig } from "./connection-resolve.client";
import { initVisibilityHandler as initVisibilityHandlerImpl } from "./connection-visibility.client";
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

let visibilityHandlerCleanup: (() => void) | null = null;

function debugSignerManagerTrace(
  message: string,
  details?: Record<string, unknown>
): void {
  if (details) {
    console.info(`[remote-signer-sign] ${message}`, details);
    return;
  }
  console.info(`[remote-signer-sign] ${message}`);
}

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
  setConnectionEstablishedAt(null);
  setLastActivityTime(null);
}

export function teardownActiveNip46Signer(): void {
  clearCachedNip46Signer();
}

export function teardownVisibilityHandler(): void {
  if (visibilityHandlerCleanup) {
    visibilityHandlerCleanup();
    visibilityHandlerCleanup = null;
  }
}

/**
 * On resume, only nudge a background reconnect when the cached signer's
 * transport is actually unhealthy. The pool itself auto-reconnects sockets, so
 * doing nothing here is the right answer in the vast majority of cases.
 */
async function maybeReconnectOnResume(): Promise<void> {
  const cached = getCachedSigner();
  if (cached?.type !== NIP46_SIGNER_TYPE) return;
  if (isTransportLikelyHealthy()) return;
  const ok = await verifySignerConnection(cached, 4_000);
  if (!ok) {
    debugSignerManagerTrace("Resume probe failed; reconnecting in background");
    void tryBackgroundReconnect();
  }
}

function setupVisibilityHandler(): void {
  if (typeof window === "undefined") return;
  visibilityHandlerCleanup = initVisibilityHandlerImpl({
    onResume: () => void maybeReconnectOnResume(),
    getWasHidden,
    setWasHidden,
    getLastVisibilityReconnectAt,
    setLastVisibilityReconnectAt,
    visibilityReconnectThrottleMs: VISIBILITY_RECONNECT_THROTTLE_MS,
    debugTrace: (msg) => debugSignerManagerTrace(msg),
  });
}
setupVisibilityHandler();

export function cacheNip46SignerFromLogin(signer: NostrSigner): void {
  cacheNip46SignerFromLoginImpl(signer);
}

export function recordSuccessfulSign(): void {
  recordSuccessfulSignImpl();
}

export { createNip46SignerFromStoredConfigImpl as createNip46SignerFromStoredConfig };

/**
 * Reuse the cached signer only when the underlying shared-pool transport
 * still has at least one open WebSocket. We deliberately do not ping the
 * bunker before every reuse: that ping is what made signing feel laggy and
 * still couldn't catch a stale connection any sooner than the next real RPC.
 *
 * For NIP-07 the cached signer is always reusable - there is no transport
 * to check.
 */
const CACHE_ACTIVITY_REFRESH_MS = 30_000;

function tryGetValidCachedSigner(): NostrSigner | null {
  const cachedSigner = getCachedSigner();
  if (!cachedSigner) return null;

  if (cachedSigner.type !== NIP46_SIGNER_TYPE) {
    return cachedSigner;
  }

  if (!isTransportLikelyHealthy()) {
    clearCachedNip46Signer();
    return null;
  }

  const now = Date.now();
  const lastActivity = getLastActivityTime();
  if (lastActivity == null || now - lastActivity > CACHE_ACTIVITY_REFRESH_MS) {
    setLastActivityTime(now);
  }
  return cachedSigner;
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
  setConnectionEstablishedAt(null);
  setLastActivityTime(null);

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
    setConnectionEstablishedAt,
    setLastActivityTime,
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

/**
 * Tear down the current NIP-46 session, clear UI signing state, then start a new
 * session for the same connection (same config). Use when the user wants to
 * "use a new session" in the remote signer app without removing the connection.
 * Call from "Use new session" / "Reconnect signer" buttons on "Waiting for signer" banners.
 */
export async function requestNewSignerSession(
  clearSigningState?: () => void
): Promise<boolean> {
  teardownActiveNip46Signer();
  clearSigningState?.();
  return tryBackgroundReconnect();
}
