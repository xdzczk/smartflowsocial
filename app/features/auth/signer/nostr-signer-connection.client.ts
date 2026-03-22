/**
 * NIP-46/Bunker connection lifecycle: connect, disconnect, reconnect,
 * visibility handling, health checks, and signer cache.
 */

import {
  Nip07Signer,
  type NostrSigner,
} from "~/features/auth/nostr-signer.client";
import { isMobile } from "~/lib/is-mobile";

import {
  cacheNip46SignerFromLogin as cacheNip46SignerFromLoginImpl,
  getCachedSigner,
  getConnectionEstablishedAt,
  getInFlightSignerConfigJson,
  getInFlightSignerPromise,
  getLastActivityTime,
  getLastVerificationTime,
  getNeedsReprobe,
  getSignerGeneration,
  getSignerResolutionRequestId,
  incrementSignerGeneration,
  incrementSignerResolutionRequestId,
  recordSuccessfulSign as recordSuccessfulSignImpl,
  resetCachedSigner,
  setCachedSigner,
  setConnectionEstablishedAt,
  setInFlightSignerConfigJson,
  setInFlightSignerPromise,
  setLastActivityTime,
  setLastVerificationTime,
  setLastVisibilityReconnectAt,
  setNeedsReprobe,
  setTeardownInProgress,
  setWasHidden,
  getWasHidden,
  getLastVisibilityReconnectAt,
  getTeardownInProgress,
  getConnectionCooldownUntil,
  setConnectionCooldownUntil,
} from "./connection-cache.client";
import { createNip46SignerFromStoredConfig as createNip46SignerFromStoredConfigImpl } from "./connection-connect.client";
import {
  CONNECTION_FRESH_MS,
  NIP46_SIGNER_TYPE,
  NOSTR_CONNECTION_HEALTHY_EVENT,
  NOSTR_CONNECTION_STALE_EVENT,
  RECENT_ACTIVITY_WINDOW_MS,
  RECONNECT_GRACE_MS,
  VERIFY_BEFORE_USE_TIMEOUT_MS,
  VERIFY_COOLDOWN_MS,
  VISIBILITY_RECONNECT_THROTTLE_MS,
} from "./connection-constants";
import {
  startHealthCheckMonitoring,
  stopHealthCheckMonitoring,
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

function isIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

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

  incrementSignerGeneration();
  if (!getTeardownInProgress()) {
    setTeardownInProgress(true);
    if (cachedSigner.type === NIP46_SIGNER_TYPE && cachedSigner.close) {
      const closeFn = cachedSigner.close;
      void (async () => {
        try {
          await closeFn();
        } catch {
          // ignore
        } finally {
          setTeardownInProgress(false);
        }
      })();
    } else {
      setTeardownInProgress(false);
    }
  }
  const connection = getActiveConnection();
  if (connection?.config.type === NIP46_SIGNER_TYPE) {
    recordConnectionEvent(connection.id, {
      type: "disconnected",
      reason: "Connection closed",
    });
  }
  resetCachedSigner();
  stopHealthCheckMonitoring();
  setConnectionEstablishedAt(null);
  setLastActivityTime(null);
}

export function teardownActiveNip46Signer(): void {
  clearCachedNip46Signer();
}

function _teardownNip46SignerAndSetNeedsReprobe(): void {
  const config = getActiveSignerConfig();
  if (config?.type !== NIP46_SIGNER_TYPE) return;
  clearCachedNip46Signer();
  setNeedsReprobe(true);
}

export function teardownVisibilityHandler(): void {
  if (visibilityHandlerCleanup) {
    visibilityHandlerCleanup();
    visibilityHandlerCleanup = null;
  }
}

