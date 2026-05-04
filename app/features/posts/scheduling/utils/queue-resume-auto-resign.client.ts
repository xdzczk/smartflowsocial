/**
 * After queue resume, signs every NEEDS_RESIGN row for that queue in order and
 * submits via the calendar reschedule action (same path as the reschedule modal).
 */

import {
  signBatchWithRecovery,
  type SignBatchResult,
} from "~/features/auth/signing/sign-batch-with-recovery.client";
import { signingAttempts } from "~/features/auth/signing/signing-attempts.client";
import { durableIntent } from "~/features/auth/signing/use-recoverable-sign.client";
import type { PostDTO, LongFormPostDTO } from "~/features/posts/dtos";
import { fromLongFormPostDTO, fromPostDTO } from "~/features/posts/dtos";
import { nostrAdapter } from "~/lib/nostr-adapter.client";

import {
  defaultIncludeHashtagsForQueueSelection,
  type LongFormPostData,
  type PostData,
  type QueueType,
} from "../../types";

import { buildUnsignedEventTemplateForReschedule } from "./reschedule-sign-template.client";

type NeedsResignItem =
  | { kind: "post"; post: PostDTO }
  | { kind: "longform"; longform: LongFormPostDTO };

async function submitCalendarReschedule(params: {
  post: PostData | LongFormPostData;
  isLongform: boolean;
  newTimeUnix: number;
  signedEvent: unknown;
  nostrEvent: unknown;
}): Promise<void> {
  const fd = new FormData();
  fd.set("action", params.isLongform ? "rescheduleLongform" : "reschedule");
  fd.set("postId", params.post.id);
  fd.set("newTime", String(params.newTimeUnix));
  fd.set("signedEvent", JSON.stringify(params.signedEvent));
  fd.set("nostrEvent", JSON.stringify(params.nostrEvent));
  if (!params.isLongform) {
    const p = params.post as PostData;
    fd.set("overrideQueue", String(p.manual_override === true));
    if (p.queueType?.id) {
      fd.set("queueTypeId", p.queueType.id);
    }
  }
  const res = await fetch("/dashboard/calendar", {
    method: "POST",
    body: fd,
    credentials: "same-origin",
  });
  let jsonBody: unknown = null;
  try {
    jsonBody = await res.json();
  } catch {
    jsonBody = null;
  }
  const obj =
    jsonBody && typeof jsonBody === "object"
      ? (jsonBody as Record<string, unknown>)
      : null;
  if (!res.ok) {
    const msg =
      obj && typeof obj["error"] === "string"
        ? obj["error"]
        : `Request failed (${res.status})`;
    throw new Error(msg);
  }
  if (obj && typeof obj["error"] === "string" && obj["error"]) {
    throw new Error(obj["error"]);
  }
}

function settleSigningAttempt(
  result: SignBatchResult<{ postId: string }>
): void {
  const inStore = signingAttempts
    .getAllAttempts()
    .find((a) => a.attemptId === result.attemptId);
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
      result.lastError ?? `queue_resume_${result.reason}`
    );
  }
}

/**
 * Fetches NEEDS_RESIGN items for the queue, signs them in order, and submits each reschedule.
 */
export async function runQueueResumeAutoResign(params: {
  queueTypeId: string;
  queueTypes: QueueType[];
}): Promise<
  | { ok: true; total: number; signedCount: number }
  | { ok: false; message: string }
> {
  const res = await fetch(
    `/api/queue-needs-resign?queueTypeId=${encodeURIComponent(params.queueTypeId)}`
  );
  const raw: unknown = await res.json();
  if (!res.ok) {
    const msg =
      raw &&
      typeof raw === "object" &&
      "error" in raw &&
      typeof (raw as { error: unknown }).error === "string"
        ? (raw as { error: string }).error
        : "Could not load posts to sign.";
    return { ok: false, message: msg };
  }
  if (
    !raw ||
    typeof raw !== "object" ||
    !("items" in raw) ||
    !Array.isArray((raw as { items: unknown }).items)
  ) {
    return { ok: false, message: "Invalid response from server." };
  }
  const items = (raw as { items: NeedsResignItem[] }).items;
  if (items.length === 0) {
    return { ok: true, total: 0, signedCount: 0 };
  }

  const idempotencyKey = `queue_resume_resign:${params.queueTypeId}:${items
    .map((i: NeedsResignItem) =>
      i.kind === "post" ? i.post.id : i.longform.id
    )
    .join(",")}`;

  const batchResult = await signBatchWithRecovery<
    NeedsResignItem,
    { postId: string }
  >({
    items,
    intent: durableIntent(
      "reschedule_post",
      idempotencyKey,
      "Resume queue - sign scheduled posts"
    ),
    surface: "queues_panel:resume_auto_resign",
    perItemDelayMs: 80,
    signItem: async (item, _index, signer) => {
      const post =
        item.kind === "longform"
          ? fromLongFormPostDTO(item.longform)
          : fromPostDTO(item.post);
      const isLongform = item.kind === "longform";
      const scheduledAt = post.scheduledAtUtc;
      if (!scheduledAt) {
        throw new Error("Missing scheduled time on post.");
      }
      const newTimeUnix = Math.floor(scheduledAt.getTime() / 1000);

      const originalSignedEvent = post.signedEvent;
      const originalNostrEvent = post.nostrEvent;
      const pd = post as PostData;

      let signPayload: {
        content: string;
        created_at: number;
        kind: number;
        tags: string[][];
      };

      if (originalSignedEvent && originalNostrEvent) {
        signPayload = {
          content: originalSignedEvent.content,
          created_at: newTimeUnix,
          kind: originalSignedEvent.kind,
          tags: originalSignedEvent.tags,
        };
      } else {
        const includeHashtagsInNoteBody = !isLongform
          ? defaultIncludeHashtagsForQueueSelection(
              pd.queueType?.id ?? "",
              params.queueTypes
            )
          : true;
        const built = buildUnsignedEventTemplateForReschedule({
          post,
          isLongform,
          newTimeUnix,
          includeHashtagsInNoteBody,
          repostSourceSignedEvent: isLongform
            ? undefined
            : pd.repostSourceSignedEvent,
          quoteSourceSignedEvent: isLongform
            ? undefined
            : pd.quoteSourceSignedEvent,
          quoteLongFormSourceSignedEvent: isLongform
            ? undefined
            : pd.quoteLongFormSourceSignedEvent,
        });
        if ("error" in built) {
          throw new Error(built.error);
        }
        signPayload = built;
      }

      const { nostrEvent, signedEvent } = await nostrAdapter.signEvent(
        signPayload,
        { clearCacheOnError: false, signer: signer ?? undefined }
      );

      await submitCalendarReschedule({
        post,
        isLongform,
        newTimeUnix,
        signedEvent,
        nostrEvent,
      });

      return { postId: post.id };
    },
  });

  settleSigningAttempt(batchResult);

  if (batchResult.ok) {
    return {
      ok: true,
      total: items.length,
      signedCount: batchResult.signed.length,
    };
  }

  if (batchResult.reason === "partial") {
    return {
      ok: false,
      message: `Signed ${batchResult.signed.length} of ${items.length}. Some posts could not be signed.`,
    };
  }

  return {
    ok: false,
    message:
      batchResult.lastError ??
      `Signing did not complete (${batchResult.reason}).`,
  };
}
