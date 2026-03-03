import { SimplePool, getPublicKey } from "nostr-tools";
import {
  BunkerSigner,
  createNostrConnectURI,
  parseBunkerInput,
  parseNostrConnectURI,
} from "nostr-tools/nip46";

import {
  Nip07Signer,
  Nip46Signer,
  type NostrSigner,
} from "~/features/auth/nostr-signer.client";
import type { NostrEvent, SignedEvent } from "~/features/nostr/types";
import { RemoteSignerTimeoutError } from "~/lib/errors";
import { isMobile } from "~/lib/is-mobile";
import {
  addConnectionLog,
  getActiveSession,
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

/** Minimum time between verification checks (avoid prompting signer app too often). */
const VERIFY_COOLDOWN_MS = 2 * 60 * 1000; // 2 minutes
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
 * Useful when a NIP-46 remote signer connection becomes stale.
 */
export function resetCachedSigner(): void {
  cachedSigner = null;
  _lastVerificationTime = null;
  _lastRelaySyncAt = null;
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
 * - Signer apps like Primal can restore the session using the same credentials
 * - We can attempt reconnection with the same connection URI
 * - Users don't need to re-approve if the signer app remembers the connection
 */
function clearCachedNip46Signer(): void {
  const config = getActiveSignerConfig();
  if (config?.type === NIP46_SIGNER_TYPE && cachedSigner) {
    // Close existing connections gracefully
    if (cachedSigner.type === NIP46_SIGNER_TYPE && cachedSigner.close) {
      const closeFn = cachedSigner.close;
      void (async () => {
        try {
          await closeFn();
        } catch {
          // Ignore errors during cleanup
        }
      })();
    }
    // Clear only the cached signer object, keep the config for reconnection
    resetCachedSigner();
    stopHealthCheckMonitoring();
    connectionEstablishedAt = null;
    _lastActivityTime = null;
  }
}

/**
 * Exported teardown for NIP-46 signer. Call before clearing session storage (e.g. before
 * clearActiveSession or removeSession when removing the active session) so the in-memory
 * signer, pool, and health-check timer are closed and the next connect does not overlap.
 */
export function teardownActiveNip46Signer(): void {
  clearCachedNip46Signer();
}

/**
 * Teardown cached NIP-46 signer and set needsReprobe so the next getActiveSigner()
 * creates a fresh signer and runs a short probe. Call on app resume (visibility/focus/pageshow).
 */
function teardownNip46SignerAndSetNeedsReprobe(): void {
  const config = getActiveSignerConfig();
  if (config?.type !== NIP46_SIGNER_TYPE) return;
  clearCachedNip46Signer();
  needsReprobe = true;
}

/**
 * Initialize page visibility detection: on resume (visible/focus/pageshow), tear down
 * cached NIP-46 signer and set needsReprobe so the next use creates a fresh signer and probes.
 */
function initVisibilityHandler(): void {
  if (typeof document === "undefined") return;

  const onResume = () => {
    const now = Date.now();
    wasHidden = false;
    teardownNip46SignerAndSetNeedsReprobe();
    // Cooldown so we don't reconnect immediately if getActiveSigner is called in the same tick
    if (isMobile()) {
      const baseCooldown = isIOS() ? 3000 : 1500;
      connectionCooldownUntil = now + baseCooldown + Math.random() * 500;
    } else {
      connectionCooldownUntil = now + 500;
    }
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

  const activeSession = getActiveSession();
  if (activeSession?.config.type === NIP46_SIGNER_TYPE) {
    updateSession(activeSession.id, {
      config:
        activeSession.config.method === "nostrconnect_uri"
          ? {
              ...activeSession.config,
              relays: normalized,
            }
          : activeSession.config,
      metadata: {
        ...activeSession.metadata,
        relays: normalized,
        lastActivityAt: Date.now(),
      },
    });
    addConnectionLog(activeSession.id, {
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
 * Returns true if the signer is available and can be used, false otherwise.
 * Uses a quick health check with a short timeout to avoid blocking.
 */
async function verifySignerConnection(
  signer: NostrSigner,
  timeoutMs = 5000
): Promise<boolean> {
  if (signer.type !== NIP46_SIGNER_TYPE) return true; // NIP-07 doesn't need verification

  try {
    // Prefer ping for health checks to avoid unnecessarily prompting signer UI.
    if (typeof signer.ping === "function") {
      debugSignerManagerTrace("Running ping-based signer health check");
      await Promise.race([
        signer.ping(),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("Ping check timeout")), timeoutMs)
        ),
      ]);
    } else {
      debugSignerManagerTrace(
        "Ping unavailable, falling back to get_public_key health check"
      );
      // Fallback path for signer implementations without ping support.
      await Promise.race([
        signer.getPublicKey(),
        new Promise<never>((_, reject) =>
          setTimeout(
            () => reject(new Error("Connection check timeout")),
            timeoutMs
          )
        ),
      ]);
    }
    const now = Date.now();
    _lastActivityTime = now;
    _lastVerificationTime = now;
    return true;
  } catch {
    // Any error means the connection is stale or unreachable
    // This includes "subscription closed", websocket errors, and other connection issues
    // However, this doesn't mean we should give up - we can try reconnecting with the same URI
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

        // Only check when: connection is at least 5 min old AND (no activity for 5 min OR last verification was > 5 min ago)
        const connectionAge = connectionEstablishedAt
          ? now - connectionEstablishedAt
          : 0;
        const idleLongEnough = timeSinceLastActivity > 5 * 60 * 1000;
        const verificationStale = timeSinceLastVerification > 5 * 60 * 1000;

        if (
          connectionEstablishedAt &&
          connectionAge > 5 * 60 * 1000 &&
          (idleLongEnough || verificationStale)
        ) {
          const isValid = await verifySignerConnection(cachedSigner);
          if (!isValid) {
            // Connection is stale, clear it
            clearCachedNip46Signer();
            connectionEstablishedAt = null;
            _lastActivityTime = null;

            // Update session status
            const activeSession = getActiveSession();
            if (activeSession) {
              recordConnectionEvent(activeSession.id, {
                type: "health_check",
                healthy: false,
                error: "Connection stale",
              });
            }

            // Emit event for connection state change
            if (typeof window !== "undefined") {
              window.dispatchEvent(
                new CustomEvent(NOSTR_CONNECTION_STALE_EVENT, {
                  detail: { signerType: NIP46_SIGNER_TYPE },
                })
              );
            }
          } else {
            // Connection is healthy, update activity time
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

// Complex signer resolution with caching, health checks, cooldowns, and platform-specific optimizations
export async function getActiveSigner(
  options?: GetActiveSignerOptions
): Promise<NostrSigner | null> {
  const allowReconnect = options?.allowReconnect ?? true;

  // On resume we tear down and set needsReprobe; never return cached signer until we reprobe.
  if (needsReprobe && cachedSigner) {
    clearCachedNip46Signer();
  }

  // If we have a cached signer, verify it's still valid before returning it,
  // but not on every call — use a cooldown so we don't prompt the signer app (e.g. Primal) every time.
  if (cachedSigner) {
    const now = Date.now();
    const shouldVerify =
      _lastVerificationTime == null ||
      now - _lastVerificationTime > VERIFY_COOLDOWN_MS;

    if (!shouldVerify) {
      _lastActivityTime = now;
      return cachedSigner;
    }

    const isValid = await verifySignerConnection(cachedSigner);
    if (isValid) {
      _lastActivityTime = Date.now();
      return cachedSigner;
    }
    // Connection verification failed; clear cache so next call creates fresh signer and probes.
    clearCachedNip46Signer();
    needsReprobe = true;

    // Update session status
    const activeSession = getActiveSession();
    if (activeSession) {
      recordConnectionEvent(activeSession.id, {
        type: "health_check",
        healthy: false,
        error: "Connection verification failed",
      });
    }

    // Emit connection stale event
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent(NOSTR_CONNECTION_STALE_EVENT, {
          detail: { signerType: NIP46_SIGNER_TYPE },
        })
      );
    }

    if (!allowReconnect) {
      return null;
    }
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

    const clientSecretKey = hexToBytes(config.clientSecretKeyHex);
    let pool: SimplePool | null = new SimplePool();
    let relaysToClose: string[] = [];

    try {
      if (config.method === "bunker_input") {
        const bp = await parseBunkerInput(config.bunkerInput);
        if (!bp) {
          throw new Error("Invalid bunker input");
        }
        const inner = BunkerSigner.fromBunker(clientSecretKey, bp, { pool });
        // Reuse the same bunker input - signer apps like Primal keep track of all
        // connected apps and can restore sessions even if they were previously stopped.
        // By using the same bunker input and clientSecretKey, Primal will recognize
        // this as a reconnection attempt and restore the existing session.
        await inner.connect();
        if (!isRequestCurrent()) {
          await inner.close();
          return null;
        }
        cachedSigner = new Nip46Signer({ pool, inner });
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
            const activeSession = getActiveSession();
            if (activeSession) {
              recordConnectionEvent(activeSession.id, {
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

        // Get pubkey for session update
        const pubkey = await cachedSigner.getPublicKey();

        // Update session if exists
        const activeSession = getActiveSession();
        if (activeSession) {
          updateSession(activeSession.id, {
            metadata: {
              ...activeSession.metadata,
              status: "active",
              pubkey,
              connectedAt: Date.now(),
              lastActivityAt: Date.now(),
              lastError: null,
            },
          });

          recordConnectionEvent(activeSession.id, {
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
      // Use relay union (stored + defaults) for resilience; same client key for session restore.
      let uriToUse = config.uri;
      relaysToClose = config.relays;
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
          const activeSession = getActiveSession();
          if (activeSession) {
            recordConnectionEvent(activeSession.id, {
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

      // Get pubkey for session update
      const pubkey = await cachedSigner.getPublicKey();

      // Update session if exists
      const activeSession = getActiveSession();
      if (activeSession) {
        updateSession(activeSession.id, {
          metadata: {
            ...activeSession.metadata,
            status: "active",
            pubkey,
            connectedAt: Date.now(),
            lastActivityAt: Date.now(),
            lastError: null,
          },
        });

        recordConnectionEvent(activeSession.id, {
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
      // 1. Signer apps like Primal can restore the session using the same credentials
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

        // Update session with error
        const activeSession = getActiveSession();
        if (activeSession) {
          const fullErrorMessage =
            err instanceof Error ? err.message : String(err);
          recordConnectionEvent(activeSession.id, {
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
