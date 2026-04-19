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

import {
  addConnectionLog,
  attemptPrimarySignerFailover,
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

function isConnectionLikeError(error: unknown): boolean {
  if (error instanceof RemoteSignerTimeoutError) {
    return true;
  }
  const message =
    error instanceof Error
      ? error.message.toLowerCase()
      : String(error).toLowerCase();
  return (
    message.includes("subscription closed") ||
    message.includes("websocket") ||
    message.includes("closed") ||
    message.includes("connection") ||
    message.includes("connecting") ||
    message.includes("timeout") ||
    message.includes("too long")
  );
}

/**
 * True if we should clear the NIP-46 signer cache.
 * - Connection errors (subscription closed, etc.): clear so we reconnect.
 * - Sign timeout ("did not respond" / "approve the request"): always clear so the next attempt
 *   creates a fresh connection. This fixes the case where both app and Primal were closed,
 *   user reopens Primal and "resumes" the connection, but our cached signer's channel is dead
 *   so sign_event never completes; clearing forces a new connection that can work with resumed Primal.
 */
const SIGN_TIMEOUT_KEY_DID_NOT_RESPOND = "did not respond";
const SIGN_TIMEOUT_KEY_APPROVE_REQUEST = "approve the request";

function shouldClearSignerCacheOnError(error: unknown): boolean {
  if (error instanceof RemoteSignerTimeoutError) {
    const msg = error.message.toLowerCase();
    if (
      msg.includes(SIGN_TIMEOUT_KEY_DID_NOT_RESPOND) ||
      msg.includes(SIGN_TIMEOUT_KEY_APPROVE_REQUEST)
    ) {
      return true;
    }
  }
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
  if (!isConnectionLikeError(err)) return;

  const shouldClear = clearCacheOnError && shouldClearSignerCacheOnError(err);
  debugSignerTrace("Configured signer connection-like error", {
    error: err instanceof Error ? err.message : String(err),
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

/** When false, do not clear the signer cache on error (e.g. during bulk sign so one failure doesn't break other in-flight signs). */
export interface SignEventOptions {
  clearCacheOnError?: boolean;
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

    const getSignerPromise = signerManager.getActiveSigner();
    const activeSigner = await withTimeout(
      getSignerPromise,
      GET_ACTIVE_SIGNER_TIMEOUT_MS,
      "Signer connection is taking too long. Please ensure your signer app (e.g. Primal) is open and try again."
    ).catch(async (err) => {
      if (clearCacheOnError && err instanceof RemoteSignerTimeoutError) {
        await resetSignerCacheBestEffort();
      }
      throw err;
    });
    if (prefersRemoteSigner) {
      debugSignerTrace("Configured signer resolved", {
        hasSigner: Boolean(activeSigner),
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

async function tryReconnectInBackground(): Promise<boolean> {
  try {
    const { tryBackgroundReconnect } = await import("~/features/auth/signer");
    const reconnected = await tryBackgroundReconnect();
    debugSignerTrace("Reconnect-and-retry result", { reconnected });
    return reconnected;
  } catch {
    return false;
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
 * After both the initial sign attempt and the reconnect-and-retry attempt have
 * failed against a NIP-46 signer, try to swap in the user's "primary home"
 * signer and sign one more time. Returns the signed event on success, or
 * throws to surface either the failover error or the original retry error.
 */
async function tryPrimarySignerFailoverSign(
  nostrEvent: NostrEvent,
  options: SignEventOptions | undefined,
  retryError: unknown,
  expectedHex: string | null,
  nudge: NudgeController
): Promise<SignedEvent> {
  const failover = await attemptPrimarySignerFailover({
    expectedPubkey: expectedHex,
    labelFallback: "Primary Home Signer",
  });
  if (failover.recovered) {
    toast.success("Recovered signer connection via primary home signer.");
    try {
      const third = await trySignWithConfiguredSigner(nostrEvent, options);
      if (third) {
        dispatchSignerNudge("done", nudge.startedAt);
        return third;
      }
    } catch (failoverError) {
      dispatchSignerNudge("fail", nudge.startedAt);
      throw failoverError;
    }
  }
  dispatchSignerNudge("fail", nudge.startedAt);
  throw retryError;
}

/**
 * Reconnect-once-and-retry path used only for NIP-46 signers when the initial
 * sign attempt failed with a connection-like error. Returns the signed event
 * on success, `null` to indicate the caller should fall through to the
 * window.nostr fallback path, or throws the (post-failover) error.
 */
async function reconnectAndRetrySign(
  nostrEvent: NostrEvent,
  options: SignEventOptions | undefined,
  expectedHex: string | null,
  nudge: NudgeController
): Promise<SignedEvent | null> {
  nudge.clear();
  dispatchSignerNudge("reconnect", nudge.startedAt);
  await tryReconnectInBackground();
  nudge.arm();
  try {
    const second = await trySignWithConfiguredSigner(nostrEvent, options);
    if (second) {
      dispatchSignerNudge("done", nudge.startedAt);
      return second;
    }
    return null;
  } catch (retryError) {
    debugSignerTrace("Reconnect-and-retry sign attempt failed", {
      error:
        retryError instanceof Error ? retryError.message : String(retryError),
    });
    return await tryPrimarySignerFailoverSign(
      nostrEvent,
      options,
      retryError,
      expectedHex,
      nudge
    );
  }
}

/**
 * Sign an event with the simplest possible reliability story:
 *   1. One sign attempt against the configured signer.
 *   2. On a connection-like failure, reconnect once and retry exactly once.
 *   3. If that still fails on a NIP-46 signer, try primary signer failover and
 *      sign one more time.
 *   4. Otherwise fall back to window.nostr if available.
 *
 * The shared SimplePool already heals its own sockets and Nip46Signer's RPCs
 * are bounded, so we do not need a long retry ladder or progressive timeouts.
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
  const expectedHex = getExpectedPubkeyHexForGuard();

  if (config?.type === "nip07") {
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
      const isConnectionError = isConnectionLikeError(error);
      debugSignerTrace("First sign attempt failed", {
        error: error instanceof Error ? error.message : String(error),
        isConnectionError,
      });

      if (config?.type !== "nip46" || !isConnectionError) {
        dispatchSignerNudge("fail", nudge.startedAt);
        throw error;
      }

      const retried = await reconnectAndRetrySign(
        nostrEvent,
        options,
        expectedHex,
        nudge
      );
      if (retried) return retried;
      // null retried → fall through to window.nostr fallback below
    }

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
