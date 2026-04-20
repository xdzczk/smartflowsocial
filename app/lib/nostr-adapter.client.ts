/**
 * Canonical Nostr Adapter (Client-side)
 *
 * This module provides a unified interface for client-side Nostr operations.
 * It wraps window.nostr (NIP-07) and nostr-tools for consistent event signing.
 *
 * Usage:
 *   import { nostrAdapter } from "~/lib/nostr-adapter.client";
 *   const result = await nostrAdapter.signEvent(eventData);
 */

import { nip19 } from "nostr-tools";
import { toast } from "react-hot-toast";

import type { NostrSigner } from "~/features/auth/nostr-signer.client";
import {
  addConnectionLog,
  emitRemoteSignerTimeoutEvent,
  getActiveConnection,
  recordConnectionEvent,
  updateSession,
} from "~/features/auth/signer";
import type {
  NostrEvent,
  SignedEvent,
  SignEventResult,
  NostrEventData,
  LongFormEventData,
} from "~/features/nostr/types";
import { buildPollTags, KIND_POLL } from "~/features/polls";
import { BRAND_NAME } from "~/lib/brand";
import {
  Nip07AccountMismatchError,
  RemoteSignerTimeoutError,
} from "~/lib/errors";
import {
  checkNip07Readiness,
  getExpectedPubkeyHexForGuard,
  getNip07Readiness,
} from "~/lib/nip07-readiness.client";
import {
  isConnectionLikeError,
  isSignTimeoutError,
} from "~/lib/signer-error-classification";

// ============================================================================
// Helper Functions
// ============================================================================

const ACTIVE_SIGNER_SIGN_TIMEOUT_MS = 30_000;
/** Max time to wait for signer resolution (getActiveSigner). */
const GET_ACTIVE_SIGNER_TIMEOUT_MS = 30_000;
/**
 * After this many ms of waiting on the signer with no response, dispatch a
 * "nudge" so the UI can prompt the user to check their signer app. This
 * replaces the old "Attempt N of 5" event stream.
 */
const SIGNER_NUDGE_AFTER_MS = 4_000;

export type SignerNudgePhase =
  | "start"
  | "nudge"
  | "reconnect"
  | "fail"
  | "done";

export interface SignerNudgeDetail {
  phase: SignerNudgePhase;
  startedAt: number;
  elapsedMs: number;
  /** Soft target after which the next phase typically takes over (display only). */
  timeoutMs: number;
}

function dispatchSignerNudge(phase: SignerNudgePhase, startedAt: number): void {
  if (typeof window === "undefined") return;
  const detail: SignerNudgeDetail = {
    phase,
    startedAt,
    elapsedMs: Date.now() - startedAt,
    timeoutMs: GET_ACTIVE_SIGNER_TIMEOUT_MS + ACTIVE_SIGNER_SIGN_TIMEOUT_MS,
  };
  window.dispatchEvent(new CustomEvent("signer-nudge", { detail }));
}

/**
 * Sign-timeout messages mean "the bunker did not approve in time" — the
 * underlying NIP-46 transport (subscription, sockets, signer cache) is fine,
 * the user just needs to open their signer app and approve. We must NOT
 * classify these as "connection-like" because doing so triggers
 * `reconnectAndRetrySign` which builds a fresh `Nip46Signer` and fires
 * another `sign_event` on top of the still-pending one, and the cycle
 * repeats every ~30s — flooding the relays (Damus rate-limits us) and
 * overwhelming Primal. Ditto's `signerWithNudge` does the same thing:
 * one attempt, one error, no auto-retry, no reconnect.
 */
const SIGN_TIMEOUT_KEY_DID_NOT_RESPOND = "did not respond";
const SIGN_TIMEOUT_KEY_APPROVE_REQUEST = "approve the request";

// Predicate implementations live in ~/lib/signer-error-classification so the
// composer pending-publish state machine can share the same definitions. The
// constants above are kept for documentation context only.

/**
 * True if we should clear the NIP-46 signer cache.
 *
 * Only clear on real transport errors (subscription closed, websocket dropped,
 * connect timeout). Never clear on a sign timeout: the cache is healthy, only
 * the bunker app failed to approve. Clearing would force a brand-new
 * `Nip46Signer` next attempt, which fires another duplicate `sign_event`
 * and compounds the problem.
 */
function shouldClearSignerCacheOnError(error: unknown): boolean {
  if (isSignTimeoutError(error)) return false;
  return isConnectionLikeError(error);
}

