import { createDeferredActionPost } from "../repositories/engagement-deferred-action-data.server";
import { upsertLinkedActionForEngagementItem } from "../repositories/engagement-item-state.server";

import {
  buildDraftDeepLink,
  buildQueueDeepLink,
  buildScheduledDeepLink,
} from "./engagement-deep-links";

export type DeferredActionType = "reply" | "quote" | "repost";
export type DeferredMode = "draft" | "schedule" | "queue";

export async function createDeferredEngagementAction(params: {
  userId: string;
  eventId: string;
  actionType: DeferredActionType;
  mode: DeferredMode;
  content?: string;
  scheduledFor?: string | null;
  queueTypeId?: string | null;
}): Promise<{
  postId: string;
  deepLink: string;
  state: "DRAFTED" | "SCHEDULED";
}> {
  const {
    userId,
    eventId,
    actionType,
    mode,
    content = "",
    scheduledFor = null,
    queueTypeId = null,
  } = params;
  const now = new Date();
  const isDraft = mode === "draft";
  const isScheduled = mode === "schedule";
  const isQueue = mode === "queue";
  const scheduledAt = isDraft
    ? null
    : isScheduled
      ? scheduledFor
        ? new Date(scheduledFor)
        : now
      : now;
  const post = await createDeferredActionPost({
    userId,
    eventId,
    actionType,
    isDraft,
    scheduledAt,
    content,
    queueTypeId,
  });
  if (isDraft) {
    await upsertLinkedActionForEngagementItem({
      userId,
      eventId,
      state: "DRAFTED",
      kind: "DRAFT",
      postId: post.id,
      draftId: post.id,
      label: "Draft saved",
    });
    return {
      postId: post.id,
      deepLink: buildDraftDeepLink(post.id),
      state: "DRAFTED",
    };
  }

  const kind =
    actionType === "reply"
      ? isQueue
        ? "QUEUED_REPLY"
        : "SCHEDULED_REPLY"
      : actionType === "quote"
        ? isQueue
          ? "QUEUED_QUOTE"
          : "SCHEDULED_QUOTE"
        : isQueue
          ? "QUEUED_REPOST"
          : "SCHEDULED_REPOST";

  await upsertLinkedActionForEngagementItem({
    userId,
    eventId,
    state: "SCHEDULED",
    kind,
    postId: post.id,
    queueTypeId: post.queueTypeId,
    scheduledFor: scheduledAt,
    label: isQueue ? "Queued action" : "Scheduled action",
  });
  const deepLink = isQueue
    ? buildQueueDeepLink(post.queueTypeId ?? "all")
    : buildScheduledDeepLink(post.id);
  return { postId: post.id, deepLink, state: "SCHEDULED" };
}
