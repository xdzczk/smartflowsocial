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

import type {
  NostrEvent,
  SignedEvent,
  SignEventResult,
  NostrEventData,
  LongFormEventData,
} from "~/features/nostr/types";
import { RemoteSignerTimeoutError } from "~/lib/errors";

// ============================================================================
// Helper Functions
// ============================================================================

const ACTIVE_SIGNER_CONNECT_TIMEOUT_MS = 15_000;
const ACTIVE_SIGNER_SIGN_TIMEOUT_MS = 30_000;

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

async function signEventWithRetryLogic(
  nostrEvent: NostrEvent,
  maxRetries = 5
): Promise<SignedEvent> {
  let retries = 0;

  while (retries < maxRetries) {
    // Prefer an explicitly selected signer (e.g. NIP-46) if configured.
    let prefersRemoteSigner = false;
    try {
      // @ts-ignore - Dynamic imports work in client-side Remix bundles
      const signerManager = await import("~/lib/nostr-signer-manager.client");
      const cfg =
        typeof signerManager.getActiveSignerConfig === "function"
          ? signerManager.getActiveSignerConfig()
          : null;
      prefersRemoteSigner = !!cfg && cfg.type === "nip46";

      const activeSigner = prefersRemoteSigner
        ? await withTimeout(
            signerManager.getActiveSigner(),
            ACTIVE_SIGNER_CONNECT_TIMEOUT_MS,
            "Connecting to remote signer took too long. Open your signer app and try again."
          )
        : await signerManager.getActiveSigner();

      if (activeSigner) {
        const signPromise = Promise.resolve(activeSigner.signEvent(nostrEvent));
        const signResult =
          activeSigner.type === "nip46"
            ? await withTimeout(
                signPromise,
                ACTIVE_SIGNER_SIGN_TIMEOUT_MS,
                "Remote signer did not respond. Open your signer app (e.g. Primal) and approve the request."
              )
            : await signPromise;
        return normalizeSignResult(signResult, nostrEvent);
      }
    } catch (err) {
      // If a remote signer is configured, surface the error to the caller.
      // Otherwise, ignore and fall back to window.nostr retries.
      if (prefersRemoteSigner) {
        throw err;
      }
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
