/**
 * Nostr test helpers for creating valid SignedEvents
 *
 * These helpers use nostr-tools to create cryptographically valid SignedEvents
 * for use in tests. This ensures tests work with the new cryptographic validation.
 */

import { finalizeEvent, getPublicKey } from "nostr-tools";

import type { SignedEvent } from "~/features/nostr/types";

/**
 * Generate a test private key (deterministic for consistent testing)
 */
function generateTestPrivateKey(): Uint8Array {
  const key = new Uint8Array(32);
  for (let i = 0; i < 32; i++) {
    key[i] = i + 1;
  }
  return key;
}

const testPrivateKey = generateTestPrivateKey();
const testPublicKey = getPublicKey(testPrivateKey);

/**
 * Create a valid SignedEvent for testing
 * Uses nostr-tools to create a cryptographically valid event
 *
 * @param options - Event options
 * @returns A valid SignedEvent that will pass cryptographic validation
 */
export function createValidSignedEvent(
  options: {
    content?: string;
    kind?: number;
    tags?: string[][];
    created_at?: number;
  } = {}
): SignedEvent {
  const nostrEvent = {
    kind: options.kind ?? 1,
    created_at: options.created_at ?? Math.floor(Date.now() / 1000),
    tags: options.tags ?? [],
    content: options.content ?? "Test post content",
  };

  const signedEvent = finalizeEvent(nostrEvent, testPrivateKey);

  return signedEvent;
}

/**
 * Get the test public key (useful for assertions)
 */
export function getTestPublicKey(): string {
  return testPublicKey;
}
