/**
 * Post Model - Query Operations (Reads)
 *
 * This module provides read-only database query operations for Post entities.
 * All functions in this file perform SELECT operations only.
 */

import type { Prisma, Post } from "@prisma/client";

import { parseDateRangeUtc } from "~/lib/date-range.server";
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
  contentTab,
  scheduledFromUtc,
  scheduledToUtc,
}: {
  userId: string;
  page?: number;
  limit?: number;
  queueType?: string;
  since?: number; // Unix timestamp in milliseconds for delta sync
  /** When set, return only posts with scheduledAtUtc > this date (for cursor-based load more). */
  afterScheduledAtUtc?: Date;
  /** When "reposts", only REPOST. When "posts", exclude REPOST. When "all" or undefined, no filter. */
  contentTab?: "all" | "posts" | "reposts";
  /** Filter by scheduled date range (inclusive). Used for Scheduled page date filter. */
  scheduledFromUtc?: Date;
  scheduledToUtc?: Date;
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
        gt: afterScheduledAtUtc,
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

    const [posts, total] = await Promise.all([
      prisma.post.findMany({
        where: whereClause,
        include: {
          queueType: true,
          hashTagPreset: true,
          template: true,
          repostOf: { select: { fileUrl: true, postType: true } },
        },
        orderBy: {
          scheduledAtUtc: "asc",
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
}: {
  userId: string;
  queueType?: string;
  scheduledFromUtc?: Date;
  scheduledToUtc?: Date;
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
  return prisma.post.count({ where: whereClause });
}

/**
 * Returns posts (scheduled and published) with scheduledAtUtc in the given UTC range (inclusive).
 * Used for Next 7 days schedule overview: shows both upcoming and past posts per day.
 * Respects queueType filter.
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
    const whereClause: Prisma.PostWhereInput = {
      currentState: { in: ["SCHEDULED", "PUBLISHED"] },
      userId,
      repost: false,
      scheduledAtUtc: {
        gte: fromUtc,
        lte: toUtc,
      },
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
}: {
  userId: string;
  queueType?: string;
  now: Date;
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
      orderBy: {
        createdAt: "desc",
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

export function getCronDueScheduledPosts(): Promise<Post[]> {
  const now = new Date();
  return prisma.post.findMany({
    where: {
      // Use currentState as single source of truth
      currentState: "SCHEDULED",
      scheduledAtUtc: {
        lte: now,
      },
    },
  });
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
  since,
}: {
  userId: string;
  days: number;
  queueType?: string;
  since?: number; // Unix timestamp in milliseconds for delta sync
}): Promise<PostWithQueueType[]> {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const whereClause: Prisma.PostWhereInput = {
    // Use currentState as single source of truth
    currentState: "PUBLISHED",
    userId: userId,
    publishedAt: {
      gte: startDate,
    },
  };

  // Add delta sync filter if since timestamp is provided
  if (since !== undefined) {
    const sinceDate = new Date(since);
    whereClause.updatedAt = {
      gte: sinceDate,
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

export function getPastPosts({
  userId,
  startDate,
  endDate,
  queueType,
  beforeDate,
  limit: takeLimit,
  contentTab,
}: {
  userId: string;
  startDate: Date;
  endDate: Date;
  queueType?: string;
  /** When set, return only posts with publishedAt < beforeDate (for Flow load more past). */
  beforeDate?: Date;
  /** Max number of posts to return (for Flow load more past). */
  limit?: number;
  /** When "reposts", only REPOST. When "posts", exclude REPOST. When "all" or undefined, no filter. */
  contentTab?: "all" | "posts" | "reposts";
}): Promise<PostWithQueueType[]> {
  const whereClause: Prisma.PostWhereInput = {
    userId,
    // Use currentState as single source of truth
    currentState: "PUBLISHED",
    publishedAt: beforeDate
      ? { gte: startDate, lt: beforeDate, not: null }
      : {
          gte: startDate,
          lte: endDate,
          not: null,
        },
  };

  if (contentTab === "reposts") {
    whereClause.postKind = "REPOST";
  } else if (contentTab === "posts") {
    whereClause.postKind = { not: "REPOST" };
  }

  // Add queue type filter if specified ("unassigned" = no queue, else filter by queue name)
  if (queueType && queueType !== "all") {
    if (queueType === "unassigned") {
      whereClause.queueTypeId = null;
    } else {
      whereClause.queueType = { name: queueType };
    }
  }

  return prisma.post.findMany({
    where: whereClause,
    include: {
      queueType: true,
      hashTagPreset: true,
      template: true,
      repostOf: { select: { fileUrl: true, postType: true } },
    },
    orderBy: {
      publishedAt: "desc",
    },
    ...(takeLimit !== undefined ? { take: takeLimit } : {}),
  });
}

export function getPostById({
  id,
  userId,
}: {
  id: string;
  userId: string;
}): Promise<Post | null> {
  return prisma.post.findFirst({
    where: {
      id,
      userId,
    },
    include: {
      queueType: true,
      hashTagPreset: true,
      template: true,
    },
  });
}

export function getPostsByIds({
  ids,
  userId,
}: {
  ids: string[];
  userId: string;
}): Promise<PostWithQueueType[]> {
  return prisma.post.findMany({
    where: {
      id: {
        in: ids,
      },
      userId,
    },
    include: {
      queueType: true,
      hashTagPreset: true,
      template: true,
    },
  });
}

export async function getRecyclablePosts({
  userId,
  page = 1,
  limit = 50,
  queueType,
  dateFrom,
  dateTo,
}: {
  userId: string;
  page?: number;
  limit?: number;
  queueType?: string;
  dateFrom?: string | null;
  dateTo?: string | null;
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

  // Filter by published date range (inclusive)
  const dateRange = parseDateRangeUtc(dateFrom, dateTo);
  if (dateRange?.fromUtc || dateRange?.toUtc) {
    whereClause.publishedAt = {};
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

  // For FIXED_SLOTS and WEEKLY_SLOTS, consider ALL scheduled posts (both posted and unposted)
  // to find the actual last scheduled time. For INTERVAL, only consider unposted posts.
  const whereCondition: Prisma.PostWhereInput = {
    userId,
    queueTypeId: queueType.id,
    // Use currentState as single source of truth
    // For INTERVAL: only include SCHEDULED (not yet published)
    // For FIXED_SLOTS and WEEKLY_SLOTS: include both SCHEDULED and PUBLISHED
    currentState:
      queueType.scheduleType === "INTERVAL"
        ? "SCHEDULED"
        : { in: ["SCHEDULED", "PUBLISHED"] },
    scheduledAtUtc: {
      not: null,
    },
  };

  // Get the most recent scheduled post for this queue
  const lastPost = await prisma.post.findFirst({
    where: whereCondition,
    orderBy: {
      scheduledAtUtc: "desc",
    },
    select: {
      scheduledAtUtc: true,
    },
  });

  if (!lastPost?.scheduledAtUtc) {
    return null;
  }

  return lastPost.scheduledAtUtc;
}
