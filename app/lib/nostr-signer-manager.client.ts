import { SimplePool, getPublicKey } from "nostr-tools";
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
import type { NostrEvent, SignedEvent } from "~/features/nostr/types";
import { RemoteSignerTimeoutError } from "~/lib/errors";
import { isMobile } from "~/lib/is-mobile";
import { convertToHex } from "~/lib/nostr-conversion";
import {
  addConnectionLog,
  getActiveConnection,
  updateSession,
} from "~/lib/remote-signer-sessions.client";
import { recordConnectionEvent } from "~/lib/remote-signer-status.client";

export type ActiveSignerConfig =
  | { type: "nip07" }
  | {
      type: "nip46";
      method: "bunker_input";
      bunkerInput: string;
      clientSecretKeyHex: string;
    }
  | {
      type: "nip46";
      method: "nostrconnect_uri";
      uri: string;
      clientSecretKeyHex: string;
      relays: string[];
      /** Remote signer pubkey (hex). Set after first connection so reconnects use Method 1 (fromBunker) instead of fromURI(). */
      signerPubkey?: string;
      /** Full BunkerPointer when available; used for Method 1 reconnect instead of reconstructing from signerPubkey + relays. */
      bunkerPointer?: {
        pubkey: string;
        relays: string[];
        secret: null | string;
      };
    };

const STORAGE_KEY = "__smartflow_active_nostr_signer_v1";

/** Value for CustomEvent detail.signerType when signer is NIP-46. */
const NIP46_SIGNER_TYPE = "nip46";

/** CustomEvent name when NIP-46 connection becomes stale. */
const NOSTR_CONNECTION_STALE_EVENT = "nostr-connection-stale";

/** Fired when signer config was missing and we defaulted to NIP-07 so components can re-read. */
export const SIGNER_CONFIG_HYDRATED_EVENT = "smartflow:signer-config-hydrated";

let cachedSigner: NostrSigner | null = null;
let cachedConfigJson: string | null = null;
let inFlightSignerPromise: Promise<NostrSigner | null> | null = null;
let inFlightSignerConfigJson: string | null = null;
let signerResolutionRequestId = 0;
let wasHidden = false;
let _lastVisibilityChangeTime = 0; // Reserved for future metrics/debugging
let connectionCooldownUntil = 0;
let healthCheckInterval: ReturnType<typeof setInterval> | null = null;
let connectionEstablishedAt: number | null = null;
let _lastActivityTime: number | null = null; // Reserved for future metrics/debugging
let _lastVerificationTime: number | null = null; // Skip verifySignerConnection if recent (avoids spamming signer app)
let _lastRelaySyncAt: number | null = null;

/** When true, next getActiveSigner() must create a fresh signer and run a short probe (set on app resume). */
let needsReprobe = false;

/** Incremented on teardown so in-flight connects do not cache a signer that is about to be torn down. */
let signerGeneration = 0;

/** True while async close() from teardown is in progress; makes repeated teardown calls idempotent. */
let teardownInProgress = false;

/** Minimum time between verification checks (avoid prompting signer app too often). */
const VERIFY_COOLDOWN_MS = 2 * 60 * 1000; // 2 minutes
/** Treat connection as "fresh" for this long after it was established. */
const CONNECTION_FRESH_MS = 5 * 60 * 1000; // 5 minutes
/** If we had activity (e.g. sign) in the last N min, skip verification. */
const RECENT_ACTIVITY_WINDOW_MS = 10 * 60 * 1000; // 10 minutes
/** After a reconnect (new session), skip verification for this long. */
const RECONNECT_GRACE_MS = 15 * 60 * 1000; // 15 minutes
/** Verification timeout when returning cached signer (e.g. before sign). Give signer app time to respond after app switch. */
const VERIFY_BEFORE_USE_TIMEOUT_MS = 12_000; // 12 seconds
const RELAY_SYNC_COOLDOWN_MS = 10 * 60 * 1000; // 10 minutes

/** Timeout for probe on first use after resume (plan: 2–5s). */
const PROBE_ON_FIRST_USE_TIMEOUT_MS = 4000;

