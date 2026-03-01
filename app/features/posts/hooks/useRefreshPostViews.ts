import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import { useCallback } from "react";

import { calendarKeys } from "./useCalendarQuery";
import { dashboardKeys } from "./useDashboardQuery";
import { draftsKeys } from "./useDraftsQuery";
import { publishedPostsKeys } from "./usePublishedPostsQuery";
import { scheduledPostsKeys } from "./useScheduledPostsQuery";

const POST_VIEW_QUERY_KEYS = [
  scheduledPostsKeys.all,
  publishedPostsKeys.all,
  dashboardKeys.all,
  draftsKeys.all,
  calendarKeys.all,
] as const;

export function refreshPostViews(queryClient: QueryClient) {
  POST_VIEW_QUERY_KEYS.forEach((queryKey) => {
    void queryClient.invalidateQueries({ queryKey });
    void queryClient.refetchQueries({ queryKey, type: "active" });
  });
}

export function useRefreshPostViews() {
  const queryClient = useQueryClient();
  return useCallback(() => {
    refreshPostViews(queryClient);
  }, [queryClient]);
}
