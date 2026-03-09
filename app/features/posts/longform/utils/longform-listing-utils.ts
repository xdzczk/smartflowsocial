import type { LongFormPostType } from "~/features/posts/server";
import type { LongFormPostData, PostFetcher } from "~/features/posts/types";
import { fromDate, fromISOString } from "~/lib/temporal";

export interface LongFormListingSortConfig {
  key: string;
  direction: "asc" | "desc";
}

export function getFetcherFormData(
  fetcher: PostFetcher | undefined
): FormData | null | undefined {
  return fetcher
    ? (fetcher as { formData?: FormData | null }).formData
    : undefined;
}

export function getDefaultSortKey(
  type: "draft" | "scheduled" | "published"
): string {
  if (type === "published") return "publishedAt";
  if (type === "scheduled") return "scheduledAtUtc";
  return "createdAt";
}

export function getDefaultSortDirection(
  type: "draft" | "scheduled" | "published"
): "asc" | "desc" {
  if (type === "published") return "desc";
  if (type === "scheduled") return "asc";
  return "desc";
}

export function getSortValue(post: LongFormPostType, key: string): number {
  try {
    if (key === "publishedAt") {
      if (!post.publishedAt) return 0;
      const zoned = fromISOString(
        post.publishedAt instanceof Date
          ? post.publishedAt.toISOString()
          : String(post.publishedAt),
        "UTC"
      );
      return Number(zoned.epochMilliseconds);
    }
    if (key === "scheduledAtUtc" || key === "scheduledFor") {
      const scheduledAt =
        "scheduledAtUtc" in post && post.scheduledAtUtc instanceof Date
          ? post.scheduledAtUtc
          : null;
      if (!scheduledAt) return 0;
      const zoned = fromDate(scheduledAt, "UTC");
      return Number(zoned.epochMilliseconds);
    }
    if (key === "createdAt") {
      const zoned = fromISOString(
        post.createdAt instanceof Date
          ? post.createdAt.toISOString()
          : String(post.createdAt),
        "UTC"
      );
      return Number(zoned.epochMilliseconds);
    }
    const val = post[key as keyof LongFormPostType];
    return typeof val === "number" ? val : 0;
  } catch {
    return 0;
  }
}

export function compareStringValues(
  a: string,
  b: string,
  direction: "asc" | "desc"
): number {
  return direction === "asc" ? a.localeCompare(b) : b.localeCompare(a);
}

export function longFormMatchesSearch(
  post: LongFormPostType | LongFormPostData,
  searchTerm: string
): boolean {
  const term = searchTerm.toLowerCase();
  return (
    (post.title?.toLowerCase().includes(term) ?? false) ||
    (post.summary?.toLowerCase().includes(term) ?? false)
  );
}

export function sortLongFormPosts(
  posts: Array<LongFormPostType | LongFormPostData>,
  sortConfig: LongFormListingSortConfig
): Array<LongFormPostType | LongFormPostData> {
  return [...posts].sort((a, b) => {
    const aVal =
      a[sortConfig.key as keyof (LongFormPostType | LongFormPostData)];
    const bVal =
      b[sortConfig.key as keyof (LongFormPostType | LongFormPostData)];

    if (typeof aVal === "string" && typeof bVal === "string") {
      return compareStringValues(aVal, bVal, sortConfig.direction);
    }

    const aValue = getSortValue(a as LongFormPostType, sortConfig.key);
    const bValue = getSortValue(b as LongFormPostType, sortConfig.key);
    return sortConfig.direction === "asc" ? aValue - bValue : bValue - aValue;
  });
}