/** Default relays for relay-union when connecting (same as reconnect modal). */
const DEFAULT_RELAYS_CONNECT = [
  "wss://relay.primal.net",
  "wss://relay.damus.io",
  "wss://nos.lol/",
];

const RELAY_UNION_CAP = 8;

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

interface GetActiveSignerOptions {
  /**
   * When false, never initiate a new NIP-46 reconnect attempt.
   * Useful for fast health checks from UI where long reconnect is undesirable.
   */
  allowReconnect?: boolean;
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

/**
 * Clear the in-memory signer cache without removing persisted config.
 * Also clears any in-flight signer resolution so the next getActiveSigner() starts fresh
 * (avoids reusing a stuck connection attempt after a timeout).
 */
export function resetCachedSigner(): void {
  cachedSigner = null;
  _lastVerificationTime = null;
  _lastRelaySyncAt = null;
  inFlightSignerPromise = null;
  inFlightSignerConfigJson = null;
}

/**
 * Detect if we're on iOS (mobile Safari or webview)
 */
function isIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

export { isMobile };

/**
 * Clear cached NIP-46 signer connections.
 * This is called when we detect the page was hidden or when connections fail.
 *
 * IMPORTANT: This only clears the cached signer object, NOT the stored config.
 * The config (connection URI/credentials) is preserved so that:
 * - Signer apps like Primal can restore the connection using the same credentials
 * - We can attempt reconnection with the same connection URI
 * - Users don't need to re-approve if the signer app remembers the connection
 */
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
          // Ignore errors during cleanup
        } finally {
          teardownInProgress = false;
        }
      })();
    } else {
      teardownInProgress = false;
    }
  }
  resetCachedSigner();
  stopHealthCheckMonitoring();
  connectionEstablishedAt = null;
  _lastActivityTime = null;
}

/**
 * Exported teardown for NIP-46 signer. Call before clearing session storage (e.g. before
 * clearActiveSession or removeSession when removing the active connection) so the in-memory
 * signer, pool, and health-check timer are closed and the next connect does not overlap.
 */
export function teardownActiveNip46Signer(): void {
  clearCachedNip46Signer();
}

/**
 * Teardown cached NIP-46 signer and set needsReprobe so the next getActiveSigner()
 * creates a fresh signer and runs a short probe. Call on app resume (visibility/focus/pageshow).
 */
function _teardownNip46SignerAndSetNeedsReprobe(): void {
  const config = getActiveSignerConfig();
  if (config?.type !== NIP46_SIGNER_TYPE) return;
  clearCachedNip46Signer();
  needsReprobe = true;
}

/**
 * Initialize page visibility detection: on resume we only mark wasHidden = false.
 * We do not clear the cached signer on visibility change; cache is only cleared
 * when sign() actually fails (in the adapter), so returning users keep their signer.
 */
