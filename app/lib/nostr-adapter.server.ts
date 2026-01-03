/**
 * Canonical Nostr Adapter
 *
 * This module provides a unified interface for all Nostr operations.
 * It wraps nostr-tools and other Nostr libraries to provide a consistent API
 * and reduce bundle size by consolidating imports.
 *
 * Usage:
 *   import { nostrAdapter } from "~/lib/nostr-adapter.server";
 *   const npub = nostrAdapter.encodeNpub(hexKey);
 */

import { nip19, finalizeEvent, getPublicKey, validateEvent } from "nostr-tools";

import type {
  NostrEvent,
  SignedEvent,
  NostrEventData,
  LongFormEventData,
} from "~/features/nostr/types";

/**
 * Canonical Nostr adapter for server-side operations
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
   * Encode hex private key to nsec (bech32)
   */
  encodeNsec(hex: string): string | null {
    try {
      // Convert hex string to Uint8Array
      const privateKeyBytes = new Uint8Array(
        hex.match(/.{1,2}/g)?.map((byte) => parseInt(byte, 16)) ?? [],
      );
      return nip19.nsecEncode(privateKeyBytes);
    } catch {
      return null;
    }
  },

  /**
   * Decode nsec (bech32) to hex private key
   */
  decodeNsec(nsec: string): string | null {
    try {
      if (!nsec.startsWith("nsec")) {
        return nsec; // Already hex
      }
      const { data } = nip19.decode(nsec);
      return typeof data === "string" ? data : null;
    } catch {
      return null;
    }
  },

  /**
   * Get public key from private key (hex string or nsec)
   */
  getPublicKey(privateKey: string): string {
    // Convert to Uint8Array if needed
    let privateKeyBytes: Uint8Array;
    if (privateKey.startsWith("nsec")) {
      const decoded = nip19.decode(privateKey);
      if (decoded.type === "nsec") {
        privateKeyBytes = decoded.data;
      } else {
        throw new Error("Invalid nsec format");
      }
    } else {
      // Assume hex string
      privateKeyBytes = new Uint8Array(
        privateKey.match(/.{1,2}/g)?.map((byte) => parseInt(byte, 16)) ?? [],
      );
    }
    return getPublicKey(privateKeyBytes);
  },

  /**
   * Finalize and sign an event with a private key (hex string or nsec)
   */
  finalizeEvent(event: NostrEvent, privateKey: string): SignedEvent {
    // Convert to Uint8Array if needed
    let privateKeyBytes: Uint8Array;
    if (privateKey.startsWith("nsec")) {
      const decoded = nip19.decode(privateKey);
      if (decoded.type === "nsec") {
        privateKeyBytes = decoded.data;
      } else {
        throw new Error("Invalid nsec format");
      }
    } else {
      // Assume hex string
      privateKeyBytes = new Uint8Array(
        privateKey.match(/.{1,2}/g)?.map((byte) => parseInt(byte, 16)) ?? [],
      );
    }
    return finalizeEvent(event, privateKeyBytes);
  },

  /**
   * Validate a Nostr event structure
   */
  validateEvent(event: unknown): event is NostrEvent {
    return validateEvent(event);
  },

  /**
   * Create a basic Nostr event from event data
   */
  createEvent(eventData: NostrEventData): NostrEvent {
    return {
      content: eventData.content,
      created_at: eventData.created_at,
      kind: eventData.kind ?? 1,
      tags: eventData.tags ?? [],
    };
  },

  /**
   * Create a long-form event (NIP-23) from event data
   */
  createLongFormEvent(eventData: LongFormEventData): NostrEvent {
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

    return {
      content: eventData.content,
      created_at: Math.floor(Date.now() / 1000),
      kind: 30023, // NIP-23 long-form content
      tags: eventTags,
    };
  },
};

/**
 * Re-export types for convenience
 */
export type { NostrEvent, SignedEvent, SignEventResult } from "~/features/nostr/types";

