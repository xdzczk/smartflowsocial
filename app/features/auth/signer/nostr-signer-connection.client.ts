/**
 * NIP-46/Bunker connection lifecycle: connect, disconnect, reconnect,
 * visibility handling, health checks, and signer cache.
 */

import { SimplePool } from "nostr-tools";
import {
  BunkerSigner,
  createNostrConnectURI,
  parseNostrConnectURI,
} from "nostr-tools/nip46";

import {
  Nip07Signer,
  Nip46Signer,
  type NostrSigner,
} from "~/features/auth/nostr-signer.client";
import { RemoteSignerTimeoutError } from "~/lib/errors";
import { isMobile } from "~/lib/is-mobile";
import { convertToHex } from "~/lib/nostr-conversion";

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
  DEFAULT_RELAYS_CONNECT,
  NIP46_SIGNER_TYPE,
  NOSTR_CONNECTION_HEALTHY_EVENT,
  NOSTR_CONNECTION_STALE_EVENT,
  RECENT_ACTIVITY_WINDOW_MS,
  RECONNECT_GRACE_MS,
  RELAY_UNION_CAP,
  VERIFY_BEFORE_USE_TIMEOUT_MS,
  VERIFY_COOLDOWN_MS,
  VISIBILITY_RECONNECT_THROTTLE_MS,
  PROBE_ON_FIRST_USE_TIMEOUT_MS,
  PROBE_FAILED_AFTER_RESUME_MESSAGE,
} from "./connection-constants";
import {
  startHealthCheckMonitoring,
  stopHealthCheckMonitoring,
  syncRelaysWithRemoteSigner,
  verifySignerConnection,
} from "./connection-health.client";
import {
  buildRelayUnion,
  relayListsEqual,
} from "./connection-relay-utils.client";
import { initVisibilityHandler as initVisibilityHandlerImpl } from "./connection-visibility.client";
import { hexToBytes } from "./nostr-signer-keys.client";
import {
  getActiveSignerConfig,
  persistActiveSignerConfigWithoutReset,
  setActiveSignerConfig,
  type ActiveSignerConfig,
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

export async function getActiveSigner(
  options?: GetActiveSignerOptions
): Promise<NostrSigner | null> {
  const allowReconnect = options?.allowReconnect ?? true;

  if (getNeedsReprobe() && getCachedSigner()) {
    clearCachedNip46Signer();
  }

  const cachedSigner = getCachedSigner();
  if (cachedSigner) {
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
    return cachedSigner;
  }

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
  if (
    getInFlightSignerPromise() &&
    getInFlightSignerConfigJson() === configJson
  ) {
    return await getInFlightSignerPromise()!;
  }

  const requestId = incrementSignerResolutionRequestId();
  const isRequestCurrent = () => {
    if (requestId !== getSignerResolutionRequestId()) return false;
    const latest = getActiveSignerConfig();
    return latest !== null && JSON.stringify(latest) === configJson;
  };

  const connectPromise = (async (): Promise<NostrSigner | null> => {
    const now = Date.now();
    const cooldownUntil = getConnectionCooldownUntil();
    if (now < cooldownUntil) {
      await new Promise((resolve) => setTimeout(resolve, cooldownUntil - now));
    }

    const myGen = getSignerGeneration();
    const clientSecretKey = hexToBytes(nip46Config.clientSecretKeyHex);
    let pool: SimplePool | undefined = new SimplePool();
    let relaysToClose: string[] = [];

    async function connectViaBunker(
      cfg: Extract<ActiveSignerConfig, { type: "nip46" }>
    ): Promise<NostrSigner | null> {
      const result = await createNip46SignerFromStoredConfigImpl(cfg, {
        pool,
        timeoutMs: 90_000,
      });
      if (!isRequestCurrent()) {
        await result.signer.close();
        return null;
      }
      const signer = result.signer;
      setCachedSigner(signer);
      pool = undefined;
      const nowEst = Date.now();
      setConnectionEstablishedAt(nowEst);
      setLastActivityTime(nowEst);
      setLastVerificationTime(nowEst);
      startHealthCheckMonitoring();

      if (getNeedsReprobe()) {
        const probeOk = await verifySignerConnection(
          signer,
          PROBE_ON_FIRST_USE_TIMEOUT_MS
        );
        if (!probeOk) {
          try {
            // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- NostrSigner.close is optional in type
            await signer.close?.();
          } catch {
            // ignore
          }
          resetCachedSigner();
          setConnectionEstablishedAt(null);
          setLastActivityTime(null);
          const activeConnection = getActiveConnection();
          if (activeConnection) {
            recordConnectionEvent(activeConnection.id, {
              type: "health_check",
              healthy: false,
              error: PROBE_FAILED_AFTER_RESUME_MESSAGE,
            });
            recordConnectionEvent(activeConnection.id, {
              type: "disconnected",
              reason: PROBE_FAILED_AFTER_RESUME_MESSAGE,
            });
          }
          if (typeof window !== "undefined") {
            window.dispatchEvent(
              new CustomEvent(NOSTR_CONNECTION_STALE_EVENT, {
                detail: { signerType: NIP46_SIGNER_TYPE },
              })
            );
          }
          throw new RemoteSignerTimeoutError();
        }
        setNeedsReprobe(false);
      }

      if (myGen !== getSignerGeneration()) {
        const s = getCachedSigner();
        resetCachedSigner();
        setConnectionEstablishedAt(null);
        setLastActivityTime(null);
        stopHealthCheckMonitoring();
        try {
          if (s) await s.close?.();
        } catch {
          // ignore
        }
        return null;
      }

      const pubkey = await signer.getPublicKey();
      const activeConnection = getActiveConnection();
      if (activeConnection) {
        updateSession(activeConnection.id, {
          metadata: {
            ...activeConnection.metadata,
            status: "active",
            pubkey,
            connectedAt: Date.now(),
            lastActivityAt: Date.now(),
            lastError: null,
          },
        });
        recordConnectionEvent(activeConnection.id, {
          type: "connected",
          pubkey,
        });
      }

      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent(NOSTR_CONNECTION_HEALTHY_EVENT, {
            detail: { signerType: NIP46_SIGNER_TYPE },
          })
        );
      }

      try {
        await syncRelaysWithRemoteSigner(getCachedSigner()!);
      } catch {
        // best-effort
      }

      return getCachedSigner();
    }

    type NostrConnectConfig = Extract<
      ActiveSignerConfig,
      { type: "nip46"; method: "nostrconnect_uri" }
    >;

    async function runNostrConnectPostConnectSteps(
      signer: NostrSigner,
      cfg: NostrConnectConfig
    ): Promise<boolean> {
      const nowEst = Date.now();
      setConnectionEstablishedAt(nowEst);
      setLastActivityTime(nowEst);
      setLastVerificationTime(nowEst);
      startHealthCheckMonitoring();

      if (getNeedsReprobe()) {
        const probeOk = await verifySignerConnection(
          signer,
          PROBE_ON_FIRST_USE_TIMEOUT_MS
        );
        if (!probeOk) {
          try {
            await signer.close?.();
          } catch {
            // ignore
          }
          resetCachedSigner();
          setConnectionEstablishedAt(null);
          setLastActivityTime(null);
          const activeConnection = getActiveConnection();
          if (activeConnection) {
            recordConnectionEvent(activeConnection.id, {
              type: "health_check",
              healthy: false,
              error: PROBE_FAILED_AFTER_RESUME_MESSAGE,
            });
            recordConnectionEvent(activeConnection.id, {
              type: "disconnected",
              reason: PROBE_FAILED_AFTER_RESUME_MESSAGE,
            });
          }
          if (typeof window !== "undefined") {
            window.dispatchEvent(
              new CustomEvent(NOSTR_CONNECTION_STALE_EVENT, {
                detail: { signerType: NIP46_SIGNER_TYPE },
              })
            );
          }
          throw new RemoteSignerTimeoutError();
        }
        setNeedsReprobe(false);
      }

      if (myGen !== getSignerGeneration()) {
        const s = signer;
        resetCachedSigner();
        setConnectionEstablishedAt(null);
        setLastActivityTime(null);
        stopHealthCheckMonitoring();
        try {
          await s.close?.();
        } catch {
          // ignore
        }
        return false;
      }

      if (
        relaysToClose.length > 0 &&
        !relayListsEqual(relaysToClose, cfg.relays)
      ) {
        persistActiveSignerConfigWithoutReset({
          ...cfg,
          relays: relaysToClose,
        });
        const connectionForRelays = getActiveConnection();
        if (
          connectionForRelays?.config.type === NIP46_SIGNER_TYPE &&
          connectionForRelays.config.method === "nostrconnect_uri"
        ) {
          updateSession(connectionForRelays.id, {
            config: { ...connectionForRelays.config, relays: relaysToClose },
            metadata: {
              ...connectionForRelays.metadata,
              relays: relaysToClose,
              lastActivityAt: Date.now(),
            },
          });
        }
      }

      const pubkey = await signer.getPublicKey();

      const configUpdates: Partial<NostrConnectConfig> = {};
      if (!cfg.signerPubkey) {
        configUpdates.signerPubkey = convertToHex(pubkey) ?? pubkey;
      }
      if (signer.type === NIP46_SIGNER_TYPE && "getBunkerPointer" in signer) {
        configUpdates.bunkerPointer = (
          signer as Nip46Signer
        ).getBunkerPointer();
      }
      if (Object.keys(configUpdates).length > 0) {
        persistActiveSignerConfigWithoutReset({ ...cfg, ...configUpdates });
      }

      const activeConnection = getActiveConnection();
      if (activeConnection) {
        updateSession(activeConnection.id, {
          metadata: {
            ...activeConnection.metadata,
            status: "active",
            pubkey,
            connectedAt: Date.now(),
            lastActivityAt: Date.now(),
            lastError: null,
          },
        });
        recordConnectionEvent(activeConnection.id, {
          type: "connected",
          pubkey,
        });
      }

      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent(NOSTR_CONNECTION_HEALTHY_EVENT, {
            detail: { signerType: NIP46_SIGNER_TYPE },
          })
        );
      }

      try {
        await syncRelaysWithRemoteSigner(signer);
      } catch {
        // best-effort
      }
      return true;
    }

    async function connectViaNostrConnect(
      cfg: Extract<ActiveSignerConfig, { type: "nip46" }>
    ): Promise<NostrSigner | null> {
      if (cfg.method !== "nostrconnect_uri") return null;
      relaysToClose = cfg.relays;
      try {
        const unionRelays = buildRelayUnion(
          cfg.relays,
          DEFAULT_RELAYS_CONNECT,
          RELAY_UNION_CAP
        );
        if (unionRelays.length > 0) relaysToClose = unionRelays;
      } catch {
        // keep original
      }

      if (cfg.bunkerPointer || (cfg.signerPubkey && cfg.relays.length > 0)) {
        if (cfg.bunkerPointer?.relays.length) {
          relaysToClose = cfg.bunkerPointer.relays
            .map((r: string) => r.trim())
            .filter((r: string) => r.startsWith("wss://"));
        }
        const result = await createNip46SignerFromStoredConfigImpl(cfg, {
          pool,
          timeoutMs: 90_000,
        });
        if (!isRequestCurrent()) {
          await result.signer.close();
          return null;
        }
        setCachedSigner(result.signer);
        pool = undefined;
      } else {
        if (!pool) return null;
        let uriToUse = cfg.uri;
        try {
          const parsed = parseNostrConnectURI(cfg.uri);
          const unionRelays = buildRelayUnion(
            cfg.relays,
            DEFAULT_RELAYS_CONNECT,
            RELAY_UNION_CAP
          );
          if (unionRelays.length > 0) {
            uriToUse = createNostrConnectURI({
              clientPubkey: parsed.clientPubkey,
              relays: unionRelays,
              secret: parsed.params.secret,
              perms: parsed.params.perms,
            });
            relaysToClose = unionRelays;
          }
        } catch {
          // keep original
        }
        const inner = await BunkerSigner.fromURI(
          clientSecretKey,
          uriToUse,
          { pool },
          90_000
        );
        if (!isRequestCurrent()) {
          await inner.close();
          return null;
        }
        setCachedSigner(new Nip46Signer({ pool, inner }));
        pool = undefined;
      }

      const currentSigner = getCachedSigner();
      const ok = currentSigner
        ? await runNostrConnectPostConnectSteps(currentSigner, cfg)
        : false;
      if (!ok) return null;
      return getCachedSigner();
    }

    try {
      if (nip46Config.method === "bunker_input") {
        return await connectViaBunker(nip46Config);
      }
      return await connectViaNostrConnect(nip46Config);
    } catch (err) {
      try {
        if (nip46Config.method === "nostrconnect_uri") {
          pool.close(relaysToClose);
        }
      } catch {
        // ignore
      }

      const errorMessage =
        err instanceof Error
          ? err.message.toLowerCase()
          : String(err).toLowerCase();
      if (
        errorMessage.includes("subscription closed") ||
        errorMessage.includes("websocket") ||
        errorMessage.includes("closed") ||
        errorMessage.includes("connection") ||
        errorMessage.includes("connecting") ||
        errorMessage.includes("timeout") ||
        errorMessage.includes("too long")
      ) {
        resetCachedSigner();
        setConnectionEstablishedAt(null);
        setLastActivityTime(null);
        setNeedsReprobe(true);

        const activeConnection = getActiveConnection();
        if (activeConnection) {
          const fullErrorMessage =
            err instanceof Error ? err.message : String(err);
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
      throw err;
    }
  })();

  setInFlightSignerPromise(connectPromise);
  setInFlightSignerConfigJson(configJson);
  try {
    return await connectPromise;
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
    return true;
  } catch {
    return false;
  } finally {
    backgroundReconnectInProgress = false;
  }
}
