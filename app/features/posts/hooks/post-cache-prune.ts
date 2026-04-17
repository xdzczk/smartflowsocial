import type { QueryClient } from "@tanstack/react-query";

import { calendarKeys } from "~/features/posts/calendar/hooks/useCalendarQuery";
import { publishedPostsKeys } from "~/features/posts/publishing/hooks/usePublishedPostsQuery";
import { scheduledPostsKeys } from "~/features/posts/scheduling/hooks/useScheduledPostsQuery";

import { dashboardKeys } from "./useDashboardQuery";
import { draftsKeys } from "./useDraftsQuery";

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

function prunePageData(page: unknown, deletedIds: Set<string>): unknown {
  if (!isObjectRecord(page)) {
    return page;
  }

  return {
    ...page,
    posts: filterRowsByDeletedIds(page["posts"], deletedIds),
    longformPosts: filterRowsByDeletedIds(page["longformPosts"], deletedIds),
    allContent: filterRowsByDeletedIds(page["allContent"], deletedIds),
    scheduledPosts: filterRowsByDeletedIds(page["scheduledPosts"], deletedIds),
  };
}

export function prunePostListQueryData(
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
      pages: pages.map((page) => prunePageData(page, deletedIds)),
    };
  }

  return prunePageData(oldData, deletedIds);
}

export function optimisticallyRemovePostIdsFromViews(
  queryClient: QueryClient,
  ids: string[]
): void {
  if (ids.length === 0) return;
  const deletedIds = new Set(ids);

  const queryKeys = [
    publishedPostsKeys.all,
    scheduledPostsKeys.all,
    dashboardKeys.all,
    draftsKeys.all,
    calendarKeys.all,
  ] as const;

  queryKeys.forEach((queryKey) => {
    queryClient.setQueriesData({ queryKey }, (old) =>
      prunePostListQueryData(old, deletedIds)
    );
  });
}
