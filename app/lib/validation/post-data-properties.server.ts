/**
 * Type-safe property accessors for PostData
 * Provides safe access to PostData properties for sorting and filtering
 */

import type { PostData } from "~/features/posts/types";

/**
 * Safely get a property value from PostData for sorting
 * Returns undefined if property doesn't exist or is not sortable
 */
export function getPostDataProperty(
  post: PostData,
  key: string
): string | number | Date | undefined {
  // Handle known PostData properties
  switch (key) {
    case "id":
      return post.id;
    case "caption":
      return post.caption ?? undefined;
    case "scheduledAtUtc":
    case "scheduledFor": {
      const scheduledAtUtc = (post as unknown as { scheduledAtUtc?: unknown })
        .scheduledAtUtc;
      if (scheduledAtUtc instanceof Date) return scheduledAtUtc;
      if (typeof scheduledAtUtc === "string") return new Date(scheduledAtUtc);
      return undefined;
    }
    case "postedAt":
      return post.postedAt instanceof Date
        ? post.postedAt
        : typeof post.postedAt === "string"
          ? new Date(post.postedAt)
          : undefined;
    case "createdAt":
      return post.createdAt instanceof Date
        ? post.createdAt
        : typeof post.createdAt === "string"
          ? new Date(post.createdAt)
          : undefined;
    case "updatedAt":
      return post.updatedAt instanceof Date
        ? post.updatedAt
        : typeof post.updatedAt === "string"
          ? new Date(post.updatedAt)
          : undefined;
    default: {
      // For other properties, try safe access
      const value = (post as unknown as Record<string, unknown>)[key];
      if (
        typeof value === "string" ||
        typeof value === "number" ||
        (value && typeof value === "object" && value instanceof Date)
      ) {
        return value;
      }
      return undefined;
    }
  }
}

/**
 * Compare two PostData objects by a property key
 * Returns comparison result for sorting
 */
export function comparePostDataByProperty(
  a: PostData,
  b: PostData,
  key: string,
  direction: "asc" | "desc"
): number {
  const aValue = getPostDataProperty(a, key);
  const bValue = getPostDataProperty(b, key);

  if (aValue === undefined && bValue === undefined) return 0;
  if (aValue === undefined) return direction === "asc" ? -1 : 1;
  if (bValue === undefined) return direction === "asc" ? 1 : -1;

  // Handle Date comparisons
  if (aValue instanceof Date && bValue instanceof Date) {
    return direction === "asc"
      ? aValue.getTime() - bValue.getTime()
      : bValue.getTime() - aValue.getTime();
  }

  // Handle string/number comparisons
  if (aValue < bValue) return direction === "asc" ? -1 : 1;
  if (aValue > bValue) return direction === "asc" ? 1 : -1;
  return 0;
}
