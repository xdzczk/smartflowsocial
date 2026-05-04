/**
 * NIP-46/Bunker connection lifecycle: connect, disconnect, reconnect, and
 * signer cache.
 *
 * Design: a NIP-46 signer is cached and reused across calls until the
 * underlying transport becomes suspect, at which point the next
 * `getActiveSigner({ allowReconnect: true })` call rebuilds a fresh
 * `BunkerSigner` from stored config. "Suspect" means one of:
 *   - The page came back from bfcache (`pageshow` with `event.persisted`).
 *   - The tab was hidden longer than `STALE_AFTER_HIDDEN_MS` and is now
 *     visible again (covers OS-suspended PWAs and long-backgrounded tabs).
 *   - A previous sign attempt failed with a connection-shaped error (set
 *     externally via `markNip46TransportStale`).
 *   - Cache was explicitly torn down (logout, cancel, login install).
 *
 * Why not "always rebuild": nostr-tools' `BunkerSigner` keeps its
 * `listeners` map, `serial`, `idPrefix`, and `subCloser` on the JS heap for
 * the lifetime of the instance. iOS Safari preserves that heap across tab
 * close/reopen via bfcache, but the underlying WebSockets are torn down by
 * the OS in the meantime  -  that is the bug we have to fix. Rebuilding on
 * every call also fixes it, but it spawns a fresh REQ subscription per
 * sign, which inflates relay traffic for bulk loops (50 posts → 50 extra
 * subscriptions piling up against the bunker relay's quota). Pinning the
 * rebuild to the events that actually correlate with a torn-down transport
 * gives us the same fix without the per-call cost.
 *
 * Side-effects (session metadata update, "healthy" event dispatch) only
 * fire on the **first** rebuild after a fresh login or a hard cache reset.
 * Subsequent rebuilds are silent: just construct a fresh `BunkerSigner`
 * from stored config, install it as the cached signer, and close the
 * previous one in the background.
 */

import {
  Nip07Signer,
  type NostrSigner,
} from "~/features/auth/nostr-signer.client";
import { getSharedPool } from "~/features/nostr/shared-pool.client";

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
import { resolveNip46SignerFromConfig } from "./connection-resolve.client";
import {
  getActiveSignerConfig,
  persistActiveSignerConfigWithoutReset,
  type ActiveSignerConfig,
} from "./nostr-signer-storage.client";
import {
  getActiveConnection,
  updateSession,
} from "./remote-signer-sessions.client";
import { recordConnectionEvent } from "./remote-signer-status.client";

/**
 * Timeout for the lightweight rebuild path (`createNip46SignerFromStoredConfig`
 * with `skipValidation: true`). Construction itself is synchronous; the
 * timeout only bounds `parseBunkerInput`'s NIP-05 fetch, which only happens
 * on bunker_input configs that store an nostr+walletconnect-style identifier.
 * For plain `bunker://` URIs and nostrconnect_uri configs the rebuild
 * resolves in milliseconds.
 */
const NIP46_REBUILD_TIMEOUT_MS = 30_000;

/**
 * How long to keep a previous (replaced) NIP-46 signer instance alive before
 * tearing down its bunker subscription. A rebuild can race a sign call that
 * already picked up the previous signer; closing the bunker subscription
 * detaches the listener that would resolve the pending RPC. The longest
 * per-RPC timeout on the inner `BunkerSigner` is 60s (`sign_event`); we add
 * a small buffer so the close runs safely after the worst-case RPC has
 * cleared.
 */
const PREVIOUS_SIGNER_CLOSE_DELAY_MS = 65_000;

/**
 * Hidden duration above which a returning tab is treated as "transport
 * suspect". Below this threshold a tab switch is just a tab switch  -  sockets
 * stay open, the BunkerSigner is fine, no rebuild needed. Above it the OS
 * very likely suspended the tab and tore down our WebSockets.
 */
const STALE_AFTER_HIDDEN_MS = 60_000;

export { NOSTR_CONNECTION_STALE_EVENT, NOSTR_CONNECTION_HEALTHY_EVENT };

export interface GetActiveSignerOptions {
  allowReconnect?: boolean;
}

/**
 * NIP-46 transport-stale flag. Set when we have reason to believe the
 * cached `BunkerSigner`'s sockets/subscription have died underneath us
 * (bfcache resume, long-hidden tab, explicit error signal). Read once per
 * `getActiveSigner({ allowReconnect: true })` call; cleared as soon as we
 * begin rebuilding.
 */