function debugSignerTrace(
  message: string,
  details?: Record<string, unknown>
): void {
  if (details) {
    console.info(`[remote-signer-sign] ${message}`, details);
    return;
  }
  console.info(`[remote-signer-sign] ${message}`);
}

async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  onTimeoutMessage: string
): Promise<T> {
  let timeoutReject!: (reason?: unknown) => void;
  const timer = new Promise<never>((_resolve, reject) => {
    timeoutReject = reject;
  });
  const timeoutId = globalThis.setTimeout(() => {
    timeoutReject(new RemoteSignerTimeoutError(onTimeoutMessage));
  }, timeoutMs);

  try {
    return await Promise.race([promise, timer]);
  } finally {
    globalThis.clearTimeout(timeoutId);
  }
}

export interface SignPollEventInput {
  question: string;
  created_at: number;
  optionLabels: string[];
  pollType: "singlechoice" | "multiplechoice";
  relayUrls: string[];
  endsAt?: number;
  /** Hashtag values without `#` (e.g. from preset chips) */
  topicTagValues?: string[];
}

function buildLongFormEventTags(eventData: LongFormEventData): string[][] {
  const eventTags: string[][] = [];

  if (eventData.title) {
    eventTags.push(["title", eventData.title]);
  }
  eventTags.push(["r", "wss://relay.primal.net/"]);
  eventTags.push(["client", BRAND_NAME]);
  if (eventData.summary) {
    eventTags.push(["summary", eventData.summary]);
  }
  if (eventData.image) {
    eventTags.push(["image", eventData.image]);
  }
  if (eventData.identifier) {
    eventTags.push(["d", eventData.identifier]);
  }
  if (eventData.publishedAt) {
    eventTags.push(["published_at", eventData.publishedAt.toString()]);
  }
  if (eventData.tags && eventData.tags.length > 0) {
    eventData.tags.forEach((tag) => {
      if (tag.trim()) {
        eventTags.push(["t", tag.trim().toLowerCase()]);
      }
    });
  }

  return eventTags;
}

function buildLongFormEvent(eventData: LongFormEventData): NostrEvent {
  return {
    content: eventData.content,
    created_at: Math.floor(Date.now() / 1000),
    kind: 30023, // NIP-23 long-form content
    tags: buildLongFormEventTags(eventData),
  };
}

function normalizeSignResult(
  signResult: unknown,
  nostrEvent: NostrEvent
): SignedEvent {
  const signedEvent =
    typeof signResult === "string" ? undefined : (signResult as SignedEvent);
  return {
    id: signedEvent?.id ?? "unknown",
    pubkey: signedEvent?.pubkey ?? "unknown",
    created_at: nostrEvent.created_at,
    kind: nostrEvent.kind,
    tags: nostrEvent.tags,
    content: nostrEvent.content,
    sig:
      typeof signResult === "string"
        ? signResult
        : (signedEvent?.sig ?? "unknown"),
  };
}

async function resetSignerCacheBestEffort(): Promise<void> {
  try {
    const signerManager = await import("~/features/auth/signer");
    if (typeof signerManager.resetCachedSigner === "function") {
      signerManager.resetCachedSigner();
    }
  } catch {
    // ignore
  }
}

function getSignerErrorLogEntry(error: unknown): {
  type: "error";
  status: "failure";
  message: string;
  details: Record<string, unknown>;
} {
  const errorMessage = error instanceof Error ? error.message : String(error);
  const msg = errorMessage.toLowerCase();
  const isSignTimeout =
    error instanceof RemoteSignerTimeoutError &&
    (msg.includes(SIGN_TIMEOUT_KEY_DID_NOT_RESPOND) ||
      msg.includes(SIGN_TIMEOUT_KEY_APPROVE_REQUEST));
  const isConnectionTimeout =
    error instanceof RemoteSignerTimeoutError &&
    (msg.includes("connection is taking too long") ||
      msg.includes("signer app") ||
      msg.includes("try again"));

  let message: string;
  if (isSignTimeout) {
    message = `Sign timed out: ${errorMessage}`;
  } else if (isConnectionTimeout) {
    message = `Connection timed out: ${errorMessage}`;
  } else {
    message = errorMessage;
  }

  return {
    type: "error",
    status: "failure",
    message,
    details: { error: errorMessage },
  };
}

function markActiveRemoteConnectionStale(error: unknown): void {
  const activeConnection = getActiveConnection();
  if (!activeConnection) return;

  const errorMessage = error instanceof Error ? error.message : String(error);
  const now = Date.now();

  updateSession(activeConnection.id, {
    metadata: {
      ...activeConnection.metadata,
      status: "stale",
      lastError: errorMessage,
      lastActivityAt: now,
    },
  });

  const logEntry = getSignerErrorLogEntry(error);
  addConnectionLog(activeConnection.id, logEntry);
}

