/**
 * Repost/quote scheduling after edit-post submit.
 * Extracted from EditPostModal; aligns with editPostSubmit.client.ts.
 *
 * The follow-up repost/quote sign loop is wrapped in
 * {@link signBatchWithRecovery} so a stalled bunker mid-batch parks the
 * remaining items under the foreground recovery banner instead of leaving
 * the user with an unscheduled tail.
 */

import { toast } from "react-hot-toast";

import { signBatchWithRecovery } from "~/features/auth/signing/sign-batch-with-recovery.client";
import { signingAttempts } from "~/features/auth/signing/signing-attempts.client";
import { durableIntent } from "~/features/auth/signing/use-recoverable-sign.client";
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

interface PreparedRepostItem {
  kind: "repost";
  scheduledForUnix: number;
}

interface PreparedQuoteItem {
  kind: "quote";
  scheduledForUnix: number;
  caption: string;
}

type PreparedItem = PreparedRepostItem | PreparedQuoteItem;

interface SignedItem {
  kind: "repost" | "quote";
  signedEvent: { id: string };
  scheduledForUnix: number;
  caption?: string;
}

function prepareRepostItems(
  mainScheduledUnix: number,
  repostDelayList: Array<{
    id: string;
    value: number;
    unit: DelayAfterMain["unit"];
  }>
): PreparedRepostItem[] {
  const out: PreparedRepostItem[] = [];
  for (const item of repostDelayList) {
    const delay: DelayAfterMain = { value: item.value, unit: item.unit };
    if (!isValidDelayAfterMain(delay)) continue;
    out.push({
      kind: "repost",
      scheduledForUnix: mainScheduledUnix + delayAfterMainToSeconds(delay),
    });
  }
  return out;
}

function prepareQuoteItems(
  mainScheduledUnix: number,
  quoteEntries: Array<{
    id: string;
    value: number;
    unit: DelayAfterMain["unit"];
    caption: string;
  }>
): PreparedQuoteItem[] {
  const out: PreparedQuoteItem[] = [];
  for (const entry of quoteEntries) {
    const delay: DelayAfterMain = { value: entry.value, unit: entry.unit };
    if (!isValidDelayAfterMain(delay)) continue;
    out.push({
      kind: "quote",
      scheduledForUnix: mainScheduledUnix + delayAfterMainToSeconds(delay),
      caption: entry.caption,
    });
  }
  return out;
}

async function postSignedItem(
  signed: SignedItem,
  postId: string,
  repostConditions: RepostConditionsForm
): Promise<void> {
  const fd = new FormData();
  if (signed.kind === "repost") {
    fd.set("_action", "scheduleRepost");
    fd.set("postId", postId);
    fd.set("scheduledFor", signed.scheduledForUnix.toString());
    fd.set("signedEvent", JSON.stringify(signed.signedEvent));
    appendRepostConditionsToForm(fd, repostConditions);
  } else {
    fd.set("_action", "scheduleQuote");
    fd.set("postId", postId);
    fd.set("scheduledFor", signed.scheduledForUnix.toString());
    fd.set("signedEvent", JSON.stringify(signed.signedEvent));
    if (signed.caption) fd.set("quoteCaption", signed.caption);
  }
  const res = await fetch("/dashboard/scheduled", {
    method: "POST",
    body: fd,
  });
  if (!res.ok) {
    throw new Error(
      `Failed to schedule ${signed.kind === "repost" ? "repost" : "quote"}`
    );
  }
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
  const items: PreparedItem[] = [
    ...(alsoScheduleRepost
      ? prepareRepostItems(mainScheduledUnix, repostDelayList)
      : []),
    ...(alsoScheduleQuote
      ? prepareQuoteItems(mainScheduledUnix, quoteEntries)
      : []),
  ];
  if (items.length === 0) return;

  const idempotencyKey = `edit_post_repost_quote:${mainEv.id}:${String(
    mainScheduledUnix
  )}`;

  const result = await signBatchWithRecovery<PreparedItem, SignedItem>({
    items,
    intent: durableIntent(
      "schedule_repost_quote",
      idempotencyKey,
      "Schedule repost/quote"
    ),
    surface: `edit_post:${postId}:repost_quote`,
    signItem: async (item) => {
      if (item.kind === "repost") {
        const repostEvent = buildKind6RepostEvent(
          mainEv,
          item.scheduledForUnix
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
        return {
          kind: "repost",
          signedEvent,
          scheduledForUnix: item.scheduledForUnix,
        };
      }
      const quoteEvent = buildQuoteEvent(
        mainEv,
        item.caption,
        item.scheduledForUnix,
        []
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
      return {
        kind: "quote",
        signedEvent,
        scheduledForUnix: item.scheduledForUnix,
        caption: item.caption,
      };
    },
  });

  if (!result.ok) {
    // Helper auto-cancels partial outcomes; we only need to surface the
    // failure to the caller for any remaining UI handling.
    if (result.reason !== "partial") {
      signingAttempts.cancelAttempt(result.attemptId);
    }
    throw new Error(
      result.lastError ??
        (result.reason === "expired"
          ? "Recovery window expired before your signer reconnected."
          : `Failed to schedule ${String(result.failedIndices.length)} repost/quote item(s)`)
    );
  }

  try {
    for (const entry of result.signed) {
      await postSignedItem(entry.signed, postId, repostConditions ?? null);
    }
    signingAttempts.markCompleted(result.attemptId);
  } catch (err) {
    signingAttempts.markFailed(
      result.attemptId,
      err instanceof Error ? err.message : "Failed to schedule repost/quote"
    );
    throw err;
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
