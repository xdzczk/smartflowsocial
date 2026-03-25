import type { PrismaClient } from "@prisma/client";

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