function initVisibilityHandler(): void {
  if (typeof document === "undefined") return;

  const onResume = () => {
    wasHidden = false;
  };

  const handleVisibilityChange = () => {
    const now = Date.now();
    if (document.hidden) {
      wasHidden = true;
      _lastVisibilityChangeTime = now;
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

  document.addEventListener("visibilitychange", handleVisibilityChange);
  window.addEventListener("focus", handleFocus);
  window.addEventListener("pageshow", handlePageShow);
  window.addEventListener("online", onResume);
}

// Initialize visibility handler when module loads
if (typeof window !== "undefined") {
  initVisibilityHandler();
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function hexToBytes(hex: string): Uint8Array {
  const normalized = hex.trim().toLowerCase();
  if (!/^[0-9a-f]+$/.test(normalized) || normalized.length % 2 !== 0) {
    throw new Error("Invalid hex");
  }
  const out = new Uint8Array(normalized.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(normalized.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

export function serializeSecretKey(key: Uint8Array): string {
  return bytesToHex(key);
}

/** Parse hex string to Uint8Array (e.g. for clientSecretKey from storage). */
export function parseSecretKeyHex(hex: string): Uint8Array {
  return hexToBytes(hex);
}

export function clearActiveSignerConfig(): void {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
  cachedSigner = null;
  cachedConfigJson = null;
  inFlightSignerPromise = null;
  inFlightSignerConfigJson = null;
  _lastRelaySyncAt = null;
}

export function setActiveSignerConfig(config: ActiveSignerConfig): void {
  try {
    const json = JSON.stringify(config);
    sessionStorage.setItem(STORAGE_KEY, json);
    cachedConfigJson = json;
    cachedSigner = null;
    inFlightSignerPromise = null;
    inFlightSignerConfigJson = null;
    _lastRelaySyncAt = null;
  } catch {
    // ignore
  }
}

/**
 * Cache a live NIP-46 signer from the login flow so the first sign (publish/schedule)
 * reuses it instead of opening a second connection. Call this before redirect after
 * successful login; the login UI must not close this signer on unmount (e.g. use a
 * ref to skip close when transferred). When the config is NIP-46 and matches storage,
 * sets the signer as cached and starts health monitoring.
 */
export function cacheNip46SignerFromLogin(signer: NostrSigner): void {
  if (signer.type !== NIP46_SIGNER_TYPE) return;
  const config = getActiveSignerConfig();
  if (config?.type !== NIP46_SIGNER_TYPE) return;
  cachedSigner = signer;
  cachedConfigJson = JSON.stringify(config);
  const now = Date.now();
  connectionEstablishedAt = now;
  _lastActivityTime = now;
  _lastVerificationTime = now;
  needsReprobe = false;
  startHealthCheckMonitoring();
}

/**
 * Call after a successful sign so the next getActiveSigner() can skip verification
 * and return the same cached signer when recently verified (avoids clearing cache
 * and forcing "Waiting for signer approval…" on every next post when Primal is
 * slow to respond to ping). Cache is still cleared when sign() actually fails.
 */
export function recordSuccessfulSign(): void {
  const now = Date.now();
  _lastActivityTime = now;
  _lastVerificationTime = now;
}

export function getActiveSignerConfig(): ActiveSignerConfig | null {
  try {
    const json = sessionStorage.getItem(STORAGE_KEY);
    if (!json) return null;
    if (cachedConfigJson === json && cachedSigner) {
      // config unchanged; signer already cached
      return JSON.parse(json) as ActiveSignerConfig;
    }
    return JSON.parse(json) as ActiveSignerConfig;
  } catch {
    return null;
  }
}

function persistActiveSignerConfigWithoutReset(
  config: ActiveSignerConfig
): void {
  try {
    const json = JSON.stringify(config);
    sessionStorage.setItem(STORAGE_KEY, json);
    cachedConfigJson = json;
  } catch {
    // ignore
  }
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

  persistActiveSignerConfigWithoutReset({
    ...config,
    relays: normalized,
  });

  const activeConnection = getActiveConnection();
  if (activeConnection?.config.type === NIP46_SIGNER_TYPE) {
    updateSession(activeConnection.id, {
      config:
        activeConnection.config.method === "nostrconnect_uri"
          ? {
              ...activeConnection.config,
              relays: normalized,
            }
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

/**
 * Verify that a cached NIP-46 signer connection is still valid.
 * Uses only ping (no getPublicKey) so we don't prompt the signer app.
 * Returns true if ping succeeds or if signer has no ping (skip check); false on ping failure.
 */
async function verifySignerConnection(
  signer: NostrSigner,
  timeoutMs = 5000
): Promise<boolean> {
  if (signer.type !== NIP46_SIGNER_TYPE) return true; // NIP-07 doesn't need verification

  if (typeof signer.ping !== "function") {
    // Health checks use only ping; don't use getPublicKey (would prompt signer app).
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

/**
 * Start periodic health checks for active NIP-46 connections
 */
function startHealthCheckMonitoring(): void {
  if (healthCheckInterval) return; // Already monitoring

  healthCheckInterval = setInterval(
    () => {
      void (async () => {
        const config = getActiveSignerConfig();
        if (config?.type !== NIP46_SIGNER_TYPE || !cachedSigner) {
          // No active NIP-46 connection, stop monitoring
          if (healthCheckInterval) {
            clearInterval(healthCheckInterval);
            healthCheckInterval = null;
          }
          return;
        }

        // Run health check only when connection has been idle for a while.
        // Calling getPublicKey() prompts the signer app (e.g. Primal); we avoid doing this
        // too often so the user is not asked to "return to app" every minute.
        const now = Date.now();
        const timeSinceLastActivity = _lastActivityTime
          ? now - _lastActivityTime
          : Infinity;
        const timeSinceLastVerification = _lastVerificationTime
          ? now - _lastVerificationTime
          : Infinity;
        const shouldSyncRelays =
          cachedSigner.type === NIP46_SIGNER_TYPE &&
          (_lastRelaySyncAt == null ||
            now - _lastRelaySyncAt > RELAY_SYNC_COOLDOWN_MS);

        // Only check when: past reconnect grace (15 min) AND (no activity for 5 min OR last verification was > 5 min ago)
        const connectionAge = connectionEstablishedAt
          ? now - connectionEstablishedAt
          : 0;
        const idleLongEnough = timeSinceLastActivity > 5 * 60 * 1000;
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
            // Record/emit stale for UI and logs but do not clear the cache.
            // Cache is only cleared when sign() actually fails (in the adapter).
            if (cachedSigner === signerToCheck) {
              if (typeof window !== "undefined") {
                window.dispatchEvent(
                  new CustomEvent(NOSTR_CONNECTION_STALE_EVENT, {
                    detail: { signerType: NIP46_SIGNER_TYPE },
                  })
                );
              }
            }
          } else if (cachedSigner === signerToCheck) {
            // Connection is healthy, update activity time only if still same signer
            _lastActivityTime = Date.now();
          }
        }

        if (shouldSyncRelays && cachedSigner.type === NIP46_SIGNER_TYPE) {
          try {
            await syncRelaysWithRemoteSigner(cachedSigner);
          } catch {
            // Relay sync is best-effort; keep signer usable even if sync fails.
          }
        }
      })();
    },
    2 * 60 * 1000
  ); // Check every 2 minutes (avoid prompting signer app too often)
}

/**
 * Stop health check monitoring
 */
function stopHealthCheckMonitoring(): void {
  if (healthCheckInterval) {
    clearInterval(healthCheckInterval);
    healthCheckInterval = null;
  }
}

/**
 * Single "create + probe" path: build signer from stored config (fromBunker, no connect), run getPublicKey (probe), return signer and pubkey or throw.
 * Use for both bunker and nostrconnect reconnect. Ensures every reconnect goes through the same probe; on failure signer is not cached.
 */
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

  // nostrconnect_uri: use bunkerPointer when present, else signerPubkey + relays
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

// Complex signer resolution with caching, health checks, cooldowns, and platform-specific optimizations
export async function getActiveSigner(
  options?: GetActiveSignerOptions
): Promise<NostrSigner | null> {
  const allowReconnect = options?.allowReconnect ?? true;

  // On resume we tear down and set needsReprobe; never return cached signer until we reprobe.
  if (needsReprobe && cachedSigner) {
    clearCachedNip46Signer();
  }

  // If we have a cached signer, optionally verify before returning it.
  // Skip verification when: within reconnect grace, or recently verified and connection fresh, or we had recent activity.
  // On verification failure we do not clear the cache; only a failed sign() will clear (in the adapter).
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
    // Verification failed (e.g. ping timeout). Do not clear here; only clear after a failed sign() in the adapter.
    // Return the cached signer so the sign attempt can proceed; if sign fails we clear there.
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

  const configJson = JSON.stringify(config);
  if (!allowReconnect) {
    return null;
  }
  if (inFlightSignerPromise && inFlightSignerConfigJson === configJson) {
    return await inFlightSignerPromise;
  }

  const requestId = ++signerResolutionRequestId;
  const isRequestCurrent = () => {
    if (requestId !== signerResolutionRequestId) {
      return false;
    }
    const latest = getActiveSignerConfig();
    return latest !== null && JSON.stringify(latest) === configJson;
  };

  // eslint-disable-next-line sonarjs/cognitive-complexity -- connection flow needs nuanced recovery branches for mobile/websocket scenarios
  const connectPromise = (async (): Promise<NostrSigner | null> => {
    // Check if we're in a cooldown period after app became visible
    // This helps prevent connection attempts immediately after returning from background
    const now = Date.now();
    if (now < connectionCooldownUntil) {
      const waitMs = connectionCooldownUntil - now;
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }

    const myGen = signerGeneration;
    const clientSecretKey = hexToBytes(config.clientSecretKeyHex);
    let pool: SimplePool | null = new SimplePool();
    let relaysToClose: string[] = [];

    try {
      if (config.method === "bunker_input") {
        // Reconnect from stored config: single create+probe path (fromBunker, no connect).
        const result = await createNip46SignerFromStoredConfig(config, {
          pool,
          timeoutMs: 90_000,
        });
        if (!isRequestCurrent()) {
          await result.signer.close();
          return null;
        }
        cachedSigner = result.signer;
        pool = null; // Transfer ownership to cachedSigner
        const nowEst = Date.now();
        connectionEstablishedAt = nowEst;
        _lastActivityTime = nowEst;
        _lastVerificationTime = nowEst; // We just connected; skip verify cooldown until needed
        startHealthCheckMonitoring();

        // Probe on first use after resume; short timeout so we fail fast if signer app is closed.
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
                error: "Probe failed after resume",
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

        // Get pubkey for connection update
        const pubkey = await cachedSigner.getPublicKey();

        // Update connection if exists
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

        // Emit connection healthy event
        if (typeof window !== "undefined") {
          window.dispatchEvent(
            new CustomEvent("nostr-connection-healthy", {
              detail: { signerType: NIP46_SIGNER_TYPE },
            })
          );
        }

        try {
          await syncRelaysWithRemoteSigner(cachedSigner);
        } catch {
          // Best-effort relay sync; keep successful connection.
        }

        return cachedSigner;
      }

      // nostrconnect_uri
      // Reconnect: use Method 1 (fromBunker, no connect) when we have signerPubkey; else fromURI once and persist signerPubkey.
      relaysToClose = config.relays;
      try {
        const unionRelays = buildRelayUnion(
          config.relays,
          DEFAULT_RELAYS_CONNECT,
          RELAY_UNION_CAP
        );
        if (unionRelays.length > 0) {
          relaysToClose = unionRelays;
        }
      } catch {
        // Keep original relays if build fails
      }

      if (
        config.bunkerPointer ||
        (config.signerPubkey && config.relays.length > 0)
      ) {
        if (config.bunkerPointer?.relays.length) {
          relaysToClose = config.bunkerPointer.relays
            .map((r) => r.trim())
            .filter((r) => r.startsWith("wss://"));
        }
        // Method 1 reconnect: single create+probe path (fromBunker, no connect).
        const result = await createNip46SignerFromStoredConfig(config, {
          pool,
          timeoutMs: 90_000,
        });
        if (!isRequestCurrent()) {
          await result.signer.close();
          return null;
        }
        cachedSigner = result.signer;
        pool = null; // Transfer ownership to cachedSigner
      } else {
        // Legacy or first time: use fromURI(); after success we persist signerPubkey.
        let uriToUse = config.uri;
        try {
          const parsed = parseNostrConnectURI(config.uri);
          const unionRelays = buildRelayUnion(
            config.relays,
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
          // Keep original uri/relays if parse fails
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
        pool = null; // Transfer ownership to cachedSigner
      }
      const nowEst = Date.now();
      connectionEstablishedAt = nowEst;
      _lastActivityTime = nowEst;
      _lastVerificationTime = nowEst; // We just connected; skip verify cooldown until needed
      startHealthCheckMonitoring();

      // Probe on first use after resume; short timeout so we fail fast if signer app is closed.
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
              error: "Probe failed after resume",
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

      // Persist winning relays when we connected using union so next time we try the working set first
      if (
        relaysToClose.length > 0 &&
        !relayListsEqual(relaysToClose, config.relays)
      ) {
        persistActiveSignerConfigWithoutReset({
          ...config,
          relays: relaysToClose,
        });
        const connectionForRelays = getActiveConnection();
        if (
          connectionForRelays?.config.type === NIP46_SIGNER_TYPE &&
          connectionForRelays.config.method === "nostrconnect_uri"
        ) {
          updateSession(connectionForRelays.id, {
            config: {
              ...connectionForRelays.config,
              relays: relaysToClose,
            },
            metadata: {
              ...connectionForRelays.metadata,
              relays: relaysToClose,
              lastActivityAt: Date.now(),
            },
          });
        }
      }

      // Get pubkey for connection update
      const pubkey = await cachedSigner.getPublicKey();

      // Persist signerPubkey and bunkerPointer when available so next reconnect uses Method 1
      const configUpdates: Partial<typeof config> = {};
      if (!config.signerPubkey) {
        configUpdates.signerPubkey = convertToHex(pubkey) ?? pubkey;
      }
      if (
        cachedSigner.type === NIP46_SIGNER_TYPE &&
        "getBunkerPointer" in cachedSigner
      ) {
        configUpdates.bunkerPointer = (
          cachedSigner as Nip46Signer
        ).getBunkerPointer();
      }
      if (Object.keys(configUpdates).length > 0) {
        persistActiveSignerConfigWithoutReset({ ...config, ...configUpdates });
      }

      // Update connection if exists
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

      // Emit connection healthy event
      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("nostr-connection-healthy", {
            detail: { signerType: NIP46_SIGNER_TYPE },
          })
        );
      }

      try {
        await syncRelaysWithRemoteSigner(cachedSigner);
      } catch {
        // Best-effort relay sync; keep successful connection.
      }

      return cachedSigner;
    } catch (err) {
      // Clean up pool if connection failed
      if (pool) {
        try {
          if (config.method === "nostrconnect_uri") {
            pool.close(relaysToClose);
          }
        } catch {
          // Ignore cleanup errors
        }
      }

      // If connection fails, clear only the cached signer object, NOT the config
      // The config (connection URI/credentials) is preserved so that:
      // 1. Signer apps like Primal can restore the connection using the same credentials
      // 2. We can attempt reconnection with the same connection URI
      // 3. Users don't need to re-approve the connection if the signer app remembers it
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
        // Clear cached signer so next call creates fresh and probes (stateless signer discipline).
        resetCachedSigner();
        connectionEstablishedAt = null;
        _lastActivityTime = null;
        needsReprobe = true;

        // Update connection with error
        const activeConnection = getActiveConnection();
        if (activeConnection) {
          const fullErrorMessage =
            err instanceof Error ? err.message : String(err);
          recordConnectionEvent(activeConnection.id, {
            type: "error",
            error: fullErrorMessage,
          });
        }

        // On mobile, extend cooldown period after connection errors
        // This gives more time for WebSocket connections to stabilize
        if (isMobile()) {
          const errorCooldown = isIOS() ? 2000 : 1500; // iOS: 2s, Android: 1.5s
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

/**
 * A minimal signer shape compatible with libraries expecting NIP-07 style `window.nostr`.
 */
export async function getWindowNostrLikeSigner(): Promise<{
  getPublicKey: () => Promise<string>;
  signEvent: (event: NostrEvent) => Promise<SignedEvent>;
} | null> {
  // Prefer configured signer if present
  const active = await getActiveSigner();
  if (active) {
    return {
      getPublicKey: async () => await active.getPublicKey(),
      signEvent: async (event: NostrEvent) => await active.signEvent(event),
    };
  }

  // Fallback to extension if available
  // @ts-ignore - injected at runtime by extensions
  if (typeof window !== "undefined" && window.nostr) {
    // @ts-ignore - injected at runtime by extensions
    return window.nostr;
  }

  return null;
}

export async function getActiveSignerPubkeyHint(): Promise<string | null> {
  const cfg = getActiveSignerConfig();
  if (!cfg) return null;
  if (cfg.type === "nip07") return null;
  try {
    const sk = hexToBytes(cfg.clientSecretKeyHex);
    return getPublicKey(sk);
  } catch {
    return null;
  }
}
