import type { SignedEvent } from "~/features/nostr/types";
import { assertScheduleCapacity } from "~/features/payments/entitlements/schedule-cap-policy.server";

import {
  createDeferredActionPost,
  createScheduledEngagementPostWithOutbox,
} from "../repositories/engagement-deferred-action-data.server";
import { upsertLinkedActionForEngagementItem } from "../repositories/engagement-item-state.server";

import {
  buildDraftDeepLink,
  buildScheduledDeepLink,
} from "./engagement-deep-links";

export type DeferredActionType = "reply" | "quote" | "repost";
export type DeferredMode = "draft" | "schedule";

export async function createDeferredEngagementAction(params: {
  userId: string;
  eventId: string;
  actionType: DeferredActionType;
  mode: DeferredMode;
  content?: string;
  scheduledFor?: string | null;
  queueTypeId?: string | null;
  /** Required when mode is schedule  -  client-signed Nostr event (publish time = scheduledFor). */
  signedEvent?: SignedEvent | null;
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
    signedEvent = null,
  } = params;
  const now = new Date();
  const isDraft = mode === "draft";
  const isScheduled = mode === "schedule";
  const scheduledAt = isDraft
    ? null
    : scheduledFor
      ? new Date(scheduledFor)
      : now;

  if (isScheduled) {
    if (!signedEvent || typeof signedEvent !== "object") {
      throw new Error(
        "signedEvent is required for scheduled engagement actions"
      );
    }
    if (!scheduledAt || Number.isNaN(scheduledAt.getTime())) {
      throw new Error(
        "scheduledFor is required for scheduled engagement actions"
      );
    }
    await assertScheduleCapacity(userId, 1);
    const post = await createScheduledEngagementPostWithOutbox({
      userId,
      eventId,
      actionType,
      scheduledAt,
      content,
      signedEvent,
      queueTypeId,
    });

    const kind =
      actionType === "reply"
        ? "SCHEDULED_REPLY"
        : actionType === "quote"
          ? "SCHEDULED_QUOTE"
          : "SCHEDULED_REPOST";

    await upsertLinkedActionForEngagementItem({
      userId,
      eventId,
      state: "SCHEDULED",
      kind,
      postId: post.id,
      queueTypeId: post.queueTypeId,
      scheduledFor: scheduledAt,
      label: "Scheduled action",
    });
    return {
      postId: post.id,
      deepLink: buildScheduledDeepLink(post.id),
      state: "SCHEDULED",
    };
  }

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

  throw new Error("Invalid deferred engagement mode");
}
