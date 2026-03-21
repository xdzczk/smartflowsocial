/**
 * Post Model - Single-Post / By-ID Query Operations
 *
 * Read-only queries for fetching one or more posts by id (getPostById, getPostsByIds)
 * and past published posts (getPastPosts) used by Flow and detail views.
 */

import type { Prisma } from "@prisma/client";

import { prisma } from "~/lib/prisma.server";

import type { PostWithQueueType } from "./post.types";

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
  /** When "reposts", only REPOST. When "posts", exclude REPOST. When "polls", postType POLL. When "all" or undefined, no filter. */
  contentTab?: "all" | "posts" | "reposts" | "polls";
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
  } else if (contentTab === "polls") {
    whereClause.postType = "POLL";
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

export function getPostById({ id, userId }: { id: string; userId: string }) {
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
