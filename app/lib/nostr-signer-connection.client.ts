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
  connectNip46ReconnectWithStoredNostrConnect,
  connectNip46WithBunkerInput,
  Nip07Signer,
  Nip46Signer,
  type NostrSigner,
} from "~/features/auth/nostr-signer.client";
import { RemoteSignerTimeoutError } from "~/lib/errors";
import { isMobile } from "~/lib/is-mobile";
import { convertToHex } from "~/lib/nostr-conversion";
import { hexToBytes } from "~/lib/nostr-signer-keys.client";
import {
  getActiveSignerConfig,
  persistActiveSignerConfigWithoutReset,
  setActiveSignerConfig,
  setCachedConfigJson,
  type ActiveSignerConfig,
} from "~/lib/nostr-signer-storage.client";
import {
  addConnectionLog,
  detectSignerAppName,
  getActiveConnection,
  updateSession,
} from "~/lib/remote-signer-sessions.client";
import { recordConnectionEvent } from "~/lib/remote-signer-status.client";

/** Value for CustomEvent detail.signerType when signer is NIP-46. */
const NIP46_SIGNER_TYPE = "nip46";

/** CustomEvent name when NIP-46 connection becomes stale. */
export const NOSTR_CONNECTION_STALE_EVENT = "nostr-connection-stale";

/** Fired when remote signer reconnect succeeds so composers clear "Waiting for signer approval". */
export const NOSTR_CONNECTION_HEALTHY_EVENT = "nostr-connection-healthy";

let cachedSigner: NostrSigner | null = null;
let inFlightSignerPromise: Promise<NostrSigner | null> | null = null;
let inFlightSignerConfigJson: string | null = null;
let signerResolutionRequestId = 0;
let wasHidden = false;
let lastVisibilityReconnectAt = 0;
let connectionCooldownUntil = 0;
let healthCheckInterval: ReturnType<typeof setInterval> | null = null;
let connectionEstablishedAt: number | null = null;
let _lastActivityTime: number | null = null;
let _lastVerificationTime: number | null = null;
let _lastRelaySyncAt: number | null = null;
let needsReprobe = false;
let signerGeneration = 0;
let teardownInProgress = false;
let visibilityHandlerCleanup: (() => void) | null = null;

const VERIFY_COOLDOWN_MS = 2 * 60 * 1000;
const CONNECTION_FRESH_MS = 5 * 60 * 1000;
const RECENT_ACTIVITY_WINDOW_MS = 10 * 60 * 1000;
const RECONNECT_GRACE_MS = 15 * 60 * 1000;
const VERIFY_BEFORE_USE_TIMEOUT_MS = 12_000;
const VISIBILITY_RECONNECT_THROTTLE_MS = 30_000;
const RELAY_SYNC_COOLDOWN_MS = 10 * 60 * 1000;
const PROBE_ON_FIRST_USE_TIMEOUT_MS = 4000;
const PROBE_FAILED_AFTER_RESUME_MESSAGE = "Probe failed after resume";
const DEFAULT_RELAYS_CONNECT = [
  "wss://relay.primal.net",
  "wss://relay.damus.io",
  "wss://nos.lol/",
];
const RELAY_UNION_CAP = 8;

function isIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

function buildRelayUnion(
  stored: string[],
  defaults: string[],
  cap: number = RELAY_UNION_CAP
): string[] {
  const normalized = (r: string) => r.trim().toLowerCase();
  const seen = new Set<string>();
  const out: string[] = [];
  for (const r of [...stored, ...defaults]) {
    const n = normalized(r);
    if (r.startsWith("wss://") && !seen.has(n)) {
      seen.add(n);
      out.push(r.trim());
      if (out.length >= cap) break;
    }
  }
  return out;
}

function normalizeRelayList(relays: string[]): string[] {
  return Array.from(
    new Set(
      relays
        .map((relay) => relay.trim())
        .filter((relay) => relay.startsWith("wss://"))
    )
  );
}

function relayListsEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const aSorted = [...a].sort();
  const bSorted = [...b].sort();
  return aSorted.every((relay, idx) => relay === bSorted[idx]);
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
export function resetCachedSigner(): void {
  cachedSigner = null;
  _lastVerificationTime = null;
  _lastRelaySyncAt = null;
  inFlightSignerPromise = null;
  inFlightSignerConfigJson = null;
}

