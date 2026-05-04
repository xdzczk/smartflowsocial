import type { PostData } from "~/features/posts/server";
import { comparePostDataByProperty } from "~/lib/validation/post-data-properties";
import { getPostStats, getPostStatsValue } from "~/lib/validation/post-stats";

export function getDateValue(
  publishedAt: Date | string | null | undefined
): number {
  if (publishedAt instanceof Date) {
    return publishedAt.getTime();
  }
  if (publishedAt) {
    return new Date(publishedAt).getTime();
  }
  return new Date(0).getTime();
}

export function compareByDate(
  a: PostData,
  b: PostData,
  direction: "asc" | "desc"
): number {
  const dateA = getDateValue(a.publishedAt);
  const dateB = getDateValue(b.publishedAt);
  return direction === "asc" ? dateA - dateB : dateB - dateA;
}

export function getEventId(post: PostData): string {
  return post.signedEvent &&
    typeof post.signedEvent === "object" &&
    "id" in post.signedEvent &&
    typeof post.signedEvent.id === "string"
    ? post.signedEvent.id
    : "";
}

export function compareByEngagementMetric(
  a: PostData,
  b: PostData,
  sortKey: string,
  direction: "asc" | "desc",
  stats: Record<string, unknown> | undefined
): number {
  const aEventId = getEventId(a);
  const bEventId = getEventId(b);

  const aStats = getPostStats(stats, aEventId);
  const bStats = getPostStats(stats, bEventId);
  const aValue = getPostStatsValue(aStats, sortKey);
  const bValue = getPostStatsValue(bStats, sortKey);
  return direction === "asc" ? aValue - bValue : bValue - aValue;
}

export function isEngagementMetric(key: string): boolean {
  return [
    "likes",
    "replies",
    "mentions",
    "reposts",
    "zaps",
    "satszapped",
  ].includes(key);
}

export function comparePublishedPosts(
  a: PostData,
  b: PostData,
  sortConfig: { key: string; direction: "asc" | "desc" },
  stats: Record<string, unknown> | undefined
): number {
  if (sortConfig.key === "publishedAt") {
    return compareByDate(a, b, sortConfig.direction);
  }

  if (isEngagementMetric(sortConfig.key)) {
    return compareByEngagementMetric(
      a,
      b,
      sortConfig.key,
      sortConfig.direction,
      stats
    );
  }

  return comparePostDataByProperty(a, b, sortConfig.key, sortConfig.direction);
}

export function sortPublishedPosts(
  posts: PostData[],
  sortConfig: { key: string; direction: "asc" | "desc" },
  stats: Record<string, unknown> | undefined
): PostData[] {
  return [...posts].sort((a, b) =>
    comparePublishedPosts(a, b, sortConfig, stats)
  );
}
