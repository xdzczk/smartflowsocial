/**
 * LongFormPost read-only queries.
 */

import type { LongFormPost, User, Prisma } from "@prisma/client";

import { logError } from "~/lib/error-logger.server";
import { prisma } from "~/lib/prisma.server";

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
    // Use currentState as single source of truth
    where.currentState = isPublished ? "PUBLISHED" : { not: "PUBLISHED" };
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

export async function getDraftLongFormPosts({
  userId,
  page = 1,
  limit = 20,
}: {
  userId: User["id"];
  page?: number;
  limit?: number;
}) {
  const skip = (page - 1) * limit;

  const [posts, total] = await Promise.all([
    prisma.longFormPost.findMany({
      where: {
        userId,
        // Use currentState as single source of truth
        currentState: "DRAFT",
      },
      include: {
        queueType: true,
      },
      orderBy: { updatedAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.longFormPost.count({
      where: {
        userId,
        // Use currentState as single source of truth
        currentState: "DRAFT",
      },
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

export async function getPublishedLongFormPosts({
  userId,
  page = 1,
  limit = 10,
  publishedFromUtc,
  publishedToUtc,
}: {
  userId: User["id"];
  page?: number;
  limit?: number;
  /** Filter by published date range (inclusive). Used for Published page date filter. */
  publishedFromUtc?: Date;
  publishedToUtc?: Date;
}) {
  const skip = (page - 1) * limit;

  const where: Prisma.LongFormPostWhereInput = {
    userId,
    currentState: "PUBLISHED",
  };
  if (publishedFromUtc !== undefined || publishedToUtc !== undefined) {
    where.publishedAt = {
      ...(publishedFromUtc !== undefined && { gte: publishedFromUtc }),
      ...(publishedToUtc !== undefined && { lte: publishedToUtc }),
    };
  }

  const [posts, total] = await Promise.all([
    prisma.longFormPost.findMany({
      where,
      include: { queueType: true },
      orderBy: { publishedAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.longFormPost.count({ where }),
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
  page = 1,
  limit = 20,
  since,
  afterScheduledAtUtc,
  queueType,
  scheduledFromUtc,
  scheduledToUtc,
  excludePausedQueueContent = false,
}: {
  userId: User["id"];
  page?: number;
  limit?: number;
  since?: number; // Unix timestamp in milliseconds for delta sync
  /** When set, return only posts with scheduledAtUtc > this date (for cursor-based load more). */
  afterScheduledAtUtc?: Date;
  queueType?: string;
  /** Filter by scheduled date range (inclusive). Used for Scheduled page date filter. */
  scheduledFromUtc?: Date;
  scheduledToUtc?: Date;
  excludePausedQueueContent?: boolean;
}) {
  try {
    const skip = afterScheduledAtUtc ? 0 : (page - 1) * limit;

    const where: Prisma.LongFormPostWhereInput = {
      userId,
      // Use currentState as single source of truth
      currentState: "SCHEDULED",
    };

    // Add delta sync filter if since timestamp is provided
    if (since !== undefined) {
      const sinceDate = new Date(since);
      where.updatedAt = {
        gte: sinceDate,
      };
    }

    // Cursor-based: only posts after this date (for Flow load more future)
    if (afterScheduledAtUtc !== undefined) {
      where.scheduledAtUtc = {
        gt: afterScheduledAtUtc,
      };
    }

    // Date range filter (Scheduled page): inclusive [scheduledFromUtc, scheduledToUtc]
    if (scheduledFromUtc !== undefined || scheduledToUtc !== undefined) {
      where.scheduledAtUtc = {
        ...(where.scheduledAtUtc as Prisma.DateTimeFilter),
        ...(scheduledFromUtc !== undefined && { gte: scheduledFromUtc }),
        ...(scheduledToUtc !== undefined && { lte: scheduledToUtc }),
      };
    }

    // Add queue type filter if specified ("unassigned" = no queue, else filter by queue name)
    if (queueType && queueType !== "all") {
      if (queueType === "unassigned") {
        where.queueTypeId = null;
      } else {
        where.queueType = { name: queueType };
      }
    }

    if (excludePausedQueueContent) {
      const pausedQueueExclusion: Prisma.LongFormPostWhereInput = {
        OR: [
          { queueTypeId: null },
          { queueType: { status: { not: "PAUSED" } } },
        ],
      };
      where.AND = [
        ...(Array.isArray(where.AND)
          ? where.AND
          : where.AND
            ? [where.AND]
            : []),
        pausedQueueExclusion,
      ];
    }

    const [posts, total] = await Promise.all([
      prisma.longFormPost.findMany({
        where,
        include: {
          queueType: true,
        },
        orderBy: { scheduledAtUtc: "asc" },
        skip,
        take: limit,
      }),
      prisma.longFormPost.count({ where }),
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
  } catch (error) {
    logError(error instanceof Error ? error : new Error(String(error)), {
      message: "Error fetching scheduled longform posts",
      userId,
    });
    return {
      posts: [],
      pagination: {
        currentPage: 1,
        limit,
        total: 0,
        pages: 0,
      },
    };
  }
}

/**
 * Returns longform posts (scheduled and published) with scheduledAtUtc in the given UTC range (inclusive).
 * Used for Next 7 days schedule overview: shows both upcoming and past posts per day.
 * Respects queueType filter.
 */
export async function getScheduledLongFormPostsInDateRange({
  userId,
  queueType,
  fromUtc,
  toUtc,
}: {
  userId: string;
  queueType?: string;
  fromUtc: Date;
  toUtc: Date;
}): Promise<
  Array<{
    scheduledAtUtc: Date | null;
    queueType: { name: string } | null;
  }>
> {
  try {
    const where: Prisma.LongFormPostWhereInput = {
      userId,
      currentState: { in: ["SCHEDULED", "PUBLISHED"] },
      scheduledAtUtc: {
        gte: fromUtc,
        lte: toUtc,
      },
    };
    if (queueType && queueType !== "all") {
      if (queueType === "unassigned") {
        where.queueTypeId = null;
      } else {
        where.queueType = { name: queueType };
      }
    }
    return await prisma.longFormPost.findMany({
      where,
      select: {
        scheduledAtUtc: true,
        queueType: { select: { name: true } },
      },
    });
  } catch (error) {
    logError(error instanceof Error ? error : new Error(String(error)), {
      message: "Error fetching scheduled longform posts in date range",
      userId,
    });
    return [];
  }
}

/**
 * Returns the latest scheduledAtUtc among future scheduled longform posts (for runway KPI).
 * Respects queueType filter; use queueType "all" for no filter.
 */
export async function getLatestScheduledLongFormAtUtc({
  userId,
  queueType = "all",
  now,
}: {
  userId: User["id"];
  queueType?: string;
  now: Date;
}): Promise<Date | null> {
  const where: Prisma.LongFormPostWhereInput = {
    userId,
    currentState: "SCHEDULED",
    scheduledAtUtc: { gt: now },
  };
  if (queueType && queueType !== "all") {
    if (queueType === "unassigned") {
      where.queueTypeId = null;
    } else {
      where.queueType = { name: queueType };
    }
  }
  const post = await prisma.longFormPost.findFirst({
    where,
    orderBy: { scheduledAtUtc: "desc" },
    select: { scheduledAtUtc: true },
  });
  return post?.scheduledAtUtc ?? null;
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

export function getCronDueScheduledLongFormPosts(): Promise<LongFormPost[]> {
  const now = new Date();
  return prisma.longFormPost.findMany({
    where: {
      // Use currentState as single source of truth
      currentState: "SCHEDULED",
      queueHoldStatus: "NONE",
      scheduledAtUtc: {
        lte: now,
      },
      OR: [{ queueTypeId: null }, { queueType: { status: { not: "PAUSED" } } }],
    },
  });
}

export function getPastLongFormPosts({
  userId,
  startDate,
  endDate,
  queueType,
  beforeDate,
  limit: takeLimit,
  excludePausedQueueContent = false,
}: {
  userId: string;
  startDate: Date;
  endDate: Date;
  queueType?: string;
  /** When set, return only posts with postedAt < beforeDate (for Flow load more past). */
  beforeDate?: Date;
  /** Max number of posts to return (for Flow load more past). */
  limit?: number;
  excludePausedQueueContent?: boolean;
}): Promise<LongFormPost[]> {
  const whereClause: Prisma.LongFormPostWhereInput = {
    userId,
    currentState: "PUBLISHED",
    ...(beforeDate
      ? {
          OR: [
            {
              postedAt: { gte: startDate, lt: beforeDate, not: null },
            },
            {
              publishedAt: { gte: startDate, lt: beforeDate, not: null },
            },
          ],
        }
      : {
          OR: [
            {
              postedAt: {
                gte: startDate,
                lte: endDate,
                not: null,
              },
            },
            {
              publishedAt: {
                gte: startDate,
                lte: endDate,
                not: null,
              },
            },
          ],
        }),
  };

  if (queueType && queueType !== "all") {
    if (queueType === "unassigned") {
      whereClause.queueTypeId = null;
    } else {
      whereClause.queueType = { name: queueType };
    }
  }

  if (excludePausedQueueContent) {
    const pausedQueueExclusion: Prisma.LongFormPostWhereInput = {
      OR: [{ queueTypeId: null }, { queueType: { status: { not: "PAUSED" } } }],
    };
    whereClause.AND = [
      ...(Array.isArray(whereClause.AND)
        ? whereClause.AND
        : whereClause.AND
          ? [whereClause.AND]
          : []),
      pausedQueueExclusion,
    ];
  }

  return prisma.longFormPost.findMany({
    where: whereClause,
    include: {
      queueType: true,
    },
    orderBy: {
      postedAt: "desc",
    },
    ...(takeLimit !== undefined ? { take: takeLimit } : {}),
  });
}

export interface LongFormStatistics {
  scheduledCount: number;
  successCount: number;
}

export interface ScheduledLongFormCountByQueueRow {
  queueTypeId: string | null;
  count: number;
}

export async function getScheduledLongFormCountByQueue({
  userId,
}: {
  userId: string;
}): Promise<ScheduledLongFormCountByQueueRow[]> {
  try {
    const rows = await prisma.longFormPost.groupBy({
      by: ["queueTypeId"],
      where: {
        userId,
        currentState: "SCHEDULED",
      },
      _count: { id: true },
    });
    return rows.map((r) => ({
      queueTypeId: r.queueTypeId,
      count: r._count.id,
    }));
  } catch {
    return [];
  }
}

export async function getLongFormStatistics({
  userId,
}: {
  userId: string;
}): Promise<LongFormStatistics> {
  try {
    const [scheduledCount, successCount] = await Promise.all([
      prisma.longFormPost.count({
        where: {
          userId,
          currentState: "SCHEDULED",
        },
      }),
      prisma.longFormPost.count({
        where: {
          userId,
          currentState: "PUBLISHED",
        },
      }),
    ]);
    return { scheduledCount, successCount };
  } catch {
    return { scheduledCount: 0, successCount: 0 };
  }
}