function clearCachedNip46Signer(): void {
  const config = getActiveSignerConfig();
  if (config?.type !== NIP46_SIGNER_TYPE || !cachedSigner) return;

  signerGeneration++;
  if (!teardownInProgress) {
    teardownInProgress = true;
    if (cachedSigner.type === NIP46_SIGNER_TYPE && cachedSigner.close) {
      const closeFn = cachedSigner.close;
      void (async () => {
        try {
          await closeFn();
        } catch {
          // ignore
        } finally {
          teardownInProgress = false;
        }
      })();
    } else {
      teardownInProgress = false;
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
  connectionEstablishedAt = null;
  _lastActivityTime = null;
}

export function teardownActiveNip46Signer(): void {
  clearCachedNip46Signer();
}

function _teardownNip46SignerAndSetNeedsReprobe(): void {
  const config = getActiveSignerConfig();
  if (config?.type !== NIP46_SIGNER_TYPE) return;
  clearCachedNip46Signer();
  needsReprobe = true;
}

function initVisibilityHandler(): () => void {
  if (typeof document === "undefined") return () => {};

  const onResume = () => {
    wasHidden = false;
    if (teardownInProgress) return;
    const now = Date.now();
    if (now - lastVisibilityReconnectAt >= VISIBILITY_RECONNECT_THROTTLE_MS) {
      lastVisibilityReconnectAt = now;
      void tryBackgroundReconnect();
    }
  };

  const handleVisibilityChange = () => {
    if (document.hidden) {
      wasHidden = true;
      if (isMobile()) {
        const config = getActiveSignerConfig();
        if (config?.type === NIP46_SIGNER_TYPE && cachedSigner) {
          debugSignerManagerTrace(
            "NIP-46 signer torn down due to visibility hidden (mobile)"
          );
          _teardownNip46SignerAndSetNeedsReprobe();
        }
      }
    } else if (wasHidden) {
      onResume();
    }
  };

  const handleFocus = () => {
    if (wasHidden) onResume();
  };

  const handlePageShow = () => {
    if (wasHidden) onResume();
  };

  const handleFreeze = () => {
    const config = getActiveSignerConfig();
    if (config?.type === NIP46_SIGNER_TYPE && cachedSigner) {
      debugSignerManagerTrace("NIP-46 signer torn down due to page freeze");
      _teardownNip46SignerAndSetNeedsReprobe();
    }
  };

  document.addEventListener("visibilitychange", handleVisibilityChange);
  window.addEventListener("focus", handleFocus);
  window.addEventListener("pageshow", handlePageShow);
  window.addEventListener("online", onResume);

  const supportsFreezeResume =
    typeof document !== "undefined" && "onfreeze" in document;
  if (supportsFreezeResume) {
    document.addEventListener("freeze", handleFreeze);
    document.addEventListener("resume", onResume);
  }

  return () => {
    document.removeEventListener("visibilitychange", handleVisibilityChange);
    window.removeEventListener("focus", handleFocus);
    window.removeEventListener("pageshow", handlePageShow);
    window.removeEventListener("online", onResume);
    if (supportsFreezeResume) {
      document.removeEventListener("freeze", handleFreeze);
      document.removeEventListener("resume", onResume);
    }
  };
}

export function teardownVisibilityHandler(): void {
  if (visibilityHandlerCleanup) {
    visibilityHandlerCleanup();
    visibilityHandlerCleanup = null;
  }
}

if (typeof window !== "undefined") {
  visibilityHandlerCleanup = initVisibilityHandler();
}

export function cacheNip46SignerFromLogin(signer: NostrSigner): void {
  if (signer.type !== NIP46_SIGNER_TYPE) return;
  const config = getActiveSignerConfig();
  if (config?.type !== NIP46_SIGNER_TYPE) return;
  cachedSigner = signer;
  setCachedConfigJson(JSON.stringify(config));
  const now = Date.now();
  connectionEstablishedAt = now;
  _lastActivityTime = now;
  _lastVerificationTime = now;
  needsReprobe = false;
  startHealthCheckMonitoring();
}

export function recordSuccessfulSign(): void {
  const now = Date.now();
  _lastActivityTime = now;
  _lastVerificationTime = now;
}

async function verifySignerConnection(
  signer: NostrSigner,
  timeoutMs = 5000
): Promise<boolean> {
  if (signer.type !== NIP46_SIGNER_TYPE) return true;

  if (typeof signer.ping !== "function") {
    debugSignerManagerTrace("Ping unavailable, skipping verification");
    return true;
  }

  try {
    debugSignerManagerTrace("Running ping-based signer health check");
    await Promise.race([
      signer.ping(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Ping check timeout")), timeoutMs)
      ),
    ]);
    const now = Date.now();
    _lastActivityTime = now;
    _lastVerificationTime = now;
    return true;
  } catch {
    return false;
  }
}

function startHealthCheckMonitoring(): void {
  if (healthCheckInterval) return;

  healthCheckInterval = setInterval(
    () => {
      void (async () => {
        const config = getActiveSignerConfig();
        if (config?.type !== NIP46_SIGNER_TYPE || !cachedSigner) {
          if (healthCheckInterval) {
            clearInterval(healthCheckInterval);
            healthCheckInterval = null;
          }
          return;
        }

        const now = Date.now();
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
              cachedSigner === signerToCheck &&
              typeof window !== "undefined"
            ) {
              window.dispatchEvent(
                new CustomEvent(NOSTR_CONNECTION_STALE_EVENT, {
                  detail: { signerType: NIP46_SIGNER_TYPE },
                })
              );
            }
          } else if (cachedSigner === signerToCheck) {
            _lastActivityTime = Date.now();
          }
        }

        if (shouldSyncRelays && cachedSigner.type === NIP46_SIGNER_TYPE) {
          try {
            await syncRelaysWithRemoteSigner(cachedSigner);
          } catch {
            // best-effort
          }
        }
      })();
    },
    2 * 60 * 1000
  );
}

