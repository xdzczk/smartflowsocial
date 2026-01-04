/**
 * Type guards and utilities for PostStats
 * Provides safe access to PostStats properties
 */

import type { PostStats } from "~/features/posts/stats.server";

/**
 * Type guard to check if value is PostStats
 */
export function isPostStats(value: unknown): value is PostStats {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  // Check for PostStats structure
  const stats = value as Record<string, unknown>;
  return (
    typeof stats.likes === "number" &&
    typeof stats.replies === "number" &&
    typeof stats.mentions === "number" &&
    typeof stats.reposts === "number" &&
    typeof stats.zaps === "number" &&
    typeof stats.satszapped === "number"
  );
}

/**
 * Safely get PostStats from a record
 * Returns empty stats object if not found or invalid
 */
export function getPostStats(
  stats: Record<string, unknown> | undefined | null,
  eventId: string | null | undefined,
): PostStats {
  if (!eventId || !stats || typeof stats !== "object" || Array.isArray(stats)) {
    return {
      likes: 0,
      replies: 0,
      mentions: 0,
      reposts: 0,
      zaps: 0,
      satszapped: 0,
    };
  }

  const eventStats = stats[eventId];
  if (isPostStats(eventStats)) {
    return eventStats;
  }

  return {
    likes: 0,
    replies: 0,
    mentions: 0,
    reposts: 0,
    zaps: 0,
    satszapped: 0,
  };
}

/**
 * Safely access a property from PostStats
 * Returns 0 if property doesn't exist or is not a number
 */
export function getPostStatsValue(
  stats: PostStats,
  key: string,
): number {
  if (key in stats && typeof stats[key as keyof PostStats] === "number") {
    return stats[key as keyof PostStats];
  }
  return 0;
}


