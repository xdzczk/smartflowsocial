/**
 * Client helpers to build unsigned kind 6 (repost) and kind 1 (quote) events.
 * Used for "also schedule repost/quote" and "schedule repost/quote" flows.
 */

import { nip19 } from "nostr-tools";

import type { SignedEvent } from "~/features/nostr/types";
import { nostrAdapter } from "~/lib/nostr-adapter.client";

import {
  delayAfterMainToSeconds,
  isValidDelayAfterMain,
  type DelayAfterMain,
} from "./delay-after-main";

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

const LONGFORM_KIND = 30023;

/**
 * Build unsigned kind 1 quote event that references a longform article (kind 30023).
 * Uses NIP-23: "a" tag 30023:pubkey:identifier and nostr:naddr in content.
 * Caller signs with nostrAdapter.signEvent and submits to server.
 */
export function buildLongformQuoteEvent(
  signedLongformEvent: SignedEvent,
  caption: string,
  scheduledForUnix: number,
  tagArray: string[][] = []
): { content: string; created_at: number; kind: number; tags: string[][] } {
  const pubkey =
    typeof signedLongformEvent.pubkey === "string"
      ? signedLongformEvent.pubkey
      : String(signedLongformEvent.pubkey);
  const tags = Array.isArray(signedLongformEvent.tags)
    ? signedLongformEvent.tags
    : [];
  const dTagMatch = tags.find(
    (tag: unknown) => Array.isArray(tag) && tag[0] === "d"
  );
  const identifier =
    (Array.isArray(dTagMatch) && dTagMatch[1] ? String(dTagMatch[1]) : "") ||
    "";

  const naddr = nip19.naddrEncode({
    identifier,
    pubkey,
    kind: LONGFORM_KIND,
    relays: [DEFAULT_RELAY_URL],
  });

  const quoteContent = [caption, `nostr:${naddr}`].filter(Boolean).join("\n");

  const aTag: string[] = [
    "a",
    `${LONGFORM_KIND}:${pubkey}:${identifier}`,
    DEFAULT_RELAY_URL,
    "mention",
  ];
  const quoteTags = [...tagArray, aTag, ["p", pubkey, "", "mention"]];

  return {
    content: quoteContent,
    created_at: scheduledForUnix,
    kind: 1,
    tags: quoteTags,
  };
}

/**
 * Build and sign repost schedules for bulk: given main scheduled time and delay list,
 * returns array of { scheduledFor, signedEvent } for server.
 */
export async function buildAndSignRepostSchedules(
  mainScheduledUnix: number,
  delayList: Array<{ value: number; unit: DelayAfterMain["unit"] }>,
  mainSignedEvent: SignedEvent
): Promise<Array<{ scheduledFor: number; signedEvent: SignedEvent }>> {
  const out: Array<{ scheduledFor: number; signedEvent: SignedEvent }> = [];
  for (const delay of delayList) {
    const d: DelayAfterMain = { value: delay.value, unit: delay.unit };
    if (!isValidDelayAfterMain(d)) continue;
    const offsetSeconds = delayAfterMainToSeconds(d);
    const scheduledForUnix = mainScheduledUnix + offsetSeconds;
    if (scheduledForUnix <= mainScheduledUnix) continue;
    const repostEvent = buildKind6RepostEvent(
      mainSignedEvent,
      scheduledForUnix
    );
    const { signedEvent } = await nostrAdapter.signEvent(
      {
        content: repostEvent.content,
        created_at: repostEvent.created_at,
        kind: repostEvent.kind,
        tags: repostEvent.tags,
      },
      { clearCacheOnError: false }
    );
    out.push({ scheduledFor: scheduledForUnix, signedEvent: signedEvent });
  }
  return out;
}

/**
 * Build and sign quote schedules for bulk: given main scheduled time and entries,
 * returns array of { scheduledFor, signedEvent, caption } for server.
 */
export async function buildAndSignQuoteSchedules(
  mainScheduledUnix: number,
  entries: Array<{
    value: number;
    unit: DelayAfterMain["unit"];
    caption?: string;
  }>,
  mainSignedEvent: SignedEvent,
  tagArray: string[][] = []
): Promise<
  Array<{ scheduledFor: number; signedEvent: SignedEvent; caption?: string }>
> {
  const out: Array<{
    scheduledFor: number;
    signedEvent: SignedEvent;
    caption?: string;
  }> = [];
  for (const e of entries) {
    const d: DelayAfterMain = { value: e.value, unit: e.unit };
    if (!isValidDelayAfterMain(d)) continue;
    const offsetSeconds = delayAfterMainToSeconds(d);
    const scheduledForUnix = mainScheduledUnix + offsetSeconds;
    if (scheduledForUnix <= mainScheduledUnix) continue;
    const quoteEvent = buildQuoteEvent(
      mainSignedEvent,
      e.caption ?? "",
      scheduledForUnix,
      tagArray
    );
    const { signedEvent } = await nostrAdapter.signEvent(
      {
        content: quoteEvent.content,
        created_at: quoteEvent.created_at,
        kind: quoteEvent.kind,
        tags: quoteEvent.tags,
      },
      { clearCacheOnError: false }
    );
    out.push({
      scheduledFor: scheduledForUnix,
      signedEvent: signedEvent,
      caption: e.caption ?? undefined,
    });
  }
  return out;
}

/**
 * Tags for a thread reply (NIP-10): reply to immediate parent and root.
 * Use after signing the previous segment to get its id.
 */
export function getThreadReplyTags(
  previousEventId: string,
  rootEventId: string
): string[][] {
  return [
    ["e", previousEventId, DEFAULT_RELAY_URL, "reply"],
    ["e", rootEventId, DEFAULT_RELAY_URL, "root"],
  ];
}