function stopHealthCheckMonitoring(): void {
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
  if (
    config?.type !== NIP46_SIGNER_TYPE ||
    config.method !== "nostrconnect_uri"
  ) {
    return { changed: false, reason: "not_nostrconnect_uri" };
  }

  const switched = await signer.switchRelays();
  _lastRelaySyncAt = Date.now();
  if (!switched) {
    debugSignerManagerTrace("switch_relays returned no updates");
    return { changed: false, reason: "no_change" };
  }

  const normalized = normalizeRelayList(switched);
  if (normalized.length === 0 || relayListsEqual(normalized, config.relays)) {
    debugSignerManagerTrace("switch_relays result unchanged/invalid", {
      relayCount: normalized.length,
    });
    return { changed: false, reason: "unchanged" };
  }

  persistActiveSignerConfigWithoutReset({ ...config, relays: normalized });

  const activeConnection = getActiveConnection();
  if (activeConnection?.config.type === NIP46_SIGNER_TYPE) {
    updateSession(activeConnection.id, {
      config:
        activeConnection.config.method === "nostrconnect_uri"
          ? { ...activeConnection.config, relays: normalized }
          : activeConnection.config,
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

  debugSignerManagerTrace("switch_relays updated relay set", {
    relayCount: normalized.length,
  });

  return { changed: true, relays: normalized };
}

export async function createNip46SignerFromStoredConfig(
  config: Extract<ActiveSignerConfig, { type: "nip46" }>,
  options: { pool?: SimplePool; timeoutMs?: number } = {}
): Promise<{ signer: Nip46Signer; pubkey: string }> {
  const clientSecretKey = hexToBytes(config.clientSecretKeyHex);
  const pool = options.pool ?? new SimplePool();
  const timeoutMs = options.timeoutMs ?? 90_000;

  if (config.method === "bunker_input") {
    return connectNip46WithBunkerInput({
      bunkerInput: config.bunkerInput,
      clientSecretKey,
      pool,
      timeoutMs,
      skipConnect: true,
    });
  }

  if (config.bunkerPointer) {
    return connectNip46ReconnectWithStoredNostrConnect({
      clientSecretKey,
      bunkerPointer: config.bunkerPointer,
      relays: config.bunkerPointer.relays,
      pool,
      timeoutMs,
    });
  }
  if (config.signerPubkey && config.relays.length > 0) {
    return connectNip46ReconnectWithStoredNostrConnect({
      clientSecretKey,
      signerPubkey: config.signerPubkey,
      relays: config.relays,
      pool,
      timeoutMs,
    });
  }
  throw new Error(
    "createNip46SignerFromStoredConfig: nostrconnect config needs bunkerPointer or signerPubkey+relays for reconnect"
  );
}

export async function getActiveSigner(
  options?: GetActiveSignerOptions
): Promise<NostrSigner | null> {
  const allowReconnect = options?.allowReconnect ?? true;

  if (needsReprobe && cachedSigner) {
    clearCachedNip46Signer();
  }

  if (cachedSigner) {
    const now = Date.now();
    const connectionAge = connectionEstablishedAt
      ? now - connectionEstablishedAt
      : 0;
    const withinReconnectGrace = connectionAge < RECONNECT_GRACE_MS;
    const recentlyVerified =
      _lastVerificationTime != null &&
      now - _lastVerificationTime <= VERIFY_COOLDOWN_MS;
    const connectionFresh = connectionAge < CONNECTION_FRESH_MS;
    const activityRecent =
      _lastActivityTime != null &&
      now - _lastActivityTime <= RECENT_ACTIVITY_WINDOW_MS;
    const shouldVerify =
      !withinReconnectGrace &&
      !activityRecent &&
      (!recentlyVerified || !connectionFresh || _lastVerificationTime == null);

    if (!shouldVerify) {
      _lastActivityTime = now;
      return cachedSigner;
    }

    const isValid = await verifySignerConnection(
      cachedSigner,
      VERIFY_BEFORE_USE_TIMEOUT_MS
    );
    if (isValid) {
      _lastActivityTime = Date.now();
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
    cachedSigner = new Nip07Signer();
    return cachedSigner;
  }

  const nip46Config = config;
  const configJson = JSON.stringify(config);
  if (!allowReconnect) return null;
  if (inFlightSignerPromise && inFlightSignerConfigJson === configJson) {
    return await inFlightSignerPromise;
  }

  const requestId = ++signerResolutionRequestId;
  const isRequestCurrent = () => {
    if (requestId !== signerResolutionRequestId) return false;
    const latest = getActiveSignerConfig();
    return latest !== null && JSON.stringify(latest) === configJson;
  };

  const connectPromise = (async (): Promise<NostrSigner | null> => {
    const now = Date.now();
    if (now < connectionCooldownUntil) {
      await new Promise((resolve) =>
        setTimeout(resolve, connectionCooldownUntil - now)
      );
    }

    const myGen = signerGeneration;
    const clientSecretKey = hexToBytes(nip46Config.clientSecretKeyHex);
    let pool: SimplePool | undefined = new SimplePool();
    let relaysToClose: string[] = [];

    async function connectViaBunker(
      cfg: Extract<ActiveSignerConfig, { type: "nip46" }>
    ): Promise<NostrSigner | null> {
      const result = await createNip46SignerFromStoredConfig(cfg, {
        pool,
        timeoutMs: 90_000,
      });
      if (!isRequestCurrent()) {
        await result.signer.close();
        return null;
      }
      cachedSigner = result.signer;
      pool = undefined;
      connectionEstablishedAt = Date.now();
      _lastActivityTime = connectionEstablishedAt;
      _lastVerificationTime = connectionEstablishedAt;
      startHealthCheckMonitoring();

      if (needsReprobe) {
        const probeOk = await verifySignerConnection(
          cachedSigner,
          PROBE_ON_FIRST_USE_TIMEOUT_MS
        );
        if (!probeOk) {
          try {
            await cachedSigner.close?.();
          } catch {
            // ignore
          }
          resetCachedSigner();
          connectionEstablishedAt = null;
          _lastActivityTime = null;
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
        needsReprobe = false;
      }

      if (myGen !== signerGeneration) {
        const s = cachedSigner;
        resetCachedSigner();
        connectionEstablishedAt = null;
        _lastActivityTime = null;
        stopHealthCheckMonitoring();
        try {
          await s.close?.();
        } catch {
          // ignore
        }
        return null;
      }

      const pubkey = await cachedSigner.getPublicKey();
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
        await syncRelaysWithRemoteSigner(cachedSigner);
      } catch {
        // best-effort
      }

      return cachedSigner;
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
      connectionEstablishedAt = nowEst;
      _lastActivityTime = nowEst;
      _lastVerificationTime = nowEst;
      startHealthCheckMonitoring();

      if (needsReprobe) {
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
          connectionEstablishedAt = null;
          _lastActivityTime = null;
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
        needsReprobe = false;
      }

      if (myGen !== signerGeneration) {
        const s = signer;
        resetCachedSigner();
        connectionEstablishedAt = null;
        _lastActivityTime = null;
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
        const result = await createNip46SignerFromStoredConfig(cfg, {
          pool,
          timeoutMs: 90_000,
        });
        if (!isRequestCurrent()) {
          await result.signer.close();
          return null;
        }
        cachedSigner = result.signer;
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
        cachedSigner = new Nip46Signer({ pool, inner });
        pool = undefined;
      }

      const ok = await runNostrConnectPostConnectSteps(cachedSigner, cfg);
      if (!ok) return null;
      return cachedSigner;
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
        connectionEstablishedAt = null;
        _lastActivityTime = null;
        needsReprobe = true;

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
          connectionCooldownUntil = now + errorCooldown;
        }
      }
      throw err;
    }
  })();

  inFlightSignerPromise = connectPromise;
  inFlightSignerConfigJson = configJson;
  try {
    return await connectPromise;
  } finally {
    if (inFlightSignerPromise === connectPromise) {
      inFlightSignerPromise = null;
      inFlightSignerConfigJson = null;
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
    const { signer, pubkey } = await createNip46SignerFromStoredConfig(config, {
      timeoutMs: BACKGROUND_RECONNECT_TIMEOUT_MS,
    });
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
