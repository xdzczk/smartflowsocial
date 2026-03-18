/**
 * Composer submit helpers: effective hashtags, repost/quote schedule building, time parsing.
 */

import type { SignedEvent } from "~/features/nostr/types";
import type { QueueType } from "~/features/posts/types";
import {
  delayAfterMainToSeconds,
  isValidDelayAfterMain,
  type DelayAfterMain,
} from "~/features/posts/utils/delay-after-main";
import {
  buildKind6RepostEvent,
  buildQuoteEvent,
} from "~/features/posts/utils/repost-quote-events.client";
import { nostrAdapter } from "~/lib/nostr-adapter.client";
import { parseDateTimeLocal, toUnixTimestamp } from "~/lib/temporal";

export const ACTION_POST_TEXT = "post-text";
export const ACTION_SCHEDULE_TEXT = "schedule-text";

export interface SignedEventLike {
  id?: string;
  pubkey?: string;
  created_at?: number;
  kind?: number;
  tags?: string[][];
  content?: string;
  sig?: string;
}

export async function getEffectiveHashtagsForSubmit(
  useHashtagPresets: boolean,
  selectedHashtags: string,
  selectedQueue: string,
  queueTypes: Array<string | QueueType>,
  userId: string | undefined,
  defaultTags: string[]
): Promise<string> {
  if (useHashtagPresets) return selectedHashtags;
  const selectedQueueType = queueTypes.find(
    (qt) => (typeof qt === "string" ? qt : qt.name) === selectedQueue
  );
  const queueTypeId =
    typeof selectedQueueType === "object" ? selectedQueueType.id : null;
  try {
    const response = await fetch("/api/effective-hashtags", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId,
        queueTypeId,
        queueTypeName: selectedQueue,
      }),
    });
    if (response.ok) {
      const data = (await response.json()) as { hashtags?: string };
      return data.hashtags ?? "";
    }
    return defaultTags.join(" ");
  } catch (error) {
    const { handleErrorSafely } = await import("~/lib/error-handler.client");
    handleErrorSafely(error, {
      component: "UnifiedComposer",
      action: "fetchEffectiveHashtags",
    });
    return defaultTags.join(" ");
  }
}

export async function parseScheduledTime(
  scheduledForStr: string,
  userTimezone: string
): Promise<number> {
  try {
    const zonedDateTime = parseDateTimeLocal(scheduledForStr, userTimezone);
    const utcZoned = zonedDateTime.withTimeZone("UTC");
    return toUnixTimestamp(utcZoned) * 1000;
  } catch {
    try {
      const { fromISOString, toUnixTimestamp: toTs } =
        await import("~/lib/temporal");
      const zoned = fromISOString(scheduledForStr + "Z", "UTC");
      return toTs(zoned) * 1000;
    } catch {
      const dateObj = new Date(scheduledForStr + "Z");
      return dateObj.getTime();
    }
  }
}

export async function buildRepostSchedules(
  mainScheduledUnix: number,
  delayList: DelayAfterMain[],
  mainSignedEvent: SignedEventLike,
  setSigningError: (msg: string | null) => void
): Promise<Array<{
  scheduledFor: number;
  signedEvent: SignedEventLike;
}> | null> {
  const out: Array<{ scheduledFor: number; signedEvent: SignedEventLike }> = [];
  for (const delay of delayList) {
    if (!isValidDelayAfterMain(delay)) {
      setSigningError(
        "Each repost must be at least 1 (hour or minute) after the main post."
      );
      return null;
    }
    const offsetSeconds = delayAfterMainToSeconds(delay);
    const scheduledForUnix = mainScheduledUnix + offsetSeconds;
    if (scheduledForUnix <= mainScheduledUnix) {
      setSigningError("Repost must be scheduled after the main post.");
      return null;
    }
    const repostEvent = buildKind6RepostEvent(
      mainSignedEvent as SignedEvent,
      scheduledForUnix
    );
    const { signedEvent } = await nostrAdapter.signEventWithOneRetry({
      content: repostEvent.content,
      created_at: repostEvent.created_at,
      kind: repostEvent.kind,
      tags: repostEvent.tags,
    });
    out.push({ scheduledFor: scheduledForUnix, signedEvent });
  }
  return out;
}

export async function buildQuoteSchedules(
  mainScheduledUnix: number,
  entries: Array<{
    value: number;
    unit: DelayAfterMain["unit"];
    caption: string;
  }>,
  mainSignedEvent: SignedEventLike,
  tagArray: string[][],
  setSigningError: (msg: string | null) => void
): Promise<Array<{
  scheduledFor: number;
  signedEvent: SignedEventLike;
  caption?: string;
}> | null> {
  const out: Array<{
    scheduledFor: number;
    signedEvent: SignedEventLike;
    caption?: string;
  }> = [];
  for (const e of entries) {
    const delay: DelayAfterMain = { value: e.value, unit: e.unit };
    if (!isValidDelayAfterMain(delay)) {
      setSigningError(
        "Each quote must be at least 1 (hour or minute) after the main post."
      );
      return null;
    }
    const offsetSeconds = delayAfterMainToSeconds(delay);
    const scheduledForUnix = mainScheduledUnix + offsetSeconds;
    if (scheduledForUnix <= mainScheduledUnix) {
      setSigningError("Quote must be scheduled after the main post.");
      return null;
    }
    const quoteEvent = buildQuoteEvent(
      mainSignedEvent as SignedEvent,
      e.caption,
      scheduledForUnix,
      tagArray
    );
    const { signedEvent } = await nostrAdapter.signEventWithOneRetry({
      content: quoteEvent.content,
      created_at: quoteEvent.created_at,
      kind: quoteEvent.kind,
      tags: quoteEvent.tags,
    });
    out.push({
      scheduledFor: scheduledForUnix,
      signedEvent,
      caption: e.caption || undefined,
    });
  }
  return out;
}
