/**
 * Nostr Event Signing Utilities for Cypress Tests
 *
 * Provides real cryptographic signing using nostr-tools without
 * requiring browser extensions or wallet flows.
 */

import {
    finalizeEvent,
    nip19,
} from "nostr-tools";
import type { EventTemplate } from "nostr-tools";

import { TEST_NSEC, TEST_PUBKEY_HEX } from "./nostr-test-keys";

/**
 * Interface for signed event result
 */
export interface SignedEvent {
    id: string;
    pubkey: string;
    created_at: number;
    kind: number;
    tags: string[][];
    content: string;
    sig: string;
}

/**
 * Decode the nsec to get the secret key bytes
 */
function decodeNsec(nsec: string): Uint8Array {
    const decoded = nip19.decode(nsec);
    if (decoded.type !== "nsec") {
        throw new Error("Invalid nsec format");
    }
    return decoded.data;
}

/**
 * Get test secret key as Uint8Array
 */
export function getTestSecretKey(): Uint8Array {
    return decodeNsec(TEST_NSEC);
}

/**
 * Get test public key as hex string
 */
export function getTestPublicKeyHex(): string {
    return TEST_PUBKEY_HEX;
}

/**
 * Sign a NOSTR event using the test private key
 */
export function signEvent(eventData: {
    content: string;
    created_at?: number;
    kind?: number;
    tags?: string[][];
}): SignedEvent {
    const secretKey = getTestSecretKey();

    const eventTemplate: EventTemplate = {
        kind: eventData.kind ?? 1,
        created_at: eventData.created_at ?? Math.floor(Date.now() / 1000),
        tags: eventData.tags ?? [],
        content: eventData.content,
    };

    // finalizeEvent adds id, pubkey, and sig
    const signedEvent = finalizeEvent(eventTemplate, secretKey);

    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- Necessary cast for test types
    return signedEvent as unknown as SignedEvent;
}

/**
 * Create and sign a test kind 1 note (regular post)
 */
export function createTestNote(
    content: string,
    tags: string[][] = [],
): SignedEvent {
    return signEvent({
        content,
        kind: 1,
        tags,
    });
}

/**
 * Create and sign a test kind 0 profile event
 */
export function createTestProfileEvent(profile: {
    name?: string;
    display_name?: string;
    about?: string;
    picture?: string;
}): SignedEvent {
    return signEvent({
        content: JSON.stringify(profile),
        kind: 0,
        tags: [],
    });
}
