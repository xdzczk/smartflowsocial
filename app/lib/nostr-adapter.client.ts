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
      // Add retry logic to handle extension loading
      let retries = 0;
      const maxRetries = 5;

      while (retries < maxRetries) {
        // @ts-ignore - window.nostr is injected by browser extensions at runtime
        if (window.nostr) {
          const nostrEvent: NostrEvent = {
            content: eventData.content,
            created_at: eventData.created_at,
            kind: eventData.kind ?? 1,
            tags: eventData.tags ?? [],
          };

          // @ts-ignore - window.nostr is injected by browser extensions at runtime
          const signResult = await window.nostr.signEvent(nostrEvent);

          // Handle different return types from different extensions
          const signedEvent: SignedEvent = {
            id: signResult?.id ?? "unknown",
            pubkey: signResult?.pubkey ?? "unknown",
            created_at: nostrEvent.created_at,
            kind: nostrEvent.kind,
            tags: nostrEvent.tags,
            content: nostrEvent.content,
            sig:
              typeof signResult === "string"
                ? signResult
                : (signResult?.sig ?? "unknown"),
          };

          return { nostrEvent, signedEvent };
        }

        retries++;
        await new Promise((resolve) => setTimeout(resolve, 500));
      }

      throw new Error(
        "Nostr extension not found after retries. Please install a Nostr extension.",
      );
    } catch (error) {
      // Only log on client side
      if (typeof window !== "undefined") {
        // @ts-ignore - Dynamic imports work in client-side Remix bundles
        const { logClientError } = await import("~/lib/error-handler.client");
        logClientError(
          error instanceof Error ? error : new Error(String(error)),
          {
            component: "nostr-adapter",
            action: "signEvent",
          },
          "error",
        );
      }
      throw error;
    }
  },

  /**
   * Sign a long-form event (NIP-23) using NIP-07
   */
  async signLongFormEvent(eventData: LongFormEventData): Promise<SignEventResult> {
    try {
      // Add retry logic to handle extension loading
      let retries = 0;
      const maxRetries = 5;

      while (retries < maxRetries) {
        // @ts-ignore - window.nostr is injected by browser extensions at runtime
        if (window.nostr) {
          // Build NIP-23 tags
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

          const nostrEvent: NostrEvent = {
            content: eventData.content,
            created_at: Math.floor(Date.now() / 1000),
            kind: 30023, // NIP-23 long-form content
            tags: eventTags,
          };

          // @ts-ignore - window.nostr is injected by browser extensions at runtime
          const signResult = await window.nostr.signEvent(nostrEvent);

          // Handle different return types from different extensions
          const signedEvent: SignedEvent = {
            id: signResult?.id ?? "unknown",
            pubkey: signResult?.pubkey ?? "unknown",
            created_at: nostrEvent.created_at,
            kind: nostrEvent.kind,
            tags: nostrEvent.tags,
            content: nostrEvent.content,
            sig:
              typeof signResult === "string"
                ? signResult
                : (signResult?.sig ?? "unknown"),
          };

          return { nostrEvent, signedEvent };
        }

        retries++;
        await new Promise((resolve) => setTimeout(resolve, 500));
      }

      throw new Error(
        "Nostr extension not found after retries. Please install a Nostr extension.",
      );
    } catch (error) {
      // Only log on client side
      if (typeof window !== "undefined") {
        // @ts-ignore - Dynamic imports work in client-side Remix bundles
        const { logClientError } = await import("~/lib/error-handler.client");
        logClientError(
          error instanceof Error ? error : new Error(String(error)),
          {
            component: "nostr-adapter",
            action: "signLongFormEvent",
          },
          "error",
        );
      }
      throw error;
    }
  },
};

/**
 * Re-export types for convenience
 */
export type { NostrEvent, SignedEvent, SignEventResult } from "~/features/nostr/types";