let nip46TransportStale = false;
let lastVisibilityHiddenAt: number | null = null;
let visibilityListenersInstalled = false;

/**
 * Mark the cached NIP-46 signer's transport as suspect so the next
 * `getActiveSigner({ allowReconnect: true })` call rebuilds a fresh
 * `BunkerSigner` instead of reusing the cached one. No-op when called on
 * the server.
 */
export function markNip46TransportStale(_reason?: string): void {
  nip46TransportStale = true;
}

function installTransportStalenessListeners(): void {
  if (visibilityListenersInstalled) return;
  if (typeof window === "undefined" || typeof document === "undefined") return;
  visibilityListenersInstalled = true;

  // bfcache resume: the JS heap (and our cached BunkerSigner) survives the
  // tab close/reopen but the underlying WebSockets do not. This is the
  // exact scenario where the cached signer's listeners map is wired to a
  // socket that no longer exists.
  window.addEventListener("pageshow", (event) => {
    const persistedFromBfcache = event.persisted;
    if (persistedFromBfcache) {
      markNip46TransportStale("bfcache_resume");
    }
  });

  // Long-hidden tab: iOS Safari and PWA hosts aggressively suspend hidden
  // tabs. A short tab switch is fine; a long one almost certainly killed
  // our sockets.
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      lastVisibilityHiddenAt = Date.now();
      return;
    }
    if (lastVisibilityHiddenAt == null) return;
    const hiddenMs = Date.now() - lastVisibilityHiddenAt;
    lastVisibilityHiddenAt = null;
    if (hiddenMs >= STALE_AFTER_HIDDEN_MS) {
      markNip46TransportStale("long_hidden");
    }
  });
}

if (typeof window !== "undefined") {
  installTransportStalenessListeners();
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
  // The cache slot is empty now; the staleness flag is meaningless until a
  // new signer is built, so clear it to keep state consistent.
  nip46TransportStale = false;
}

export function teardownActiveNip46Signer(): void {
  clearCachedNip46Signer();
}

/**
 * Cancel any in-flight NIP-46 RPC and drop the cached signer so the next
 * `getActiveSigner()` call rebuilds it from stored config. The cached signer
 * holds an `rpcLock` that serialises all RPCs through one chain; if a `sign_event`
 * is still pending when the user clicks "Cancel" in the composer, the next sign
 * would otherwise queue behind that orphaned RPC and wait up to 60s for it to
 * time out. Closing the bunker subscription also stops the still-pending
 * RPC's listener from firing into a UI that no longer cares.
 *
 * Safe to call when no signer is cached or when the cached signer is NIP-07
 * (no-op in those cases).
 */
export function cancelSignerInFlight(): void {
  const cached = getCachedSigner();
  if (
    cached?.type === NIP46_SIGNER_TYPE &&
    typeof cached.close === "function"
  ) {
    const closeFn = cached.close;
    void (async () => {
      try {
        await closeFn();
      } catch {
        // best-effort cleanup; the cache reset below is what matters
      }
    })();
  }
  resetCachedSigner();
  nip46TransportStale = false;
}

export function cacheNip46SignerFromLogin(signer: NostrSigner): void {
  cacheNip46SignerFromLoginImpl(signer);
}

export { createNip46SignerFromStoredConfigImpl as createNip46SignerFromStoredConfig };

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
  // Cache is empty now; no point holding the staleness flag  -  it would
  // immediately get cleared by the next rebuild anyway.
  nip46TransportStale = false;

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

/**
 * Best-effort close on a previous NIP-46 signer instance after we have
 * already installed its replacement. Deferred by `PREVIOUS_SIGNER_CLOSE_DELAY_MS`
 * so a sign call that picked up the previous signer just before the rebuild
 * is not torn out from under its in-flight RPC: closing the bunker
 * subscription detaches the listener that would resolve the pending
 * `sign_event`, leaving the original caller hanging until its own outer
 * timeout fires.
 */
function closePreviousNip46Signer(previous: NostrSigner | null): void {
  if (
    previous?.type !== NIP46_SIGNER_TYPE ||
    typeof previous.close !== "function"
  ) {
    return;
  }
  const closeFn = previous.close;
  setTimeout(() => {
    void (async () => {
      try {
        await closeFn();
      } catch {
        // best-effort cleanup; the replacement is already in place.
      }
    })();
  }, PREVIOUS_SIGNER_CLOSE_DELAY_MS);
}

