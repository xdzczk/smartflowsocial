/**
 * Helpers for optimistic updates to published-posts infinite-query cache after deletes.
 */

import { ACTION_BULK_DELETE_MIXED } from "./usePublishedPostsConstants";

export function isPublishedPostsCacheObject(
  value: unknown
): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function filterPublishedRowsById(
  rows: unknown,
  deletedIds: Set<string>
): unknown {
  if (!Array.isArray(rows)) {
    return rows;
  }
  return rows.filter((row) => {
    if (!isPublishedPostsCacheObject(row)) return true;
    const id = row["id"];
    return typeof id !== "string" || !deletedIds.has(id);
  });
}

export function prunePublishedPageData(
  page: unknown,
  deletedIds: Set<string>
): unknown {
  if (!isPublishedPostsCacheObject(page)) {
    return page;
  }
  return {
    ...page,
    posts: filterPublishedRowsById(page["posts"], deletedIds),
    longformPosts: filterPublishedRowsById(page["longformPosts"], deletedIds),
    allContent: filterPublishedRowsById(page["allContent"], deletedIds),
  };
}

export function parseBulkDeleteIds(formData: FormData): string[] {
  const action = formData.get("_action");
  const raw = formData.get("postIds");
  const rawMixed = formData.get("itemData");

  if (action === ACTION_BULK_DELETE_MIXED && typeof rawMixed === "string") {
    try {
      const mixed = JSON.parse(rawMixed) as Array<{ id?: unknown }>;
      return mixed
        .map((item) => (typeof item.id === "string" ? item.id : null))
        .filter((id): id is string => id !== null);
    } catch {
      return [];
    }
  }

  if (typeof raw !== "string") {
    return [];
  }
  try {
    const parsed = JSON.parse(raw) as unknown[];
    return parsed.filter((id): id is string => typeof id === "string");
  } catch {
    return [];
  }
}