async function handleConfiguredSignerError(
  err: unknown,
  prefersRemoteSigner: boolean,
  clearCacheOnError = true
): Promise<void> {
  if (!prefersRemoteSigner) return;
  const isSignTimeout = isSignTimeoutError(err);
  const isConnectionLike = isConnectionLikeError(err);
  // Sign timeouts are surfaced to the user (stale + nudge) but do NOT clear
  // the cache or trigger reconnect; only true connection-like errors do.
  if (!isSignTimeout && !isConnectionLike) return;

  const shouldClear =
    !isSignTimeout && clearCacheOnError && shouldClearSignerCacheOnError(err);
  debugSignerTrace("Configured signer error", {
    error: err instanceof Error ? err.message : String(err),
    isSignTimeout,
    clearCache: shouldClear,
  });
  markActiveRemoteConnectionStale(err);
  if (shouldClear) {
    const activeConnection = getActiveConnection();
    await resetSignerCacheBestEffort();
    if (activeConnection) {
      recordConnectionEvent(activeConnection.id, {
        type: "disconnected",
        reason: "Connection lost or sign failed",
      });
    }
  }
  if (err instanceof RemoteSignerTimeoutError) {
    emitRemoteSignerTimeoutEvent({ message: err.message });
  } else {
    emitRemoteSignerTimeoutEvent({
      message:
        "Connection to remote signer failed. Please try again or reconnect your signer.",
    });
  }
}

export interface SignEventOptions {
  /** When false, do not clear the signer cache on error (e.g. during bulk sign so one failure doesn't break other in-flight signs). */
  clearCacheOnError?: boolean;
  /**
   * Pre-resolved signer to use for this call. When provided we skip
   * `getActiveSigner` entirely and sign against this instance directly.
   * Use this for bulk loops so a single signer is reused across N events
   * instead of forcing a cache lookup (and potentially a full rebuild) per
   * iteration. The caller is responsible for acquiring the signer once and
   * for re-acquiring after a reconnect.
   */
  signer?: NostrSigner;
}

async function trySignWithConfiguredSigner(
  nostrEvent: NostrEvent,
  options?: SignEventOptions
): Promise<SignedEvent | null> {
  const clearCacheOnError = options?.clearCacheOnError !== false;
  let prefersRemoteSigner = false;
  try {
    const signerManager = await import("~/features/auth/signer");
    const cfg =
      typeof signerManager.getActiveSignerConfig === "function"
        ? signerManager.getActiveSignerConfig()
        : null;
    prefersRemoteSigner = !!cfg && cfg.type === "nip46";

    // Caller-provided signer (e.g. bulk-sign loop) bypasses the cache
    // lookup so a 50-post loop reuses one BunkerSigner instance instead of
    // re-entering getActiveSigner per iteration.
    let activeSigner: NostrSigner | null;
    if (options?.signer) {
      activeSigner = options.signer;
    } else {
      const getSignerPromise = signerManager.getActiveSigner();
      activeSigner = await withTimeout(
        getSignerPromise,
        GET_ACTIVE_SIGNER_TIMEOUT_MS,
        "Signer connection is taking too long. Please ensure your signer app (e.g. Primal) is open and try again."
      ).catch(async (err) => {
        if (clearCacheOnError && err instanceof RemoteSignerTimeoutError) {
          await resetSignerCacheBestEffort();
        }
        throw err;
      });
    }
    if (prefersRemoteSigner) {
      debugSignerTrace("Configured signer resolved", {
        hasSigner: Boolean(activeSigner),
        injected: Boolean(options?.signer),
      });
    }

    if (!activeSigner) return null;

    const signPromise = Promise.resolve(activeSigner.signEvent(nostrEvent));
    const signResult =
      activeSigner.type === "nip46"
        ? await withTimeout(
            signPromise,
            ACTIVE_SIGNER_SIGN_TIMEOUT_MS,
            "Remote signer did not respond. Open your signer app (e.g. Primal) and approve the request."
          )
        : await withTimeout(
            signPromise,
            ACTIVE_SIGNER_SIGN_TIMEOUT_MS,
            "Extension did not respond. Please approve the request in your browser extension or try again."
          );

    if (activeSigner.type === "nip46") {
      const activeConnection = getActiveConnection();
      if (activeConnection) {
        recordConnectionEvent(activeConnection.id, {
          type: "signed",
          kind: nostrEvent.kind,
        });
      }
    }

    return normalizeSignResult(signResult, nostrEvent);
  } catch (err) {
    await handleConfiguredSignerError(
      err,
      prefersRemoteSigner,
      clearCacheOnError
    );
    throw err;
  }
}

