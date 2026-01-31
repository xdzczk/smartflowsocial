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
import { emitRemoteSignerTimeoutEvent } from "~/lib/remote-signer-reconnect.client";

import { getProgressiveTimeout } from "./nostr-timeout-utils.client";

// ============================================================================
// Helper Functions
// ============================================================================

const ACTIVE_SIGNER_CONNECT_TIMEOUT_MS = 15_000;
const ACTIVE_SIGNER_SIGN_TIMEOUT_MS = 30_000;

// Track retry counts for progressive timeouts
let connectionRetryCount = 0;
let signRetryCount = 0;

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

    const connectTimeout = prefersRemoteSigner
      ? getProgressiveTimeout(
          connectionRetryCount,
          ACTIVE_SIGNER_CONNECT_TIMEOUT_MS
        )
      : ACTIVE_SIGNER_CONNECT_TIMEOUT_MS;

    const activeSigner = prefersRemoteSigner
      ? await withTimeout(
          signerManager.getActiveSigner(),
          connectTimeout,
          "Connecting to remote signer took too long. Open your signer app and try again."
        )
      : await signerManager.getActiveSigner();

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

    // Reset retry counts on success
    resetNostrRetryCounts();

    return normalizeSignResult(signResult, nostrEvent);
  } catch (err) {
    if (prefersRemoteSigner) {
      // Check if this is a connection error that should trigger cache reset
      const errorMessage =
        err instanceof Error
          ? err.message.toLowerCase()
          : String(err).toLowerCase();
      const isConnectionError =
        errorMessage.includes("subscription closed") ||
        errorMessage.includes("websocket") ||
        errorMessage.includes("closed") ||
        errorMessage.includes("connection") ||
        err instanceof RemoteSignerTimeoutError;

      if (isConnectionError) {
        // Increment retry count for connection errors
        incrementConnectionRetryCount();
        // Clear cache and emit timeout event for connection errors
        await resetSignerCacheBestEffort();
        if (err instanceof RemoteSignerTimeoutError) {
          emitRemoteSignerTimeoutEvent({ message: err.message });
        } else {
          // For other connection errors, emit a generic timeout event
          emitRemoteSignerTimeoutEvent({
            message:
              "Connection to remote signer failed. Please try again or reconnect your signer.",
          });
        }
      } else {
        // Increment sign retry count for sign errors (prefersRemoteSigner is already true in this block)
        incrementSignRetryCount();
      }
      throw err;
    }
    return null;
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
  if (config?.type === "nip07") {
    const expectedHex = getExpectedPubkeyHexForGuard();
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

  while (retries < maxRetries) {
    const configured = await trySignWithConfiguredSigner(nostrEvent);
    if (configured) return configured;

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
