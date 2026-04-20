/**
 * Client helpers to build unsigned kind 6 (repost) and kind 1 (quote) events.
 * Used for "also schedule repost/quote" and "schedule repost/quote" flows.
 */

import { nip19 } from "nostr-tools";

import { signBatchWithRecovery } from "~/features/auth/signing/sign-batch-with-recovery.client";
import {
  signingAttempts,
  type SigningAttempt,
} from "~/features/auth/signing/signing-attempts.client";
import { durableIntent } from "~/features/auth/signing/use-recoverable-sign.client";
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

interface PreparedRepost {
  scheduledForUnix: number;
  unsigned: ReturnType<typeof buildKind6RepostEvent>;
}

function prepareRepostBatch(
  mainScheduledUnix: number,
  delayList: Array<{ value: number; unit: DelayAfterMain["unit"] }>,
  mainSignedEvent: SignedEvent
): PreparedRepost[] {
  const out: PreparedRepost[] = [];
  for (const delay of delayList) {
    const d: DelayAfterMain = { value: delay.value, unit: delay.unit };
    if (!isValidDelayAfterMain(d)) continue;
    const offsetSeconds = delayAfterMainToSeconds(d);
    const scheduledForUnix = mainScheduledUnix + offsetSeconds;
    if (scheduledForUnix <= mainScheduledUnix) continue;
    out.push({
      scheduledForUnix,
      unsigned: buildKind6RepostEvent(mainSignedEvent, scheduledForUnix),
    });
  }
  return out;
}

/**
 * Build and sign repost schedules for bulk: given main scheduled time and delay list,
 * returns array of { scheduledFor, signedEvent } for server.
 *
 * Uses the shared signing-attempts batch helper so a stalled signer
 * mid-batch parks the foreground recovery banner (instead of silently
 * dropping the remaining schedules). On resume the loop picks up only
 * the still-unsigned indices.
 */
export async function buildAndSignRepostSchedules(
  mainScheduledUnix: number,
  delayList: Array<{ value: number; unit: DelayAfterMain["unit"] }>,
  mainSignedEvent: SignedEvent
): Promise<Array<{ scheduledFor: number; signedEvent: SignedEvent }>> {
  const prepared = prepareRepostBatch(
    mainScheduledUnix,
    delayList,
    mainSignedEvent
  );
  if (prepared.length === 0) return [];
  const eventId =
    typeof mainSignedEvent.id === "string"
      ? mainSignedEvent.id
      : String(mainSignedEvent.id);
  const idempotencyKey = `repost-schedules:${eventId}:${mainScheduledUnix}:${signingAttempts.createSubmissionId()}`;
  const result = await signBatchWithRecovery<
    PreparedRepost,
    { scheduledFor: number; signedEvent: SignedEvent }
  >({
    items: prepared,
    intent: durableIntent(
      "schedule_repost_quote",
      idempotencyKey,
      "Schedule reposts"
    ),
    surface: "bulkposts:repost-schedules",
    signItem: async (entry, _index, signer) => {
      const { signedEvent } = await nostrAdapter.signEvent(
        {
          content: entry.unsigned.content,
          created_at: entry.unsigned.created_at,
          kind: entry.unsigned.kind,
          tags: entry.unsigned.tags,
        },
        { clearCacheOnError: false, signer: signer ?? undefined }
      );
      return {
        scheduledFor: entry.scheduledForUnix,
        signedEvent,
      };
    },
  });
  finalizeBatchAttempt(result);
  return result.signed.map((entry) => entry.signed);
}

interface PreparedQuote {
  scheduledForUnix: number;
  caption?: string;
  unsigned: ReturnType<typeof buildQuoteEvent>;
}

function prepareQuoteBatch(
  mainScheduledUnix: number,
  entries: Array<{
    value: number;
    unit: DelayAfterMain["unit"];
    caption?: string;
  }>,
  mainSignedEvent: SignedEvent,
  tagArray: string[][]
): PreparedQuote[] {
  const out: PreparedQuote[] = [];
  for (const e of entries) {
    const d: DelayAfterMain = { value: e.value, unit: e.unit };
    if (!isValidDelayAfterMain(d)) continue;
    const offsetSeconds = delayAfterMainToSeconds(d);
    const scheduledForUnix = mainScheduledUnix + offsetSeconds;
    if (scheduledForUnix <= mainScheduledUnix) continue;
    out.push({
      scheduledForUnix,
      caption: e.caption ?? undefined,
      unsigned: buildQuoteEvent(
        mainSignedEvent,
        e.caption ?? "",
        scheduledForUnix,
        tagArray
      ),
    });
  }
  return out;
}

/**
 * Build and sign quote schedules for bulk: given main scheduled time and entries,
 * returns array of { scheduledFor, signedEvent, caption } for server.
 *
 * Driven through the shared signing-attempts batch helper for the same
 * park/resume semantics as {@link buildAndSignRepostSchedules}.
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
  const prepared = prepareQuoteBatch(
    mainScheduledUnix,
    entries,
    mainSignedEvent,
    tagArray
  );
  if (prepared.length === 0) return [];
  const eventId =
    typeof mainSignedEvent.id === "string"
      ? mainSignedEvent.id
      : String(mainSignedEvent.id);
  const idempotencyKey = `quote-schedules:${eventId}:${mainScheduledUnix}:${signingAttempts.createSubmissionId()}`;
  const result = await signBatchWithRecovery<
    PreparedQuote,
    { scheduledFor: number; signedEvent: SignedEvent; caption?: string }
  >({
    items: prepared,
    intent: durableIntent(
      "schedule_repost_quote",
      idempotencyKey,
      "Schedule quotes"
    ),
    surface: "bulkposts:quote-schedules",
    signItem: async (entry, _index, signer) => {
      const { signedEvent } = await nostrAdapter.signEvent(
        {
          content: entry.unsigned.content,
          created_at: entry.unsigned.created_at,
          kind: entry.unsigned.kind,
          tags: entry.unsigned.tags,
        },
        { clearCacheOnError: false, signer: signer ?? undefined }
      );
      return {
        scheduledFor: entry.scheduledForUnix,
        signedEvent,
        caption: entry.caption,
      };
    },
  });
  finalizeBatchAttempt(result);
  return result.signed.map((entry) => entry.signed);
}

/**
 * Settle the foreground attempt left in `submitting` by the batch
 * helper. These inner-bulk loops have no separate submit phase — the
 * caller embeds the signed entries in the outer bulk fetcher submit —
 * so we mark the attempt completed (or failed for partial outcomes) so
 * the recovery banner clears once all signatures are in hand.
 */
function finalizeBatchAttempt<T>(result: {
  ok: boolean;
  attemptId: string;
  reason?: string;
  lastError?: string | null;
  signed: T[];
}): void {
  const inStore = signingAttempts
    .getAllAttempts()
    .find((a: SigningAttempt) => a.attemptId === result.attemptId);
  if (!inStore) return;
  if (result.ok) {
    signingAttempts.markCompleted(result.attemptId);
    return;
  }
  if (
    inStore.state === "submitting" ||
    inStore.state === "signing" ||
    inStore.state === "resuming"
  ) {
    signingAttempts.markFailed(
      result.attemptId,
      result.lastError ?? `bulk_${result.reason ?? "fail"}`
    );
  }
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
