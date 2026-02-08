/**
 * Post Read Model Queries
 *
 * Fast queries using denormalized read models for dashboard operations.
 * These queries are optimized for read-heavy operations like dashboards.
 */

import type { Prisma } from "@prisma/client";

import { prisma } from "~/lib/prisma.server";

/**
 * Get scheduled posts from read model (fast!)
 * Falls back to transactional table if read model is empty
 */
export async function getScheduledPostsFromReadModel({
  userId,
  queueType,
  useFallback = true,
}: {
  userId: string;
  queueType?: string;
  useFallback?: boolean;
}): Promise<
  Array<{
    id: string;
    userId: string;
    postId: string;
    caption: string | null;
    scheduledAtUtc: Date;
    queueTypeName: string;
    queueTypeColor: string | null;
    hashTagPresetId: string | null;
    templateId: string | null;
    createdAt: Date;
    updatedAt: Date;
  }>
> {
  const where: Prisma.ScheduledPostReadWhereInput = {
    userId,
  };

  if (queueType && queueType !== "all") {
    where.queueTypeName = queueType;
  }

  const readModelPosts = await prisma.scheduledPostRead.findMany({
    where,
    orderBy: { scheduledAtUtc: "asc" },
  });

  // If read model is empty and fallback is enabled, use transactional table
  if (readModelPosts.length === 0 && useFallback) {
    // This is a temporary fallback during migration
    // In production, you'd want to ensure read models are always populated

    // @ts-ignore - Dynamic imports work at runtime in CommonJS
    const queriesModule = await import("./post.queries.server");
    const postsResult = await queriesModule.getScheduledPosts({
      userId,
      queueType,
    });
    const posts =
      "posts" in postsResult && Array.isArray(postsResult.posts)
        ? postsResult.posts
        : [];

    return posts.map((post: (typeof posts)[0]) => ({
      id: post.id,
      userId: post.userId,
      postId: post.id,
      caption: post.caption,
      scheduledAtUtc: post.scheduledAtUtc ?? new Date(),
      queueTypeName: post.queueType?.name ?? "unassigned",
      queueTypeColor: post.queueType?.color ?? null,
      hashTagPresetId: post.hashTagPresetId,
      templateId: post.templateId,
      createdAt: post.createdAt,
      updatedAt: post.updatedAt,
    }));
  }

  return readModelPosts;
}

/**
 * Get published posts from read model (fast!)
 * Falls back to transactional table if read model is empty
 */
export async function getPublishedPostsFromReadModel({
  userId,
  queueType,
  page = 1,
  limit = 50,
  useFallback = true,
}: {
  userId: string;
  queueType?: string;
  page?: number;
  limit?: number;
  useFallback?: boolean;
}): Promise<{
  posts: Array<{
    id: string;
    userId: string;
    postId: string;
    caption: string | null;
    publishedAt: Date;
    queueTypeName: string;
    queueTypeColor: string | null;
    engagementScore: number | null;
    createdAt: Date;
    updatedAt: Date;
  }>;
  total: number;
  page: number;
  limit: number;
}> {
  const where: Prisma.PublishedPostReadWhereInput = {
    userId,
  };

  if (queueType && queueType !== "all") {
    where.queueTypeName = queueType;
  }

  const [readModelPosts, total] = await Promise.all([
    prisma.publishedPostRead.findMany({
      where,
      orderBy: { publishedAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.publishedPostRead.count({ where }),
  ]);

  // If read model is empty and fallback is enabled, use transactional table
  if (readModelPosts.length === 0 && total === 0 && useFallback) {
    // @ts-ignore - Dynamic imports work at runtime in CommonJS
    const queriesModule = await import("./post.queries.server");
    const result = await queriesModule.getPublishedPosts({
      userId,
      queueType,
      page,
      limit,
    });

    return {
      posts: result.posts.map((post: (typeof result.posts)[0]) => ({
        id: post.id,
        userId: post.userId,
        postId: post.id,
        caption: post.caption,
        publishedAt: post.publishedAt ?? new Date(),
        queueTypeName: post.queueType?.name ?? "unassigned",
        queueTypeColor: post.queueType?.color ?? null,
        engagementScore: null, // Can be computed later
        createdAt: post.createdAt,
        updatedAt: post.updatedAt,
      })),
      total: result.pagination.total,
      page: result.pagination.currentPage,
      limit: result.pagination.limit,
    };
  }

  return {
    posts: readModelPosts,
    total,
    page,
    limit,
  };
}

/**
 * Get post statistics from read models
 */
export async function getPostStatisticsFromReadModel({
  userId,
}: {
  userId: string;
}): Promise<{
  scheduledCount: number;
  successCount: number;
}> {
  const [scheduledCount, successCount] = await Promise.all([
    prisma.scheduledPostRead.count({
      where: { userId },
    }),
    prisma.publishedPostRead.count({
      where: { userId },
    }),
  ]);

  return {
    scheduledCount,
    successCount,
  };
}

/**
 * Check if read models are populated for a user
 * Useful for determining whether to use read models or fallback
 */
export async function areReadModelsPopulated(userId: string): Promise<boolean> {
  const [scheduledCount, publishedCount] = await Promise.all([
    prisma.scheduledPostRead.count({
      where: { userId },
    }),
    prisma.publishedPostRead.count({
      where: { userId },
    }),
  ]);

  // Consider read models populated if we have at least some data
  // This is a simple heuristic - you might want to check against actual post counts
  return scheduledCount > 0 || publishedCount > 0;
}
