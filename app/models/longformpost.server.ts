import type { LongFormPost, User, Prisma } from "@prisma/client";

import { prisma } from "~/lib/prisma.server";

export type { LongFormPost } from "@prisma/client";

export async function createLongFormPost({
  userId,
  title,
  summary,
  content,
  image,
  tags,
  isPublished = false,
  signedEvent,
  nostrEvent,
  scheduledFor,
  queueTypeId,
}: {
  userId: LongFormPost["userId"];
  title: LongFormPost["title"];
  summary?: LongFormPost["summary"];
  content: LongFormPost["content"];
  image?: LongFormPost["image"];
  tags?: LongFormPost["tags"];
  isPublished?: LongFormPost["isPublished"];
  signedEvent?: LongFormPost["signedEvent"];
  nostrEvent?: LongFormPost["nostrEvent"];
  scheduledFor?: string | null;
  queueTypeId?: LongFormPost["queueTypeId"];
}) {
  // Extract published_at from NOSTR event tags if not provided as scheduledFor
  let finalScheduledFor = scheduledFor;
  if (!finalScheduledFor && !isPublished && signedEvent?.tags) {
    const publishedAtTag = signedEvent.tags.find(
      (tag) => Array.isArray(tag) && tag[0] === "published_at",
    );
    if (publishedAtTag && publishedAtTag[1]) {
      finalScheduledFor = publishedAtTag[1].toString();
    }
  }

  // Determine status based on publishing state and scheduling
  let status: "DRAFT" | "ACTIVE" | "SCHEDULED";
  const isScheduled = Boolean(finalScheduledFor && !isPublished);
  const isDraft = !isPublished && !isScheduled;

  if (isPublished) {
    status = "ACTIVE";
  } else if (isScheduled) {
    status = "SCHEDULED";
  } else {
    status = "DRAFT";
  }

  // Extract nostrEventId from signedEvent if available
  const nostrEventId = signedEvent?.id || null;

  // Calculate publishedAt based on scheduling
  let publishedAt: Date | null = null;
  if (isPublished) {
    // For published posts, use the event's published_at if available, otherwise current time
    publishedAt = signedEvent?.published_at
      ? new Date(signedEvent.published_at * 1000)
      : new Date();
  } else if (isScheduled && finalScheduledFor) {
    // For scheduled posts, set publishedAt to the scheduled time
    publishedAt = new Date(parseInt(finalScheduledFor) * 1000);
  }

  return prisma.longFormPost.create({
    data: {
      userId,
      title,
      summary,
      content,
      image,
      tags: tags || [],
      isPublished,
      isScheduled,
      draft: isDraft,
      signedEvent,
      nostrEvent,
      nostrEventId,
      status,
      publishedAt,
      postedAt: isPublished ? new Date() : null,
      scheduledFor: finalScheduledFor,
      queueTypeId,
    },
  });
}

export async function updateLongFormPost({
  id,
  userId,
  title,
  summary,
  content,
  image,
  tags,
  isPublished,
  signedEvent,
  nostrEvent,
  scheduledFor,
  queueTypeId,
}: {
  id: LongFormPost["id"];
  userId: LongFormPost["userId"];
  title?: LongFormPost["title"];
  summary?: LongFormPost["summary"];
  content?: LongFormPost["content"];
  image?: LongFormPost["image"];
  tags?: LongFormPost["tags"];
  isPublished?: LongFormPost["isPublished"];
  signedEvent?: LongFormPost["signedEvent"];
  nostrEvent?: LongFormPost["nostrEvent"];
  scheduledFor?: string | null;
  queueTypeId?: LongFormPost["queueTypeId"];
}) {
  // Extract published_at from NOSTR event tags if scheduledFor is not provided
  let finalScheduledFor = scheduledFor;
  if (scheduledFor === undefined && !isPublished && signedEvent?.tags) {
    const publishedAtTag = signedEvent.tags.find(
      (tag) => Array.isArray(tag) && tag[0] === "published_at",
    );
    if (publishedAtTag && publishedAtTag[1]) {
      finalScheduledFor = publishedAtTag[1].toString();
    }
  }

  const updateData: Prisma.LongFormPostUpdateInput = {
    updatedAt: new Date(),
  };

  if (title !== undefined) updateData.title = title;
  if (summary !== undefined) updateData.summary = summary;
  if (content !== undefined) updateData.content = content;
  if (image !== undefined) updateData.image = image;
  if (tags !== undefined) updateData.tags = tags;
  if (finalScheduledFor !== undefined)
    updateData.scheduledFor = finalScheduledFor;
  if (queueTypeId !== undefined) updateData.queueTypeId = queueTypeId;

  if (signedEvent !== undefined) {
    updateData.signedEvent = signedEvent;
    updateData.nostrEventId = signedEvent?.id || null;
  }
  if (nostrEvent !== undefined) updateData.nostrEvent = nostrEvent;

  if (isPublished !== undefined || finalScheduledFor !== undefined) {
    const finalIsPublished = isPublished !== undefined ? isPublished : false;
    const isScheduled = Boolean(finalScheduledFor && !finalIsPublished);
    const isDraft = !finalIsPublished && !isScheduled;

    updateData.isPublished = finalIsPublished;
    updateData.isScheduled = isScheduled;
    updateData.draft = isDraft;

    if (finalIsPublished) {
      updateData.status = "ACTIVE";
      updateData.publishedAt = signedEvent?.published_at
        ? new Date(signedEvent.published_at * 1000)
        : new Date();
      updateData.postedAt = new Date();
    } else if (isScheduled && finalScheduledFor) {
      updateData.status = "SCHEDULED";
      // Set publishedAt to the scheduled time for consistency
      updateData.publishedAt = new Date(parseInt(finalScheduledFor) * 1000);
    } else {
      updateData.status = "DRAFT";
    }
  }

  return prisma.longFormPost.update({
    where: { id, userId },
    data: updateData,
  });
}