async function tryAttachWindowNostrFallback(
  nostrEvent: NostrEvent
): Promise<SignedEvent | null> {
  if (typeof window === "undefined" || !window.nostr) return null;
  const signResult = await window.nostr.signEvent(nostrEvent);
  return normalizeSignResult(signResult, nostrEvent);
}

interface NudgeController {
  startedAt: number;
  arm: () => void;
  clear: () => void;
}

function createNudgeController(): NudgeController {
  const startedAt = Date.now();
  let nudgeTimer: ReturnType<typeof setTimeout> | undefined;
  const arm = (): void => {
    nudgeTimer = setTimeout(() => {
      dispatchSignerNudge("nudge", startedAt);
    }, SIGNER_NUDGE_AFTER_MS);
  };
  const clear = (): void => {
    if (nudgeTimer) {
      clearTimeout(nudgeTimer);
      nudgeTimer = undefined;
    }
  };
  return { startedAt, arm, clear };
}

function ensureNip07ReadyOrThrow(): void {
  if (getNip07Readiness() !== "account_mismatch") return;
  const message =
    "Extension account does not match. Switch back to the correct account in your extension or re-login.";
  toast.error(message);
  throw new Nip07AccountMismatchError(message);
}

/**
 * Sign an event with the simplest possible reliability story:
 *   1. One sign attempt against the configured signer.
 *   2. If that signer is missing (no NIP-46 config and no NIP-07 extension),
 *      fall back to `window.nostr` if available.
 *
 * Mirrors Ditto's `NConnectSigner` + `signerWithNudge`: one attempt, one
 * outcome. The shared `SimplePool` heals its own sockets, `Nip46Signer`
 * refreshes its bunker subscription on every RPC, and the per-RPC timeout
 * inside `Nip46Signer` already bounds how long a single sign can hang. There
 * is nothing here for us to recover that the underlying transport can't, so
 * we don't try — every "auto-recovery" attempt we used to make just piled
 * another `sign_event` on top of the unresponsive bunker and made the
 * problem worse (relay rate-limits, duplicate event IDs, and a UI that
 * never settled). When this single attempt fails, the user gets one error
 * and one explicit "Reconnect signer" button.
 */
async function signEventWithRetryLogic(
  nostrEvent: NostrEvent,
  options?: SignEventOptions
): Promise<SignedEvent> {
  const signerManager = await import("~/features/auth/signer");
  const config =
    typeof signerManager.getActiveSignerConfig === "function"
      ? signerManager.getActiveSignerConfig()
      : null;

  if (config?.type === "nip07") {
    const expectedHex = getExpectedPubkeyHexForGuard();
    if (expectedHex) await checkNip07Readiness(expectedHex);
    ensureNip07ReadyOrThrow();
  }

  const nudge = createNudgeController();
  dispatchSignerNudge("start", nudge.startedAt);
  nudge.arm();

  try {
    try {
      const first = await trySignWithConfiguredSigner(nostrEvent, options);
      if (first) {
        dispatchSignerNudge("done", nudge.startedAt);
        return first;
      }
    } catch (error) {
      debugSignerTrace("Sign attempt failed", {
        error: error instanceof Error ? error.message : String(error),
      });
      dispatchSignerNudge("fail", nudge.startedAt);
      throw error;
    }

    // No configured signer returned a signature → try window.nostr fallback.
    const fallback = await tryAttachWindowNostrFallback(nostrEvent);
    if (fallback) {
      dispatchSignerNudge("done", nudge.startedAt);
      return fallback;
    }

    dispatchSignerNudge("fail", nudge.startedAt);
    throw new Error(
      "Nostr extension not found. Please install a Nostr extension or connect a remote signer."
    );
  } finally {
    nudge.clear();
  }
}

async function logErrorIfClient(error: unknown, action: string): Promise<void> {
  if (typeof window !== "undefined") {
    const { logClientError } = await import("~/lib/error-handler.client");
    logClientError(
      error instanceof Error ? error : new Error(String(error)),
      {
        component: "nostr-adapter",
        action,
      },
      "error"
    );
  }
}

/**
 * Canonical Nostr adapter for client-side operations
 */
