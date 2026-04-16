import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import { useCallback } from "react";

import { calendarKeys } from "~/features/posts/calendar/hooks/useCalendarQuery";
import { publishedPostsKeys } from "~/features/posts/publishing";
import { scheduledPostsKeys } from "~/features/posts/scheduling/hooks/useScheduledPostsQuery";
import { skipInfiniteQueries } from "~/lib/query/is-infinite-query-data";

import { dashboardKeys } from "./useDashboardQuery";
import { draftsKeys } from "./useDraftsQuery";

const POST_VIEW_QUERY_KEYS = [
  scheduledPostsKeys.all,
  publishedPostsKeys.all,
  dashboardKeys.all,
  draftsKeys.all,
  calendarKeys.all,
] as const;

export function refreshPostViews(queryClient: QueryClient) {
  POST_VIEW_QUERY_KEYS.forEach((queryKey) => {
    void queryClient.invalidateQueries({
      queryKey,
      predicate: skipInfiniteQueries,
    });
    void queryClient.refetchQueries({
      queryKey,
      type: "active",
      predicate: skipInfiniteQueries,
    });
  });
}

/**
 * Defers {@link refreshPostViews} until the browser is idle (with a max wait).
 * Opening the publish/schedule success modal used to call `refreshPostViews`
 * immediately; invalidating + refetching every active post list could freeze the
 * UI for 10+ seconds so modal buttons appeared dead until work finished.
 */
export function scheduleRefreshPostViews(queryClient: QueryClient): void {
  if (typeof window === "undefined") return;
  const run = () => refreshPostViews(queryClient);
  if (typeof window.requestIdleCallback === "function") {
    window.requestIdleCallback(() => run(), { timeout: 3000 });
  } else {
    window.setTimeout(run, 300);
  }
}

export function useRefreshPostViews() {
  const queryClient = useQueryClient();
  return useCallback(() => {
    refreshPostViews(queryClient);
  }, [queryClient]);
}
