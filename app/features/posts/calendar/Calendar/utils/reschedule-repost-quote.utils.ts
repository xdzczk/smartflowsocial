/**
 * Repost/quote scheduling helpers for the reschedule modal (sign + submit).
 */

import type { RepostConditions } from "~/features/posts/types";
import {
  buildKind6RepostEvent,
  buildQuoteEvent,
} from "~/features/posts/utils/repost-quote-events.client";
import { nostrAdapter } from "~/lib/nostr-adapter.client";

import type { CalendarPost } from "../PostBlock.types";

export interface SignedEventForRepost {
  id: string;
  pubkey: string;
  created_at?: number;
  kind?: number;
  tags?: string[][];
  content?: string;
  sig?: string;
}

export function canScheduleRepostQuoteForPost(
  isLongform: boolean,
  post: CalendarPost
): boolean {
  if (isLongform) return false;
  const ev = post.signedEvent;
  if (!ev || typeof ev !== "object") return false;
  return "id" in ev && "pubkey" in ev;
}

export async function submitRepostSchedule(
  postId: string,
  originalSignedEvent: SignedEventForRepost & {
    created_at: number;
    kind: number;
    tags: string[][];
    content: string;
    sig: string;
  },
  scheduledForUnix: number,
  submit: (formData: FormData) => void,
  repostConditions?: RepostConditions | null,
  attemptId?: string
): Promise<void> {
  const repostEvent = buildKind6RepostEvent(
    originalSignedEvent,
    scheduledForUnix
  );
  const { signedEvent: repostSignedEvent } = await nostrAdapter.signEvent(
    {
      content: repostEvent.content,
      created_at: repostEvent.created_at,
      kind: repostEvent.kind,
      tags: repostEvent.tags,
    },
    { clearCacheOnError: false }
  );
  const formData = new FormData();
  formData.set("_action", "scheduleRepost");
  formData.set("postId", postId);
  formData.set("scheduledFor", scheduledForUnix.toString());
  formData.set("signedEvent", JSON.stringify(repostSignedEvent));
  if (attemptId) {
    formData.set("attemptId", attemptId);
  }
  if (repostConditions) {
    if (repostConditions.minReactions != null)
      formData.set("minReactions", String(repostConditions.minReactions));
    if (repostConditions.minZaps != null)
      formData.set("minZaps", String(repostConditions.minZaps));
    if (repostConditions.minComments != null)
      formData.set("minComments", String(repostConditions.minComments));
    if (repostConditions.minReposts != null)
      formData.set("minReposts", String(repostConditions.minReposts));
    if (repostConditions.minSats != null)
      formData.set("minSats", String(repostConditions.minSats));
  }
  submit(formData);
}

export async function submitQuoteSchedule(
  postId: string,
  originalSignedEvent: SignedEventForRepost & {
    created_at: number;
    kind: number;
    tags: string[][];
    content: string;
    sig: string;
  },
  scheduledForUnix: number,
  caption: string,
  submit: (formData: FormData) => void,
  attemptId?: string
): Promise<void> {
  const tagArray: string[][] = [];
  const quoteEvent = buildQuoteEvent(
    originalSignedEvent,
    caption,
    scheduledForUnix,
    tagArray
  );
  const { signedEvent: quoteSignedEvent } = await nostrAdapter.signEvent(
    {
      content: quoteEvent.content,
      created_at: quoteEvent.created_at,
      kind: quoteEvent.kind,
      tags: quoteEvent.tags,
    },
    { clearCacheOnError: false }
  );
  const formData = new FormData();
  formData.set("_action", "scheduleQuote");
  formData.set("postId", postId);
  formData.set("scheduledFor", scheduledForUnix.toString());
  formData.set("signedEvent", JSON.stringify(quoteSignedEvent));
  if (attemptId) {
    formData.set("attemptId", attemptId);
  }
  if (caption) {
    formData.set("quoteCaption", caption);
  }
  submit(formData);
}