export const nostrAdapter = {
  /**
   * Encode hex public key to npub (bech32)
   */
  encodeNpub(hex: string): string | null {
    try {
      return nip19.npubEncode(hex);
    } catch {
      return null;
    }
  },

  /**
   * Decode npub (bech32) to hex public key
   */
  decodeNpub(npub: string): string | null {
    try {
      if (!npub.startsWith("npub")) {
        return npub; // Already hex
      }
      const { data } = nip19.decode(npub);
      return typeof data === "string" ? data : null;
    } catch {
      return null;
    }
  },

  /**
   * Sign an event using NIP-07 (window.nostr)
   * This is the canonical way to sign events client-side.
   * @param options.clearCacheOnError - If false, do not clear the signer cache on error (use for bulk sign so one failure doesn't break other in-flight signs). Default true.
   */
  async signEvent(
    eventData: NostrEventData,
    options?: SignEventOptions
  ): Promise<SignEventResult> {
    try {
      const nostrEvent: NostrEvent = {
        content: eventData.content,
        created_at: eventData.created_at,
        kind: eventData.kind ?? 1,
        tags: eventData.tags ?? [],
      };

      const signedEvent = await signEventWithRetryLogic(nostrEvent, options);
      return { nostrEvent, signedEvent };
    } catch (error) {
      await logErrorIfClient(error, "signEvent");
      throw error;
    }
  },

  /**
   * Build a long-form event (NIP-23) from event data
   */
  buildLongFormEvent(eventData: LongFormEventData): NostrEvent {
    return buildLongFormEvent(eventData);
  },

  /**
   * Sign event with retry logic
   * @param options.clearCacheOnError - If false, do not clear the signer cache on error. Default true.
   */
  async signEventWithRetry(
    nostrEvent: NostrEvent,
    options?: SignEventOptions
  ): Promise<SignedEvent> {
    return signEventWithRetryLogic(nostrEvent, options);
  },

  /**
   * Sign once with clearCacheOnError: false; on failure wait 1.5s and retry once.
   * Use for single-sign flows so a timeout doesn't tear down the connection and transient failures get one retry.
   */
  async signEventWithOneRetry(
    eventData: NostrEventData,
    options?: SignEventOptions
  ): Promise<SignEventResult> {
    const opts = { clearCacheOnError: false, ...options };
    try {
      return await this.signEvent(eventData, opts);
    } catch {
      await new Promise((r) => setTimeout(r, 1500));
      return await this.signEvent(eventData, opts);
    }
  },

  /**
   * Sign a long-form event (NIP-23) using NIP-07
   * @param options.clearCacheOnError - If false, do not clear the signer cache on error. Default true.
   */
  async signLongFormEvent(
    eventData: LongFormEventData,
    options?: SignEventOptions
  ): Promise<SignEventResult> {
    try {
      const nostrEvent = this.buildLongFormEvent(eventData);
      const signedEvent = await this.signEventWithRetry(nostrEvent, options);
      return { nostrEvent, signedEvent };
    } catch (error) {
      await logErrorIfClient(error, "signLongFormEvent");
      throw error;
    }
  },

  /**
   * Sign long-form once with clearCacheOnError: false; on failure wait 1.5s and retry once.
   */
  async signLongFormEventWithOneRetry(
    eventData: LongFormEventData
  ): Promise<SignEventResult> {
    const opts = { clearCacheOnError: false };
    try {
      return await this.signLongFormEvent(eventData, opts);
    } catch {
      await new Promise((r) => setTimeout(r, 1500));
      return await this.signLongFormEvent(eventData, opts);
    }
  },

  /**
   * NIP-88 kind 1068 poll — builds tags via `buildPollTags`, then signs like a normal event.
   */
  async signPollEventWithOneRetry(
    input: SignPollEventInput,
    options?: SignEventOptions
  ): Promise<SignEventResult> {
    const hashtagTags: string[][] = (input.topicTagValues ?? [])
      .map((t) => t.trim())
      .filter((t) => t.length > 0)
      .map((t) => ["t", t.replace(/^#/u, "").toLowerCase()]);
    const tags = buildPollTags({
      optionLabels: input.optionLabels,
      pollType: input.pollType,
      relayUrls: input.relayUrls,
      endsAt: input.endsAt,
      extraTags: hashtagTags,
    });
    return this.signEventWithOneRetry(
      {
        content: input.question.trim(),
        created_at: input.created_at,
        kind: KIND_POLL,
        tags,
      },
      options
    );
  },
};

/**
 * Re-export types for convenience
 */
export type {
  NostrEvent,
  SignedEvent,
  SignEventResult,
} from "~/features/nostr/types";
