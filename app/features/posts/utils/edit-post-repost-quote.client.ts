/**
 * Repost/quote scheduling after edit-post submit.
 * Extracted from EditPostModal; aligns with editPostSubmit.client.ts.
 */

import { toast } from "react-hot-toast";

import {
  handleErrorSafely,
  showErrorToastFromUnknown,
} from "~/lib/error-handler.client";
import { nostrAdapter } from "~/lib/nostr-adapter.client";

import {
  delayAfterMainToSeconds,
  isValidDelayAfterMain,
  type DelayAfterMain,
} from "./delay-after-main";
import {
  buildKind6RepostEvent,
  buildQuoteEvent,
} from "./repost-quote-events.client";

export interface MainEv {
  id: string;
  pubkey: string;
  created_at: number;
  kind: number;
  tags: string[][];
  content: string;
  sig: string;
}

export type RepostConditionsForm = {
  minReactions?: number;
  minZaps?: number;
  minComments?: number;
  minReposts?: number;
  minSats?: number;
} | null;

export function appendRepostConditionsToForm(
  fd: FormData,
  repostConditions: RepostConditionsForm
): void {
  if (!repostConditions) return;
  if (repostConditions.minReactions != null)
    fd.set("minReactions", String(repostConditions.minReactions));
  if (repostConditions.minZaps != null)
    fd.set("minZaps", String(repostConditions.minZaps));
  if (repostConditions.minComments != null)
    fd.set("minComments", String(repostConditions.minComments));
  if (repostConditions.minReposts != null)
    fd.set("minReposts", String(repostConditions.minReposts));
  if (repostConditions.minSats != null)
    fd.set("minSats", String(repostConditions.minSats));
}

export async function scheduleOneRepost(
  mainScheduledUnix: number,
  mainEv: MainEv,
  postId: string,
  item: { value: number; unit: DelayAfterMain["unit"] },
  repostConditions: RepostConditionsForm
): Promise<void> {
  const delay: DelayAfterMain = { value: item.value, unit: item.unit };
  if (!isValidDelayAfterMain(delay)) return;
  const offsetSeconds = delayAfterMainToSeconds(delay);
  const repostScheduledForUnix = mainScheduledUnix + offsetSeconds;
  const repostEvent = buildKind6RepostEvent(mainEv, repostScheduledForUnix);
  const { signedEvent: repostSignedEvent } =
    await nostrAdapter.signEventWithOneRetry({
      content: repostEvent.content,
      created_at: repostEvent.created_at,
      kind: repostEvent.kind,
      tags: repostEvent.tags,
    });
  const fd = new FormData();
  fd.set("_action", "scheduleRepost");
  fd.set("postId", postId);
  fd.set("scheduledFor", repostScheduledForUnix.toString());
  fd.set("signedEvent", JSON.stringify(repostSignedEvent));
  appendRepostConditionsToForm(fd, repostConditions);
  const res = await fetch("/dashboard/scheduled", { method: "POST", body: fd });
  if (!res.ok) throw new Error("Failed to schedule repost");
}

export async function scheduleOneQuote(
  mainScheduledUnix: number,
  mainEv: MainEv,
  postId: string,
  entry: { value: number; unit: DelayAfterMain["unit"]; caption: string }
): Promise<void> {
  const delay: DelayAfterMain = { value: entry.value, unit: entry.unit };
  if (!isValidDelayAfterMain(delay)) return;
  const offsetSeconds = delayAfterMainToSeconds(delay);
  const quoteScheduledForUnix = mainScheduledUnix + offsetSeconds;
  const quoteEvent = buildQuoteEvent(
    mainEv,
    entry.caption,
    quoteScheduledForUnix,
    []
  );
  const { signedEvent: quoteSignedEvent } =
    await nostrAdapter.signEventWithOneRetry({
      content: quoteEvent.content,
      created_at: quoteEvent.created_at,
      kind: quoteEvent.kind,
      tags: quoteEvent.tags,
    });
  const fd = new FormData();
  fd.set("_action", "scheduleQuote");
  fd.set("postId", postId);
  fd.set("scheduledFor", quoteScheduledForUnix.toString());
  fd.set("signedEvent", JSON.stringify(quoteSignedEvent));
  if (entry.caption) fd.set("quoteCaption", entry.caption);
  const res = await fetch("/dashboard/scheduled", { method: "POST", body: fd });
  if (!res.ok) throw new Error("Failed to schedule quote");
}

export async function scheduleRepostsAndQuotesAfterSubmit(
  mainScheduledUnix: number,
  mainEv: MainEv,
  postId: string,
  repostDelayList: Array<{
    id: string;
    value: number;
    unit: DelayAfterMain["unit"];
  }>,
  quoteEntries: Array<{
    id: string;
    value: number;
    unit: DelayAfterMain["unit"];
    caption: string;
  }>,
  alsoScheduleRepost: boolean,
  alsoScheduleQuote: boolean,
  repostConditions?: RepostConditionsForm
): Promise<void> {
  if (alsoScheduleRepost && repostDelayList.length > 0) {
    for (const item of repostDelayList) {
      await scheduleOneRepost(
        mainScheduledUnix,
        mainEv,
        postId,
        item,
        repostConditions ?? null
      );
    }
  }
  if (alsoScheduleQuote && quoteEntries.length > 0) {
    for (const entry of quoteEntries) {
      await scheduleOneQuote(mainScheduledUnix, mainEv, postId, entry);
    }
  }
}

export async function runScheduleRepostQuoteIfNeeded(
  isLongform: boolean,
  mainSignedEvent: unknown,
  formData: FormData,
  postId: string,
  repostDelayList: Array<{
    id: string;
    value: number;
    unit: DelayAfterMain["unit"];
  }>,
  quoteEntries: Array<{
    id: string;
    value: number;
    unit: DelayAfterMain["unit"];
    caption: string;
  }>,
  alsoScheduleRepost: boolean,
  alsoScheduleQuote: boolean,
  repostConditions?: RepostConditionsForm
): Promise<void> {
  if (
    isLongform ||
    !mainSignedEvent ||
    (!alsoScheduleRepost && !alsoScheduleQuote)
  ) {
    return;
  }
  const mainScheduledForStr = formData.get("scheduledFor");
  const mainScheduledUnix =
    typeof mainScheduledForStr === "string"
      ? parseInt(mainScheduledForStr, 10)
      : NaN;
  const hasMainScheduled =
    !Number.isNaN(mainScheduledUnix) && mainScheduledUnix > 0;
  const mainEv = mainSignedEvent as MainEv;
  if (!hasMainScheduled || !mainEv.id || !mainEv.pubkey) return;
  try {
    await scheduleRepostsAndQuotesAfterSubmit(
      mainScheduledUnix,
      mainEv,
      postId,
      repostDelayList,
      quoteEntries,
      alsoScheduleRepost,
      alsoScheduleQuote,
      repostConditions
    );
    if (
      (alsoScheduleRepost && repostDelayList.length > 0) ||
      (alsoScheduleQuote && quoteEntries.length > 0)
    ) {
      toast.success("Repost/quote scheduled successfully!");
    }
  } catch (err) {
    handleErrorSafely(err, {
      component: "EditPostModal",
      action: "alsoScheduleRepostQuote",
    });
    showErrorToastFromUnknown(err, {
      fallback: "Failed to schedule repost/quote",
    });
  }
}
