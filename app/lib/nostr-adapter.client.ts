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

import type {
  NostrEvent,
  SignedEvent,
  SignEventResult,
  NostrEventData,
  LongFormEventData,
} from "~/features/nostr/types";
import {
  Nip07AccountMismatchError,
  RemoteSignerTimeoutError,
} from "~/lib/errors";
import {
  checkNip07Readiness,
  getExpectedPubkeyHexForGuard,
  getNip07Readiness,
} from "~/lib/nip07-readiness.client";
import { attemptPrimarySignerFailover } from "~/lib/primary-signer-failover.client";
import { emitRemoteSignerTimeoutEvent } from "~/lib/remote-signer-reconnect.client";
import {
  addConnectionLog,
  getActiveConnection,
  updateSession,
} from "~/lib/remote-signer-sessions.client";

import { getProgressiveTimeout } from "./nostr-timeout-utils.client";

// ============================================================================
// Helper Functions
// ============================================================================

const ACTIVE_SIGNER_SIGN_TIMEOUT_MS = 30_000;
/** Max time to wait for signer resolution (getActiveSigner). Prevents hanging on "Attempt 1" when connection is slow after reopen. */
const GET_ACTIVE_SIGNER_TIMEOUT_MS = 40_000;

// Track retry counts for progressive timeouts
let connectionRetryCount = 0;
let signRetryCount = 0;

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
function shouldClearSignerCacheOnError(error: unknown): boolean {
  if (error instanceof RemoteSignerTimeoutError) {
    const msg = error.message.toLowerCase();
    if (
      msg.includes("did not respond") ||
      msg.includes("approve the request")
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

/**
 * Reset retry counts (call after successful operation)
 */
export function resetNostrRetryCounts(): void {
  connectionRetryCount = 0;
  signRetryCount = 0;
}

/**
 * Increment and get connection retry count
 */
export function getConnectionRetryCount(): number {
  return connectionRetryCount;
}

/**
 * Increment connection retry count
 */
export function incrementConnectionRetryCount(): void {
  connectionRetryCount++;
}

/**
 * Increment and get sign retry count
 */
export function getSignRetryCount(): number {
  return signRetryCount;
}

/**
 * Increment sign retry count
 */
export function incrementSignRetryCount(): void {
  signRetryCount++;
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

function buildLongFormEventTags(eventData: LongFormEventData): string[][] {
  const eventTags: string[][] = [];

  if (eventData.title) {
    eventTags.push(["title", eventData.title]);
  }
  eventTags.push(["r", "wss://relay.primal.net/"]);
  eventTags.push(["client", "SmartFlow"]);
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
    // @ts-ignore - Dynamic imports work in client-side Remix bundles
    const signerManager = await import("~/lib/nostr-signer-manager.client");
    if (typeof signerManager.resetCachedSigner === "function") {
      signerManager.resetCachedSigner();
    }
  } catch {
    // ignore
  }
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

  addConnectionLog(activeConnection.id, {
    type: "health_check",
    status: "failure",
    message: `Health check failed: ${errorMessage}`,
    details: { error: errorMessage },
  });
}

async function handleConfiguredSignerError(
  err: unknown,
  prefersRemoteSigner: boolean
): Promise<void> {
  if (!prefersRemoteSigner) {
    incrementSignRetryCount();
    return;
  }
  const isConnectionError = isConnectionLikeError(err);
  if (isConnectionError) {
    const isSignTimeout =
      err instanceof RemoteSignerTimeoutError &&
      (err.message.toLowerCase().includes("did not respond") ||
        err.message.toLowerCase().includes("approve the request"));
    if (isSignTimeout) {
      incrementSignRetryCount();
    } else {
      incrementConnectionRetryCount();
    }
    const clearCache = shouldClearSignerCacheOnError(err);
    debugSignerTrace("Configured signer connection-like error", {
      error: err instanceof Error ? err.message : String(err),
      connectionRetryCount,
      signRetryCount,
      clearCache,
    });
    markActiveRemoteConnectionStale(err);
    if (clearCache) {
      await resetSignerCacheBestEffort();
    }
    if (err instanceof RemoteSignerTimeoutError) {
      emitRemoteSignerTimeoutEvent({ message: err.message });
    } else {
      emitRemoteSignerTimeoutEvent({
        message:
          "Connection to remote signer failed. Please try again or reconnect your signer.",
      });
    }
  } else {
    incrementSignRetryCount();
  }
}

async function trySignWithConfiguredSigner(
  nostrEvent: NostrEvent
): Promise<SignedEvent | null> {
  let prefersRemoteSigner = false;
  try {
    // @ts-ignore - Dynamic imports work in client-side Remix bundles
    const signerManager = await import("~/lib/nostr-signer-manager.client");
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
      if (err instanceof RemoteSignerTimeoutError) {
        await resetSignerCacheBestEffort();
      }
      throw err;
    });
    if (prefersRemoteSigner) {
      debugSignerTrace("Configured signer resolved", {
        hasSigner: Boolean(activeSigner),
        connectionRetryCount,
        signRetryCount,
      });
    }

    if (!activeSigner) return null;

    const signPromise = Promise.resolve(activeSigner.signEvent(nostrEvent));
    const signTimeout =
      activeSigner.type === "nip46"
        ? getProgressiveTimeout(signRetryCount, ACTIVE_SIGNER_SIGN_TIMEOUT_MS)
        : ACTIVE_SIGNER_SIGN_TIMEOUT_MS;

    const signResult =
      activeSigner.type === "nip46"
        ? await withTimeout(
            signPromise,
            signTimeout,
            "Remote signer did not respond. Open your signer app (e.g. Primal) and approve the request."
          )
        : await signPromise;

    resetNostrRetryCounts();
    if (
      activeSigner.type === "nip46" &&
      typeof signerManager.recordSuccessfulSign === "function"
    ) {
      signerManager.recordSuccessfulSign();
    }

    return normalizeSignResult(signResult, nostrEvent);
  } catch (err) {
    await handleConfiguredSignerError(err, prefersRemoteSigner);
    throw err;
  }
}

async function signEventWithRetryLogic(
  nostrEvent: NostrEvent,
  maxRetries = 5
): Promise<SignedEvent> {
  const signerManager = await import("~/lib/nostr-signer-manager.client");
  const config =
    typeof signerManager.getActiveSignerConfig === "function"
      ? signerManager.getActiveSignerConfig()
      : null;
  const expectedHex = getExpectedPubkeyHexForGuard();
  if (config?.type === "nip07") {
    if (expectedHex) {
      await checkNip07Readiness(expectedHex);
    }
    if (getNip07Readiness() === "account_mismatch") {
      const message =
        "Extension account does not match. Switch back to the correct account in your extension or re-login.";
      toast.error(message);
      throw new Nip07AccountMismatchError(message);
    }
  }

  let retries = 0;
  let triedPrimaryFailover = false;
  const tryPrimaryFailover = async (): Promise<boolean> => {
    if (triedPrimaryFailover) return false;
    const recovered = await attemptPrimarySignerFailover({
      expectedPubkey: expectedHex,
      labelFallback: "Primary Home Signer",
    });
    triedPrimaryFailover = true;
    if (recovered.recovered) {
      toast.success("Recovered signer connection via primary home signer.");
      return true;
    }
    return false;
  };

  while (retries < maxRetries) {
    const attemptNum = retries + 1;
    if (typeof window !== "undefined") {
      const signPhaseTimeoutMs = getProgressiveTimeout(
        signRetryCount,
        ACTIVE_SIGNER_SIGN_TIMEOUT_MS
      );
      const totalAttemptTimeoutMs =
        GET_ACTIVE_SIGNER_TIMEOUT_MS + signPhaseTimeoutMs;
      window.dispatchEvent(
        new CustomEvent("nostr-sign-attempt", {
          detail: {
            attempt: attemptNum,
            maxAttempts: maxRetries,
            startedAt: Date.now(),
            timeoutMs: totalAttemptTimeoutMs,
          },
        })
      );
    }
    debugSignerTrace("Retry loop iteration", {
      retries,
      maxRetries,
      triedPrimaryFailover,
      signerType: config?.type ?? "none",
    });
    let configured: SignedEvent | null = null;
    try {
      configured = await trySignWithConfiguredSigner(nostrEvent);
    } catch (error) {
      const isConnectionError = isConnectionLikeError(error);
      debugSignerTrace("Configured signer attempt failed", {
        error: error instanceof Error ? error.message : String(error),
        isConnectionError,
        retries,
      });
      if (isConnectionError && (await tryPrimaryFailover())) {
        debugSignerTrace("Recovered via primary failover in retry loop");
        continue;
      }
      if (isConnectionError && retries < maxRetries - 1) {
        // Allow transient remote-signer reconnect hiccups to recover in-loop.
        retries++;
        debugSignerTrace("Retrying configured signer after short delay", {
          nextRetry: retries,
        });
        await new Promise((resolve) => setTimeout(resolve, 600));
        continue;
      }
      throw error;
    }
    if (configured) return configured;

    if (await tryPrimaryFailover()) {
      continue;
    }

    // @ts-ignore - window.nostr is injected by browser extensions at runtime
    if (typeof window !== "undefined" && window.nostr) {
      // @ts-ignore - window.nostr is injected by browser extensions at runtime
      const signResult = await window.nostr.signEvent(nostrEvent);
      return normalizeSignResult(signResult, nostrEvent);
    }

    retries++;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error(
    "Nostr extension not found after retries. Please install a Nostr extension."
  );
}

async function logErrorIfClient(error: unknown, action: string): Promise<void> {
  if (typeof window !== "undefined") {
    // @ts-ignore - Dynamic imports work in client-side Remix bundles
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
   * This is the canonical way to sign events client-side
   */
  async signEvent(eventData: NostrEventData): Promise<SignEventResult> {
    try {
      const nostrEvent: NostrEvent = {
        content: eventData.content,
        created_at: eventData.created_at,
        kind: eventData.kind ?? 1,
        tags: eventData.tags ?? [],
      };

      const signedEvent = await signEventWithRetryLogic(nostrEvent);
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
   */
  async signEventWithRetry(nostrEvent: NostrEvent): Promise<SignedEvent> {
    return signEventWithRetryLogic(nostrEvent);
  },

  /**
   * Sign a long-form event (NIP-23) using NIP-07
   */
  async signLongFormEvent(
    eventData: LongFormEventData
  ): Promise<SignEventResult> {
    try {
      const nostrEvent = this.buildLongFormEvent(eventData);
      const signedEvent = await this.signEventWithRetry(nostrEvent);
      return { nostrEvent, signedEvent };
    } catch (error) {
      await logErrorIfClient(error, "signLongFormEvent");
      throw error;
    }
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