export async function getLongFormPost({
  id,
  userId,
}: {
  id: LongFormPost["id"];
  userId: LongFormPost["userId"];
}) {
  return prisma.longFormPost.findFirst({
    where: { id, userId },
    include: {
      queueType: true,
    },
  });
}

export async function getLongFormPostByEventId({
  nostrEventId,
  userId,
}: {
  nostrEventId: LongFormPost["nostrEventId"];
  userId: LongFormPost["userId"];
}) {
  if (!nostrEventId) return null;

  return prisma.longFormPost.findFirst({
    where: { nostrEventId, userId },
  });
}

export async function getUserLongFormPosts({
  userId,
  isPublished,
  page = 1,
  limit = 10,
}: {
  userId: LongFormPost["userId"];
  isPublished?: boolean;
  page?: number;
  limit?: number;
}) {
  const skip = (page - 1) * limit;

  const where: Prisma.LongFormPostWhereInput = { userId };
  if (isPublished !== undefined) {
    where.isPublished = isPublished;
  }

  const [posts, total] = await Promise.all([
    prisma.longFormPost.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.longFormPost.count({ where }),
  ]);

  return {
    posts,
    total,
    pages: Math.ceil(total / limit),
    currentPage: page,
  };
}

export async function deleteLongFormPost({
  id,
  userId,
}: {
  id: LongFormPost["id"];
  userId: LongFormPost["userId"];
}) {
  return prisma.longFormPost.delete({
    where: { id, userId },
  });
}

export async function publishLongFormPost({
  id,
  userId,
  signedEvent,
  nostrEvent,
}: {
  id: LongFormPost["id"];
  userId: LongFormPost["userId"];
  signedEvent: LongFormPost["signedEvent"];
  nostrEvent: LongFormPost["nostrEvent"];
}) {
  return prisma.longFormPost.update({
    where: { id, userId },
    data: {
      isPublished: true,
      status: "ACTIVE",
      publishedAt: new Date(),
      signedEvent,
      nostrEvent,
      nostrEventId: signedEvent?.id,
    },
  });
}

export async function getDraftLongFormPosts({
  userId,
}: {
  userId: User["id"];
}) {
  return prisma.longFormPost.findMany({
    where: { userId, isPublished: false, draft: true },
    include: {
      queueType: true,
    },
    orderBy: { updatedAt: "desc" },
  });
}

export async function getPublishedLongFormPosts({
  userId,
  page = 1,
  limit = 10,
}: {
  userId: User["id"];
  page?: number;
  limit?: number;
}) {
  const skip = (page - 1) * limit;

  const [posts, total] = await Promise.all([
    prisma.longFormPost.findMany({
      where: { userId, isPublished: true },
      orderBy: { publishedAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.longFormPost.count({
      where: { userId, isPublished: true },
    }),
  ]);

  return {
    posts,
    pagination: {
      currentPage: page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
  };
}

export async function getScheduledLongFormPosts({
  userId,
}: {
  userId: User["id"];
}) {
  return prisma.longFormPost.findMany({
    where: { userId, status: "SCHEDULED" },
    include: {
      queueType: true,
    },
    orderBy: { scheduledFor: "asc" },
  });
}

export async function getLongFormPostsByIds({
  ids,
  userId,
}: {
  ids: string[];
  userId: User["id"];
}) {
  return prisma.longFormPost.findMany({
    where: {
      id: {
        in: ids,
      },
      userId,
    },
  });
}

export async function getCronDueScheduledLongFormPosts(): Promise<
  LongFormPost[]
> {
  const now = Math.floor(Date.now() / 1000).toString();
  return prisma.longFormPost.findMany({
    where: {
      status: "SCHEDULED",
      isScheduled: true,
      isPublished: false,
      scheduledFor: {
        lte: now,
      },
    },
  });
}

export async function updateLongFormPostStatus({
  id,
  userId,
  isPublished,
}: {
  id: string;
  userId: string;
  isPublished: boolean;
}): Promise<LongFormPost> {
  return prisma.longFormPost.update({
    where: {
      id,
      userId,
    },
    data: {
      isPublished,
      status: isPublished ? "ACTIVE" : "SCHEDULED",
      postedAt: isPublished ? new Date() : null,
    },
  });
}

export async function getPastLongFormPosts({
  userId,
  startDate,
  endDate,
  queueType,
}: {
  userId: string;
  startDate: Date;
  endDate: Date;
  queueType?: string;
}): Promise<LongFormPost[]> {
  const whereClause: Prisma.LongFormPostWhereInput = {
    userId,
    // Look for posts that are published OR have active status
    AND: [
      {
        OR: [
          { isPublished: true },
          { status: "ACTIVE" }
        ],
      },
      {
        // Check both postedAt and publishedAt for date filtering
        OR: [
          {
            postedAt: {
              gte: startDate,
              lte: endDate,
              not: null,
            },
          },
          {
            postedAt: null,
            publishedAt: {
              gte: startDate,
              lte: endDate,
              not: null,
            },
            // Only use publishedAt if the post is actually published
            isPublished: true,
          },
        ],
      },
    ],
  };

  // Add queue type filter if specified
  if (queueType && queueType !== "all") {
    whereClause.queueType = {
      name: queueType,
    };
  }

  return prisma.longFormPost.findMany({
    where: whereClause,
    include: {
      queueType: true,
    },
    orderBy: {
      postedAt: "desc",
    },
  });
}
