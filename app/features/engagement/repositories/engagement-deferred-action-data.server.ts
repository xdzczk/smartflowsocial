import type { PrismaClient } from "@prisma/client";

import type { SignedEvent } from "~/features/nostr/types";
import { createPostWithOutbox } from "~/features/posts/data/post.commands.server";
import { prisma } from "~/lib/prisma.server";

const db = prisma as unknown as PrismaClient;

export async function createDeferredActionPost(params: {
  userId: string;
  eventId: string;
  actionType: "reply" | "quote" | "repost";
  isDraft: boolean;
  scheduledAt: Date | null;
  content: string;
  queueTypeId: string | null;
}) {
  const {
    userId,
    eventId,
    actionType,
    isDraft,
    scheduledAt,
    content,
    queueTypeId,
  } = params;
  const postKind =
    actionType === "reply"
      ? "REPLY"
      : actionType === "quote"
        ? "QUOTE"
        : "REPOST";
  return db.post.create({
    data: {
      userId,
      content,
      caption: content || null,
      fileUrl: [],
      currentState: isDraft ? "DRAFT" : "SCHEDULED",
      scheduledAtUtc: scheduledAt,
      postKind,
      replyToEventId: actionType === "reply" ? eventId : null,
      queueTypeId,
    },
    select: { id: true, queueTypeId: true },
  });
}

/**
 * Scheduled engagement actions must include a client-signed event and use the outbox
 * so Bull scheduled-post jobs receive a valid signedEvent.
 */
export async function createScheduledEngagementPostWithOutbox(params: {
  userId: string;
  eventId: string;
  actionType: "reply" | "quote" | "repost";
  scheduledAt: Date;
  content: string;
  signedEvent: SignedEvent;
  queueTypeId?: string | null;
}): Promise<{ id: string; queueTypeId: string | null }> {
  const {
    userId,
    eventId,
    actionType,
    scheduledAt,
    content,
    signedEvent,
    queueTypeId = null,
  } = params;

  const postKind =
    actionType === "reply"
      ? "REPLY"
      : actionType === "quote"
        ? "QUOTE"
        : "REPOST";

  const scheduledForUnix = Math.floor(scheduledAt.getTime() / 1000);

  const post = await createPostWithOutbox(
    {
      userId,
      content,
      caption: content ? content : undefined,
      fileUrl: [],
      postType: "TEXT",
      scheduledAtUtc: scheduledAt,
      signedEvent,
      tags: [],
      postKind,
      replyToEventId: actionType === "reply" ? eventId : undefined,
      repost: actionType === "repost",
      isQuotedPost: false,
      ...(queueTypeId ? { queueTypeId } : {}),
    },
    scheduledForUnix
  );

  return { id: post.id, queueTypeId: post.queueTypeId };
}
