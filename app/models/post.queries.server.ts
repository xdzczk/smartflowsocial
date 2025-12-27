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

export function getScheduledPosts({
  userId,
  queueType,
}: {
  userId: string;
  queueType?: string;
}): Promise<PostWithQueueType[]> {
  const whereClause: Prisma.PostWhereInput = {
    isScheduled: true,
    isPosted: false,
    draft: false,
    userId: userId,
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
      scheduledFor: "asc",
    },
  });
}

export function getDraftPosts({
  userId,
  queueType,
}: {
  userId: string;
  queueType?: string;
}): Promise<PostWithQueueType[]> {
  const whereClause: Prisma.PostWhereInput = {
    draft: true,
    isPosted: false,
    userId: userId,
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
      createdAt: "desc",
    },
  });
}

export function getCronDueScheduledPosts(): Promise<Post[]> {
  const now = Math.floor(Date.now() / 1000).toString();
  return prisma.post.findMany({
    where: {
      isScheduled: true,
      isPosted: false,
      scheduledFor: {
        lte: now,
      },
    },
  });
}

export function getPostedPosts({
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
    isPosted: true,
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

export function getRecentPostedPosts({
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
    isPosted: true,
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

  const posts = await prisma.post.findMany({
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

  return posts;
}

export async function getPostStatistics({
  userId,
}: {
  userId: string;
}): Promise<PostStatistics> {
  const [scheduledCount, successCount] = await Promise.all([
    // Get count of scheduled posts
    prisma.post.count({
      where: {
        userId,
        isPosted: false,
        isScheduled: true,
      },
    }),

    // Get count of successfully posted
    prisma.post.count({
      where: {
        userId,
        isPosted: true,
      },
    }),
  ]);

  return {
    scheduledCount,
    successCount,
  };
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
    // Look for posts that are either marked as posted OR have a posted status
    OR: [{ isPosted: true }, { status: "POSTED" }],
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

export function getRecyclablePosts({
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
    isPosted: true,
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
  const whereCondition = {
    userId,
    queueTypeId: queueType.id,
    isScheduled: true,
    NOT: {
      draft: true, // Exclude drafts
    },
    scheduledFor: {
      not: null, // Ensure scheduledFor is not null
    },
    // For FIXED_SLOTS: include both posted and unposted posts
    // For INTERVAL: only include unposted posts (original behavior)
    ...(queueType.scheduleType === "INTERVAL" && {
      isPosted: false, // Only for interval-based scheduling
    }),
  };

  // Get the most recent scheduled post for this queue
  const lastPost = await prisma.post.findFirst({
    where: whereCondition,
    orderBy: {
      scheduledFor: "desc", // Order by scheduled time to get the latest scheduled post
    },
    select: {
      scheduledFor: true,
      createdAt: true,
      isPosted: true,
    },
  });

  if (!lastPost?.scheduledFor) {
    return null;
  }

  // Convert scheduledFor string to Date
  // scheduledFor appears to be a Unix timestamp string
  try {
    const timestamp = parseInt(lastPost.scheduledFor);
    if (isNaN(timestamp)) {
      // If it's not a timestamp, try parsing as ISO string
      return new Date(lastPost.scheduledFor);
    }
    // Convert Unix timestamp (seconds) to Date
    const parsedDate = new Date(timestamp * 1000);

    return parsedDate;
  } catch (error) {
    logError(error instanceof Error ? error : new Error(String(error)), {
      postId: "id" in lastPost ? String(lastPost.id) : "unknown",
      scheduledFor: "scheduledFor" in lastPost ? String(lastPost.scheduledFor) : "unknown",
      message: "Error parsing scheduledFor",
    });
    return null;
  }
}