function setupVisibilityHandler(): void {
  if (typeof window === "undefined") return;
  visibilityHandlerCleanup = initVisibilityHandlerImpl({
    onResume: () => void tryBackgroundReconnect(),
    onTeardown: _teardownNip46SignerAndSetNeedsReprobe,
    getConfig: getActiveSignerConfig,
    getCachedSigner,
    getTeardownInProgress,
    isMobile,
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
  cacheNip46SignerFromLoginImpl(signer, startHealthCheckMonitoring);
}

export function recordSuccessfulSign(): void {
  recordSuccessfulSignImpl();
}

export { createNip46SignerFromStoredConfigImpl as createNip46SignerFromStoredConfig };

/** Returns the cached signer if still valid (skip verify or verify passed); null otherwise. */
async function tryGetValidCachedSigner(): Promise<NostrSigner | null> {
  const cachedSigner = getCachedSigner();
  if (!cachedSigner) return null;

  const now = Date.now();
  const connectionEstablishedAt = getConnectionEstablishedAt();
  const connectionAge = connectionEstablishedAt
    ? now - connectionEstablishedAt
    : 0;
  const withinReconnectGrace = connectionAge < RECONNECT_GRACE_MS;
  const _lastVerificationTime = getLastVerificationTime();
  const recentlyVerified =
    _lastVerificationTime != null &&
    now - _lastVerificationTime <= VERIFY_COOLDOWN_MS;
  const connectionFresh = connectionAge < CONNECTION_FRESH_MS;
  const _lastActivityTime = getLastActivityTime();
  const activityRecent =
    _lastActivityTime != null &&
    now - _lastActivityTime <= RECENT_ACTIVITY_WINDOW_MS;
  const shouldVerify =
    !withinReconnectGrace &&
    !activityRecent &&
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- defensive for null
    (!recentlyVerified || !connectionFresh || _lastVerificationTime == null);

  if (!shouldVerify) {
    setLastActivityTime(now);
    return cachedSigner;
  }

  const isValid = await verifySignerConnection(
    cachedSigner,
    VERIFY_BEFORE_USE_TIMEOUT_MS
  );
  if (isValid) {
    setLastActivityTime(Date.now());
    return cachedSigner;
  }
  clearCachedNip46Signer();
  return null;
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

function handleSignerConnectionError(err: unknown, now: number): void {
  resetCachedSigner();
  setConnectionEstablishedAt(null);
  setLastActivityTime(null);
  setNeedsReprobe(true);

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

  if (isMobile()) {
    const errorCooldown = isIOS() ? 2000 : 1500;
    setConnectionCooldownUntil(now + errorCooldown);
  }
}

export async function getActiveSigner(
  options?: GetActiveSignerOptions
): Promise<NostrSigner | null> {
  const allowReconnect = options?.allowReconnect ?? true;

  if (getNeedsReprobe() && getCachedSigner()) {
    clearCachedNip46Signer();
  }

  const fromCache = await tryGetValidCachedSigner();
  if (fromCache) return fromCache;

  const config = getActiveSignerConfig();
  if (!config) return null;

  if (config.type === "nip07") {
    const latest = getActiveSignerConfig();
    if (!latest || JSON.stringify(latest) !== JSON.stringify(config)) {
      return null;
    }
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

  const requestId = incrementSignerResolutionRequestId();
  const isRequestCurrent = () => {
    if (requestId !== getSignerResolutionRequestId()) return false;
    const latest = getActiveSignerConfig();
    return latest !== null && JSON.stringify(latest) === configJson;
  };

  const now = Date.now();
  const connectPromise = resolveNip46SignerFromConfig(nip46Config, {
    getConnectionCooldownUntil,
    isRequestCurrent,
    getSignerGeneration,
    setCachedSigner,
    getCachedSigner,
    setConnectionEstablishedAt,
    setLastActivityTime,
    setLastVerificationTime,
    startHealthCheckMonitoring,
    stopHealthCheckMonitoring,
    getNeedsReprobe,
    setNeedsReprobe,
    verifySignerConnection,
    resetCachedSigner,
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
      handleSignerConnectionError(err, now);
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