/**
 * Lightweight rebuild path: construct a fresh `BunkerSigner` from the stored
 * config without re-running session-metadata updates or "healthy" event
 * dispatches. The first rebuild after a hard cache reset goes through
 * `resolveNip46SignerFromConfig` (which does run those side-effects); every
 * subsequent rebuild stays silent. The result is that each user-initiated
 * sign click gets a brand-new `BunkerSigner` with fresh `listeners`,
 * `serial`, `idPrefix`, and `subCloser`, eliminating the
 * stale-internal-state class of bug that bites bfcache-restored tabs on iOS
 * Safari without spamming session metadata events.
 */
async function rebuildCachedNip46Signer(
  config: Extract<ActiveSignerConfig, { type: "nip46" }>
): Promise<NostrSigner | null> {
  const pool = getSharedPool();
  const previous = getCachedSigner();

  const result = await createNip46SignerFromStoredConfigImpl(config, {
    pool,
    timeoutMs: NIP46_REBUILD_TIMEOUT_MS,
  });

  setCachedSigner(result.signer);
  closePreviousNip46Signer(previous);

  return result.signer;
}

export async function getActiveSigner(
  options?: GetActiveSignerOptions
): Promise<NostrSigner | null> {
  const allowReconnect = options?.allowReconnect ?? true;

  const config = getActiveSignerConfig();
  if (!config) return null;

  // NIP-07 has no per-call state worth rebuilding (it's a thin wrapper around
  // window.nostr), so cache the singleton as before.
  if (config.type === "nip07") {
    const cached = getCachedSigner();
    if (cached?.type === "nip07") return cached;
    const nip07 = new Nip07Signer();
    setCachedSigner(nip07);
    return nip07;
  }

  const nip46Config = config;
  const configJson = JSON.stringify(config);

  // Probe path: testConnection() and similar callers want to know whether
  // a signer is currently live without paying for a rebuild round-trip.
  // Return whatever is cached (may be null after a teardown/cancel) and
  // never rebuild in this mode.
  if (!allowReconnect) {
    return getCachedSigner();
  }

  // Happy path: the cached signer is fine  -  return it directly. We only
  // rebuild when the transport-staleness flag is set (bfcache resume,
  // long-hidden tab, explicit error). This keeps bulk-sign loops and
  // intra-action follow-up RPCs cheap while still guaranteeing a fresh
  // BunkerSigner the first time the user comes back to a suspended tab.
  const cached = getCachedSigner();
  if (cached?.type === NIP46_SIGNER_TYPE && !nip46TransportStale) {
    return cached;
  }

  // Dedup concurrent rebuilds for the same config: two parallel callers
  // share one fresh BunkerSigner instead of constructing two and racing
  // their setupSubscription() REQs against each other.
  const inFlight = getInFlightSignerPromise();
  if (inFlight && getInFlightSignerConfigJson() === configJson) {
    return await inFlight;
  }

  const isRequestCurrent = () => {
    const latest = getActiveSignerConfig();
    return latest !== null && JSON.stringify(latest) === configJson;
  };

  // First rebuild after a hard cache reset (fresh login, teardown, error
  // recovery) goes through the full resolve path so session metadata,
  // pubkey persistence, and the "healthy" event are populated correctly.
  // Every subsequent rebuild (e.g. after the stale flag flips) is a silent
  // BunkerSigner replacement.
  const isFirstRebuild = cached?.type !== NIP46_SIGNER_TYPE;

  // Clear the stale flag at the moment we commit to rebuilding. If a new
  // bfcache/visibility event sets it again while the rebuild is in flight,
  // the next caller will rebuild a second time  -  that is the right
  // behavior: better one wasted rebuild than reusing a transport that we
  // already know is suspect.
  nip46TransportStale = false;

  const connectPromise: Promise<NostrSigner | null> = isFirstRebuild
    ? resolveNip46SignerFromConfig(nip46Config, {
        isRequestCurrent,
        setCachedSigner,
        getCachedSigner,
        getActiveConnection,
        updateSession,
        recordConnectionEvent,
        persistActiveSignerConfigWithoutReset,
      })
    : (async () => {
        if (!isRequestCurrent()) return null;
        return await rebuildCachedNip46Signer(nip46Config);
      })();

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
