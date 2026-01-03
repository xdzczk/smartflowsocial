/**
 * Utility hooks for post mutations with automatic query invalidation
 * Ensures all related queries are invalidated when posts are modified
 */

import { useQueryClient } from "@tanstack/react-query";
import { useMutation } from "@tanstack/react-query";

import { calendarKeys } from "./useCalendarQuery";
import { dashboardKeys } from "./useDashboardQuery";
import { draftsKeys } from "./useDraftsQuery";
import { postedPostsKeys } from "./usePostedPostsQuery";
import { scheduledPostsKeys } from "./useScheduledPostsQuery";

/**
 * Invalidate all post-related queries
 * Useful when a mutation affects multiple views
 */
export function useInvalidatePostQueries() {
  const queryClient = useQueryClient();

  return () => {
    // Invalidate all post-related queries
    void queryClient.invalidateQueries({ queryKey: postedPostsKeys.all });
    void queryClient.invalidateQueries({ queryKey: dashboardKeys.all });
    void queryClient.invalidateQueries({ queryKey: scheduledPostsKeys.all });
    void queryClient.invalidateQueries({ queryKey: draftsKeys.all });
    void queryClient.invalidateQueries({ queryKey: calendarKeys.all });
  };
}

/**
 * Hook for delete post mutation with automatic query invalidation
 */
export function useDeletePostMutation() {
  const invalidateAll = useInvalidatePostQueries();

  return useMutation({
    mutationFn: async ({ postId, isLongform }: { postId: string; isLongform?: boolean }) => {
      const formData = new FormData();
      formData.append("_action", isLongform ? "deleteLongForm" : "delete");
      formData.append("postId", postId);

      const response = await fetch("/dashboard", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Failed to delete post");
      }

      return response.json();
    },
    onSuccess: () => {
      invalidateAll();
    },
  });
}

/**
 * Hook for bulk delete mutation with automatic query invalidation
 */
export function useBulkDeleteMutation() {
  const invalidateAll = useInvalidatePostQueries();

  return useMutation({
    mutationFn: async ({ postIds, isLongform }: { postIds: string[]; isLongform?: boolean }) => {
      const formData = new FormData();
      formData.append("_action", isLongform ? "bulkDeleteLongForm" : "bulkDelete");
      formData.append("postIds", JSON.stringify(postIds));

      const response = await fetch("/dashboard", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Failed to delete posts");
      }

      return response.json();
    },
    onSuccess: () => {
      invalidateAll();
    },
  });
}

/**
 * Hook for reschedule mutation with automatic query invalidation
 */
export function useReschedulePostMutation() {
  const invalidateAll = useInvalidatePostQueries();

  return useMutation({
    mutationFn: async ({
      postId,
      scheduledFor,
      queueTypeId,
      isLongform,
    }: {
      postId: string;
      scheduledFor: string;
      queueTypeId?: string;
      isLongform?: boolean;
    }) => {
      const formData = new FormData();
      formData.append("_action", isLongform ? "rescheduleLongform" : "reschedule");
      formData.append("postId", postId);
      formData.append("scheduledFor", scheduledFor);
      if (queueTypeId) {
        formData.append("queueTypeId", queueTypeId);
      }

      const response = await fetch("/dashboard/calendar", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Failed to reschedule post");
      }

      return response.json();
    },
    onSuccess: () => {
      invalidateAll();
    },
  });
}

