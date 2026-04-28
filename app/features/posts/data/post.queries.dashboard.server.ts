/**
 * Post Model - Dashboard / Listing Query Operations
 *
 * Read-only queries for scheduled, draft, published, recyclable posts,
 * counts, date ranges, and queue/statistics used by dashboard and listing UIs.
 */

import type { Prisma } from "@prisma/client";

import {
  parseDateRangeInTimezone,
  parseDateRangeUtc,
} from "~/lib/date-range.server";
import { logError } from "~/lib/error-logger.server";
import { prisma } from "~/lib/prisma.server";

import type {
  PostWithQueueType,
  PostsWithPagination,
  PostStatistics,
} from "./post.types";

export async function getScheduledPosts({
  userId,
  page = 1,
  limit = 20,
  queueType,
  since,
  afterScheduledAtUtc,
  afterScheduledAtUtcInclusive = false,
  contentTab,
  scheduledFromUtc,
  scheduledToUtc,
  excludePausedQueueContent = false,
}: {
  userId: string;
  page?: number;
  limit?: number;
  queueType?: string;
  since?: number; // Unix timestamp in milliseconds for delta sync
  /** When set, return only posts with scheduledAtUtc > this date (for cursor-based load more). */
  afterScheduledAtUtc?: Date;
  /** Use scheduledAtUtc >= cursor date. Flow pairs this with a composite cursor. */
  afterScheduledAtUtcInclusive?: boolean;
  /** When "reposts", only REPOST. When "posts", exclude REPOST. When "polls", postType POLL. When "all" or undefined, no filter. */
  contentTab?: "all" | "posts" | "reposts" | "polls";
  /** Filter by scheduled date range (inclusive). Used for Scheduled page date filter. */
  scheduledFromUtc?: Date;
  scheduledToUtc?: Date;
  excludePausedQueueContent?: boolean;
}): Promise<PostsWithPagination> {
  try {
    const skip = afterScheduledAtUtc ? 0 : (page - 1) * limit;

    const whereClause: Prisma.PostWhereInput = {
      // Use currentState as single source of truth
      currentState: "SCHEDULED",
      userId: userId,
    };

    if (contentTab === "reposts") {
      whereClause.postKind = "REPOST";
    } else if (contentTab === "posts") {
      whereClause.postKind = { not: "REPOST" };
    } else if (contentTab === "polls") {
      whereClause.postType = "POLL";
    }

    // Add delta sync filter if since timestamp is provided
    if (since !== undefined) {
      const sinceDate = new Date(since);
      whereClause.updatedAt = {
        gte: sinceDate,
      };
    }

    // Cursor-based: only posts after this date (for Flow load more future)
    if (afterScheduledAtUtc !== undefined) {
      whereClause.scheduledAtUtc = {
        [afterScheduledAtUtcInclusive ? "gte" : "gt"]: afterScheduledAtUtc,
      };
    }

    // Date range filter (Scheduled page): inclusive [scheduledFromUtc, scheduledToUtc]
    if (scheduledFromUtc !== undefined || scheduledToUtc !== undefined) {
      whereClause.scheduledAtUtc = {
        ...(whereClause.scheduledAtUtc as Prisma.DateTimeFilter),
        ...(scheduledFromUtc !== undefined && { gte: scheduledFromUtc }),
        ...(scheduledToUtc !== undefined && { lte: scheduledToUtc }),
      };
    }

    // Add queue type filter if specified ("unassigned" = no queue, else filter by queue name)
    if (queueType && queueType !== "all") {
      if (queueType === "unassigned") {
        whereClause.queueTypeId = null;
      } else {
        whereClause.queueType = { name: queueType };
      }
    }

    if (excludePausedQueueContent) {
      const pausedQueueExclusion: Prisma.PostWhereInput = {
        OR: [
          { queueTypeId: null },
          { queueType: { status: { not: "PAUSED" } } },
        ],
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

    const [posts, total] = await Promise.all([
      prisma.post.findMany({
        where: whereClause,
        include: {
          queueType: true,
          hashTagPreset: true,
          template: true,
          repostOf: { select: { fileUrl: true, postType: true } },
        },
        orderBy: [{ scheduledAtUtc: "asc" }, { id: "asc" }],
        skip,
        take: limit,
      }),
      prisma.post.count({
        where: whereClause,
      }),
    ]);

    return {
      posts,
      pagination: {
        total,
        pages: Math.ceil(total / limit),
        currentPage: page,
        limit,
      },
    };
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logError(err, {
      message: "Error fetching scheduled posts",
      userId,
      queueType,
    });
    throw err;
  }
}

/**
 * Count of scheduled posts that are reposts (postKind REPOST).
 * Used for tab counts so they are complete before all pages are loaded.
 */
export async function getScheduledRepostsCount({
  userId,
  queueType,
  scheduledFromUtc,
  scheduledToUtc,
  excludePausedQueueContent = false,
}: {
  userId: string;
  queueType?: string;
  scheduledFromUtc?: Date;
  scheduledToUtc?: Date;
  excludePausedQueueContent?: boolean;
}): Promise<number> {
  const whereClause: Prisma.PostWhereInput = {
    currentState: "SCHEDULED",
    userId,
    postKind: "REPOST",
  };
  if (scheduledFromUtc !== undefined || scheduledToUtc !== undefined) {
    whereClause.scheduledAtUtc = {
      ...(scheduledFromUtc !== undefined && { gte: scheduledFromUtc }),
      ...(scheduledToUtc !== undefined && { lte: scheduledToUtc }),
    };
  }
  if (queueType && queueType !== "all") {
    if (queueType === "unassigned") {
      whereClause.queueTypeId = null;
    } else {
      whereClause.queueType = { name: queueType };
    }
  }
  if (excludePausedQueueContent) {
    const pausedQueueExclusion: Prisma.PostWhereInput = {
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
  return prisma.post.count({ where: whereClause });
}

/**
 * Returns posts (scheduled and published) with scheduledAtUtc in the given UTC range (inclusive).
 * Used for Next 7 days schedule overview: shows both upcoming and past posts per day.
 * Respects queueType filter. Excludes posts on paused queues (same as runway / active calendar).
 */
export async function getScheduledPostsInDateRange({
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
    const pausedQueueExclusion: Prisma.PostWhereInput = {
      OR: [{ queueTypeId: null }, { queueType: { status: { not: "PAUSED" } } }],
    };
    const whereClause: Prisma.PostWhereInput = {
      currentState: { in: ["SCHEDULED", "PUBLISHED"] },
      userId,
      repost: false,
      scheduledAtUtc: {
        gte: fromUtc,
        lte: toUtc,
      },
      AND: [pausedQueueExclusion],
    };
    if (queueType && queueType !== "all") {
      if (queueType === "unassigned") {
        whereClause.queueTypeId = null;
      } else {
        whereClause.queueType = { name: queueType };
      }
    }
    return await prisma.post.findMany({
      where: whereClause,
      select: {
        scheduledAtUtc: true,
        queueType: { select: { name: true } },
      },
    });
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logError(err, {
      message: "Error fetching scheduled posts in date range",
      userId,
      queueType,
    });
    throw err;
  }
}

/**
 * Returns the latest scheduledAtUtc among future scheduled posts (for runway KPI).
 * Respects queueType filter; use queueType "all" for no filter.
 */
export async function getLatestScheduledAtUtc({
  userId,
  queueType = "all",
  now,
  excludePausedQueueContent = false,
}: {
  userId: string;
  queueType?: string;
  now: Date;
  excludePausedQueueContent?: boolean;
}): Promise<Date | null> {
  const whereClause: Prisma.PostWhereInput = {
    userId,
    currentState: "SCHEDULED",
    scheduledAtUtc: { gt: now },
  };
  if (queueType && queueType !== "all") {
    if (queueType === "unassigned") {
      whereClause.queueTypeId = null;
    } else {
      whereClause.queueType = { name: queueType };
    }
  }
  if (excludePausedQueueContent) {
    const pausedQueueExclusion: Prisma.PostWhereInput = {
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
  const post = await prisma.post.findFirst({
    where: whereClause,
    orderBy: { scheduledAtUtc: "desc" },
    select: { scheduledAtUtc: true },
  });
  return post?.scheduledAtUtc ?? null;
}

export async function getDraftPosts({
  userId,
  page = 1,
  limit = 20,
  queueType,
}: {
  userId: string;
  page?: number;
  limit?: number;
  queueType?: string;
}): Promise<PostsWithPagination> {
  const skip = (page - 1) * limit;

  const whereClause: Prisma.PostWhereInput = {
    // Use currentState as single source of truth
    currentState: "DRAFT",
    userId: userId,
    // Exclude posts that belong to a bulk draft group (they appear under Bulk tab)
    draftGroupId: null,
  };

  // Add queue type filter if specified ("unassigned" = no queue, else filter by queue name)
  if (queueType && queueType !== "all") {
    if (queueType === "unassigned") {
      whereClause.queueTypeId = null;
    } else {
      whereClause.queueType = { name: queueType };
    }
  }

  const [posts, total] = await Promise.all([
    prisma.post.findMany({
      where: whereClause,
      include: {
        queueType: true,
        hashTagPreset: true,
        template: true,
      },
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      skip,
      take: limit,
    }),
    prisma.post.count({
      where: whereClause,
    }),
  ]);

  return {
    posts,
    pagination: {
      total,
      pages: Math.ceil(total / limit),
      currentPage: page,
      limit,
    },
  };
}

export async function getPublishedPosts({
  userId,
  page = 1,
  limit = 50,
  queueType,
  publishedFromUtc,
  publishedToUtc,
}: {
  userId: string;
  page?: number;
  limit?: number;
  queueType?: string;
  /** Filter by published date range (inclusive). Used for Published page date filter. */
  publishedFromUtc?: Date;
  publishedToUtc?: Date;
}): Promise<PostsWithPagination> {
  const skip = (page - 1) * limit;

  const whereClause: Prisma.PostWhereInput = {
    // Use currentState as single source of truth
    currentState: "PUBLISHED",
    userId: userId,
  };

  if (publishedFromUtc !== undefined || publishedToUtc !== undefined) {
    whereClause.publishedAt = {
      ...(publishedFromUtc !== undefined && { gte: publishedFromUtc }),
      ...(publishedToUtc !== undefined && { lte: publishedToUtc }),
    };
  }

  // Add queue type filter if specified ("unassigned" = no queue, else filter by queue name)
  if (queueType && queueType !== "all") {
    if (queueType === "unassigned") {
      whereClause.queueTypeId = null;
    } else {
      whereClause.queueType = { name: queueType };
    }
  }

  const [posts, total] = await Promise.all([
    prisma.post.findMany({
      where: whereClause,
      include: {
        queueType: true,
        repostOf: { select: { fileUrl: true, postType: true } },
      },
      orderBy: {
        publishedAt: "desc",
      },
      skip,
      take: limit,
    }),
    prisma.post.count({
      where: whereClause,
    }),
  ]);

  return {
    posts,
    pagination: {
      total,
      pages: Math.ceil(total / limit),
      currentPage: page,
      limit,
    },
  };
}

/**
 * Count of published posts that are reposts (postKind REPOST).
 * Used for tab counts so they are complete before all pages are loaded.
 */
export async function getPublishedRepostsCount({
  userId,
  queueType,
  publishedFromUtc,
  publishedToUtc,
}: {
  userId: string;
  queueType?: string;
  publishedFromUtc?: Date;
  publishedToUtc?: Date;
}): Promise<number> {
  const whereClause: Prisma.PostWhereInput = {
    currentState: "PUBLISHED",
    userId,
    postKind: "REPOST",
  };
  if (publishedFromUtc !== undefined || publishedToUtc !== undefined) {
    whereClause.publishedAt = {
      ...(publishedFromUtc !== undefined && { gte: publishedFromUtc }),
      ...(publishedToUtc !== undefined && { lte: publishedToUtc }),
    };
  }
  if (queueType && queueType !== "all") {
    if (queueType === "unassigned") {
      whereClause.queueTypeId = null;
    } else {
      whereClause.queueType = { name: queueType };
    }
  }
  return prisma.post.count({ where: whereClause });
}

export async function getRecentPublishedPosts({
  userId,
  days,
  queueType,
  queueTypeId,
  since,
  publishedFrom,
  publishedTo,
}: {
  userId: string;
  days: number;
  queueType?: string;
  /** Filter by queue id (takes precedence over queueType name). */
  queueTypeId?: string;
  since?: number; // Unix timestamp in milliseconds for delta sync
  /** Optional absolute eligibility window start (UTC). */
  publishedFrom?: Date;
  /** Optional absolute eligibility window end (UTC). */
  publishedTo?: Date;
}): Promise<PostWithQueueType[]> {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const whereClause: Prisma.PostWhereInput = {
    currentState: "PUBLISHED",
    userId: userId,
    publishedAt:
      publishedFrom !== undefined || publishedTo !== undefined
        ? {
            ...(publishedFrom !== undefined && { gte: publishedFrom }),
            ...(publishedTo !== undefined && { lte: publishedTo }),
          }
        : {
            gte: startDate,
          },
  };

  if (since !== undefined) {
    const sinceDate = new Date(since);
    whereClause.updatedAt = { gte: sinceDate };
  }

  if (queueTypeId) {
    whereClause.queueTypeId = queueTypeId;
  } else if (queueType && queueType !== "all") {
    if (queueType === "unassigned") {
      whereClause.queueTypeId = null;
    } else {
      whereClause.queueType = { name: queueType };
    }
  }

  return await prisma.post.findMany({
    where: whereClause,
    include: {
      queueType: true,
      hashTagPreset: true,
      template: true,
    },
    orderBy: {
      publishedAt: "desc",
    },
  });
}

export interface ScheduledCountByQueueRow {
  queueTypeId: string | null;
  count: number;
}

export async function getScheduledPostsCountByQueue({
  userId,
}: {
  userId: string;
}): Promise<ScheduledCountByQueueRow[]> {
  try {
    const rows = await prisma.post.groupBy({
      by: ["queueTypeId"],
      where: {
        userId,
        currentState: "SCHEDULED",
        repost: false,
      },
      _count: { id: true },
    });
    return rows.map((r) => ({
      queueTypeId: r.queueTypeId,
      count: r._count.id,
    }));
  } catch (error) {
    logError(error instanceof Error ? error : new Error(String(error)), {
      message: "Error fetching scheduled posts count by queue",
      userId,
    });
    return [];
  }
}

export async function getPostStatistics({
  userId,
}: {
  userId: string;
}): Promise<PostStatistics> {
  try {
    const [scheduledCount, successCount] = await Promise.all([
      // Get count of scheduled posts (exclude reposts; only posts, articles, quotes)
      prisma.post.count({
        where: {
          userId,
          currentState: "SCHEDULED",
          repost: false,
          /** Dashboard KPI / activity: exclude posts held while their queue is paused */
          queueHoldStatus: { not: "HELD_BY_QUEUE" },
        },
      }),

      // Get count of successfully posted (exclude reposts)
      prisma.post.count({
        where: {
          userId,
          currentState: "PUBLISHED",
          repost: false,
        },
      }),
    ]);

    return {
      scheduledCount,
      successCount,
    };
  } catch (error) {
    // Log error but return safe defaults
    logError(error instanceof Error ? error : new Error(String(error)), {
      message: "Error fetching post statistics",
      userId,
    });
    return {
      scheduledCount: 0,
      successCount: 0,
    };
  }
}

/** Parse "olderThan" URL value (e.g. 1m, 12m, 1y, 3y) into a cutoff Date (posts with published_at < cutoff). */
function parseOlderThanCutoff(
  olderThan: string | null | undefined
): Date | null {
  if (!olderThan || typeof olderThan !== "string") return null;
  const m = olderThan.match(/^(\d+)(m|y)$/i);
  if (m?.[1] == null || m[2] == null) return null;
  const n = parseInt(m[1], 10);
  const unit = m[2].toLowerCase();
  if (unit === "m") {
    if (n < 1 || n > 12) return null;
    const d = new Date();
    d.setMonth(d.getMonth() - n);
    return d;
  }
  if (unit === "y") {
    if (n < 1 || n > 3) return null;
    const d = new Date();
    d.setFullYear(d.getFullYear() - n);
    return d;
  }
  return null;
}

export async function getRecyclablePosts({
  userId,
  page = 1,
  limit = 50,
  queueType,
  dateFrom,
  dateTo,
  timezone,
  olderThan,
}: {
  userId: string;
  page?: number;
  limit?: number;
  queueType?: string;
  dateFrom?: string | null;
  dateTo?: string | null;
  /** When set, interpret dateFrom/dateTo as calendar days in this timezone. */
  timezone?: string | null;
  /** When set, only posts with published_at < cutoff (e.g. "6m", "1y", "3y"). */
  olderThan?: string | null;
}): Promise<PostsWithPagination> {
  const skip = (page - 1) * limit;

  const whereClause: Prisma.PostWhereInput = {
    isRecyclable: true,
    // Use currentState as single source of truth
    currentState: "PUBLISHED",
    userId: userId,
  };

  // Add queue type filter if specified ("unassigned" = no queue, else filter by queue name)
  if (queueType && queueType !== "all") {
    if (queueType === "unassigned") {
      whereClause.queueTypeId = null;
    } else {
      whereClause.queueType = { name: queueType };
    }
  }

  // Older than filter: published_at < cutoff
  const olderThanCutoff = parseOlderThanCutoff(olderThan);
  if (olderThanCutoff) {
    whereClause.publishedAt = {
      ...(whereClause.publishedAt as Prisma.DateTimeFilter | undefined),
      lt: olderThanCutoff,
    };
  }

  // Filter by published date range (inclusive); use user timezone when provided
  const tz = timezone?.trim();
  const dateRange = tz
    ? parseDateRangeInTimezone(dateFrom, dateTo, tz)
    : parseDateRangeUtc(dateFrom, dateTo);
  if (dateRange?.fromUtc ?? dateRange?.toUtc) {
    whereClause.publishedAt = {
      ...(whereClause.publishedAt as Prisma.DateTimeFilter | undefined),
    };
    if (dateRange.fromUtc)
      (whereClause.publishedAt as Prisma.DateTimeFilter).gte =
        dateRange.fromUtc;
    if (dateRange.toUtc)
      (whereClause.publishedAt as Prisma.DateTimeFilter).lte = dateRange.toUtc;
  }

  const [posts, total] = await Promise.all([
    prisma.post.findMany({
      where: whereClause,
      include: {
        queueType: true,
      },
      orderBy: {
        publishedAt: "desc",
      },
      skip,
      take: limit,
    }),
    prisma.post.count({
      where: whereClause,
    }),
  ]);

  return {
    posts,
    pagination: {
      total,
      pages: Math.ceil(total / limit),
      currentPage: page,
      limit,
    },
  };
}

export async function getLastPostTimeForQueue({
  userId,
  queueTypeName,
  queueTypeId,
}: {
  userId: string;
  queueTypeName?: string;
  queueTypeId?: string;
}): Promise<Date | null> {
  let queueType;

  if (queueTypeId) {
    // Direct lookup by ID (preferred method)
    queueType = await prisma.queueType.findFirst({
      where: {
        id: queueTypeId,
        userId, // Ensure the queue belongs to the user
      },
      select: {
        id: true,
        scheduleType: true,
        name: true,
      },
    });
  } else if (queueTypeName) {
    // Fallback to name-based lookup
    queueType = await prisma.queueType.findFirst({
      where: {
        userId,
        name: queueTypeName,
      },
      select: {
        id: true,
        scheduleType: true,
        name: true,
      },
    });
  }

  if (!queueType) {
    return null; // Queue type doesn't exist
  }

  // For FIXED_SLOTS and WEEKLY_SLOTS, consider ALL scheduled posts (both posted and unposted).
  // For INTERVAL, only consider unposted posts.
  // Use nominalScheduledAtUtc when present (random window) so queue "next slot" doesn't drift.
  if (queueType.scheduleType === "INTERVAL") {
    const raw = await prisma.$queryRawUnsafe<Array<{ effective_at: Date }>>(
      `SELECT COALESCE("nominalScheduledAtUtc", "scheduledAtUtc") AS effective_at
       FROM "Post"
       WHERE "userId" = $1 AND "queueTypeId" = $2
         AND "currentState" = 'SCHEDULED'
         AND "queueHoldStatus" = 'NONE'
         AND "dependencyMode" = 'standalone'
         AND "scheduledAtUtc" IS NOT NULL
       ORDER BY effective_at DESC
       LIMIT 1`,
      userId,
      queueType.id
    );
    return raw[0]?.effective_at ?? null;
  }

  const raw = await prisma.$queryRawUnsafe<Array<{ effective_at: Date }>>(
    `SELECT COALESCE("nominalScheduledAtUtc", "scheduledAtUtc") AS effective_at
     FROM "Post"
     WHERE "userId" = $1 AND "queueTypeId" = $2
       AND "currentState" IN ('SCHEDULED', 'PUBLISHED')
       AND ("currentState" <> 'SCHEDULED' OR "queueHoldStatus" = 'NONE')
       AND "dependencyMode" = 'standalone'
       AND "scheduledAtUtc" IS NOT NULL
     ORDER BY effective_at DESC
     LIMIT 1`,
    userId,
    queueType.id
  );
  return raw[0]?.effective_at ?? null;
}
