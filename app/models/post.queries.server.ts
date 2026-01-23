/**
 * Post Model - Query Operations (Reads)
 *
 * This module provides read-only database query operations for Post entities.
 * All functions in this file perform SELECT operations only.
 */

import type { Prisma, Post } from "@prisma/client";

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
}: {
  userId: string;
  page?: number;
  limit?: number;
  queueType?: string;
}): Promise<PostsWithPagination> {
  try {
    const skip = (page - 1) * limit;

    const whereClause: Prisma.PostWhereInput = {
      // Use currentState as single source of truth
      currentState: "SCHEDULED",
      userId: userId,
    };

    // Add queue type filter if specified
    if (queueType && queueType !== "all") {
      whereClause.queueType = {
        name: queueType,
      };
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
  };

  // Add queue type filter if specified
  if (queueType && queueType !== "all") {
    whereClause.queueType = {
      name: queueType,
    };
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

export async function getPostedPosts({
  userId,
  page = 1,
  limit = 50,
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
    currentState: "PUBLISHED",
    userId: userId,
  };

  // Add queue type filter if specified
  if (queueType && queueType !== "all") {
    whereClause.queueType = {
      name: queueType,
    };
  }

  const [posts, total] = await Promise.all([
    prisma.post.findMany({
      where: whereClause,
      include: {
        queueType: true,
      },
      orderBy: {
        postedAt: "desc",
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

export async function getRecentPostedPosts({
  userId,
  days,
  queueType,
}: {
  userId: string;
  days: number;
  queueType?: string;
}): Promise<PostWithQueueType[]> {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const whereClause: Prisma.PostWhereInput = {
    // Use currentState as single source of truth
    currentState: "PUBLISHED",
    userId: userId,
    postedAt: {
      gte: startDate,
    },
  };

  // Add queue type filter if specified
  if (queueType && queueType !== "all") {
    whereClause.queueType = {
      name: queueType,
    };
  }

  return await prisma.post.findMany({
    where: whereClause,
    include: {
      queueType: true,
      hashTagPreset: true,
      template: true,
    },
    orderBy: {
      postedAt: "desc",
    },
  });
}

export async function getPostStatistics({
  userId,
}: {
  userId: string;
}): Promise<PostStatistics> {
  try {
    const [scheduledCount, successCount] = await Promise.all([
      // Get count of scheduled posts
      prisma.post.count({
        where: {
          userId,
          // Use currentState as single source of truth
          currentState: "SCHEDULED",
        },
      }),

      // Get count of successfully posted
      prisma.post.count({
        where: {
          userId,
          // Use currentState as single source of truth
          currentState: "PUBLISHED",
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
}: {
  userId: string;
  startDate: Date;
  endDate: Date;
  queueType?: string;
}): Promise<PostWithQueueType[]> {
  const whereClause: Prisma.PostWhereInput = {
    userId,
    // Use currentState as single source of truth
    currentState: "PUBLISHED",
    postedAt: {
      gte: startDate,
      lte: endDate,
      not: null, // Ensure postedAt is not null
    },
  };

  // Add queue type filter if specified
  if (queueType && queueType !== "all") {
    whereClause.queueType = {
      name: queueType,
    };
  }

  return prisma.post.findMany({
    where: whereClause,
    include: {
      queueType: true,
      hashTagPreset: true,
      template: true,
    },
    orderBy: {
      postedAt: "desc",
    },
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
}: {
  userId: string;
  page?: number;
  limit?: number;
  queueType?: string;
}): Promise<PostsWithPagination> {
  const skip = (page - 1) * limit;

  const whereClause: Prisma.PostWhereInput = {
    isRecyclable: true,
    // Use currentState as single source of truth
    currentState: "PUBLISHED",
    userId: userId,
  };

  // Add queue type filter if specified
  if (queueType && queueType !== "all") {
    whereClause.queueType = {
      name: queueType,
    };
  }

  const [posts, total] = await Promise.all([
    prisma.post.findMany({
      where: whereClause,
      include: {
        queueType: true,
      },
      orderBy: {
        postedAt: "desc",
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

  // For FIXED_SLOTS scheduling, we need to consider ALL scheduled posts (both posted and unposted)
  // to find the actual last scheduled time, regardless of posting status
  // For INTERVAL scheduling, we can stick with the original logic of only considering unposted posts
  const whereCondition: Prisma.PostWhereInput = {
    userId,
    queueTypeId: queueType.id,
    // Use currentState as single source of truth
    // For FIXED_SLOTS: include both SCHEDULED and PUBLISHED (scheduled posts that were published)
    // For INTERVAL: only include SCHEDULED (not yet published)
    currentState:
      queueType.scheduleType === "INTERVAL"
        ? "SCHEDULED"
        : { in: ["SCHEDULED", "PUBLISHED"] }, // FIXED_SLOTS can include published posts
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
