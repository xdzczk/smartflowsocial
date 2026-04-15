/**
 * Helpers for optimistic updates to scheduled-posts query cache after deletes.
 */

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function filterRowsByDeletedIds(
  rows: unknown,
  deletedIds: Set<string>
): unknown {
  if (!Array.isArray(rows)) {
    return rows;
  }

  return rows.filter((row) => {
    if (!isObjectRecord(row)) return true;
    const id = row["id"];
    return typeof id !== "string" || !deletedIds.has(id);
  });
}

function pruneScheduledPageData(
  page: unknown,
  deletedIds: Set<string>
): unknown {
  if (!isObjectRecord(page)) {
    return page;
  }

  return {
    ...page,
    posts: filterRowsByDeletedIds(page["posts"], deletedIds),
    longformPosts: filterRowsByDeletedIds(page["longformPosts"], deletedIds),
    allContent: filterRowsByDeletedIds(page["allContent"], deletedIds),
  };
}

/**
 * Removes deleted content from both regular and infinite scheduled-query cache.
 */
export function pruneScheduledQueryData(
  oldData: unknown,
  deletedIds: Set<string>
): unknown {
  if (!isObjectRecord(oldData)) {
    return oldData;
  }

  const pages = oldData["pages"];
  if (Array.isArray(pages)) {
    return {
      ...oldData,
      pages: pages.map((page) => pruneScheduledPageData(page, deletedIds)),
    };
  }

  return pruneScheduledPageData(oldData, deletedIds);
}
