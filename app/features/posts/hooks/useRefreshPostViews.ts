import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import { useCallback } from "react";

import { calendarKeys } from "~/features/posts/calendar";
import { publishedPostsKeys } from "~/features/posts/publishing";
import { scheduledPostsKeys } from "~/features/posts/scheduling/hooks/useScheduledPostsQuery";

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
