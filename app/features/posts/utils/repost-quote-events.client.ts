/**
 * Client helpers to build unsigned kind 6 (repost) and kind 1 (quote) events.
 * Used for "also schedule repost/quote" and "schedule repost/quote" flows.
 */

import { nip19 } from "nostr-tools";

import type { SignedEvent } from "~/features/nostr/types";

const DEFAULT_RELAY_URL = "wss://relay.primal.net";

/**
 * Build unsigned kind 6 repost event (NIP-18).
 * Caller signs with nostrAdapter.signEvent and submits to server.
 */
export function buildKind6RepostEvent(
  originalSignedEvent: SignedEvent,
  scheduledForUnix: number
): { content: string; created_at: number; kind: number; tags: string[][] } {
  const eventId =
    typeof originalSignedEvent.id === "string"
      ? originalSignedEvent.id
      : String(originalSignedEvent.id);
  const pubkey =
    typeof originalSignedEvent.pubkey === "string"
      ? originalSignedEvent.pubkey
      : String(originalSignedEvent.pubkey);

  return {
    content: "",
    created_at: scheduledForUnix,
    kind: 6,
    tags: [
      ["e", eventId, DEFAULT_RELAY_URL],
      ["p", pubkey],
    ],
  };
}

/**
 * Build unsigned kind 1 quote event with e/p tags and optional nostr:nevent in content.
 * Caller signs with nostrAdapter.signEvent and submits to server.
 */
export function buildQuoteEvent(
  originalSignedEvent: SignedEvent,
  caption: string,
  scheduledForUnix: number,
  tagArray: string[][] = []
): { content: string; created_at: number; kind: number; tags: string[][] } {
  const eventId =
    typeof originalSignedEvent.id === "string"
      ? originalSignedEvent.id
      : String(originalSignedEvent.id);
  const pubkey =
    typeof originalSignedEvent.pubkey === "string"
      ? originalSignedEvent.pubkey
      : String(originalSignedEvent.pubkey);

  const neventEncoded = nip19.neventEncode({
    id: eventId,
    relays: [DEFAULT_RELAY_URL],
    author: pubkey,
  });

  const quoteContent = [caption, `nostr:${neventEncoded}`]
    .filter(Boolean)
    .join("\n");

  const quoteTags = [
    ...tagArray,
    ["e", eventId, DEFAULT_RELAY_URL, "mention"],
    ["p", pubkey, "", "mention"],
  ];

  return {
    content: quoteContent,
    created_at: scheduledForUnix,
    kind: 1,
    tags: quoteTags,
  };
}
