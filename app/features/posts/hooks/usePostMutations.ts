/**
 * Utility hooks for post mutations with automatic query invalidation
 * Ensures all related queries are invalidated when posts are modified
 */

import { useQueryClient, useMutation } from "@tanstack/react-query";

import { calendarKeys } from "~/features/posts/calendar";
import { publishedPostsKeys } from "~/features/posts/publishing";
import { scheduledPostsKeys } from "~/features/posts/scheduling/hooks/useScheduledPostsQuery";

import { dashboardKeys } from "./useDashboardQuery";
import { draftsKeys } from "./useDraftsQuery";

/**
 * Invalidate all post-related queries
 * Useful when a mutation affects multiple views
 */
export function useInvalidatePostQueries() {
  const queryClient = useQueryClient();

  return () => {
    // Invalidate all post-related queries
    void queryClient.invalidateQueries({ queryKey: publishedPostsKeys.all });
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
    mutationFn: async ({
      postId,
      isLongform,
    }: {
      postId: string;
      isLongform?: boolean;
    }) => {
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
    mutationFn: async ({
      postIds,
      isLongform,
    }: {
      postIds: string[];
      isLongform?: boolean;
    }) => {
      const formData = new FormData();
      formData.append(
        "_action",
        isLongform ? "bulkDeleteLongForm" : "bulkDelete"
      );
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
 * Hook for reschedule mutation with optimistic updates
 */
export function useReschedulePostMutation() {
  const queryClient = useQueryClient();
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
      formData.append(
        "_action",
        isLongform ? "rescheduleLongform" : "reschedule"
      );
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
    onMutate: async ({ postId, scheduledFor, queueTypeId }) => {
      // Cancel outgoing refetches to avoid overwriting optimistic update
      await queryClient.cancelQueries({ queryKey: dashboardKeys.all });
      await queryClient.cancelQueries({ queryKey: scheduledPostsKeys.all });
      await queryClient.cancelQueries({ queryKey: calendarKeys.all });

      // Snapshot previous values for rollback
      const previousQueries: Array<{
        queryKey: readonly unknown[];
        data: unknown;
      }> = [];

      // Helper to update post in array
      const updatePostInArray = (posts: unknown[]): unknown[] => {
        return posts.map((post) => {
          if (
            post &&
            typeof post === "object" &&
            "id" in post &&
            typeof post.id === "string" &&
            post.id === postId
          ) {
            return {
              ...post,
              scheduledAtUtc: new Date(
                parseInt(scheduledFor, 10) * 1000
              ).toISOString(),
              queueTypeId:
                queueTypeId ?? (post as { queueTypeId?: string }).queueTypeId,
              updatedAt: new Date().toISOString(),
            };
          }
          return post;
        });
      };

      // Helper to update query data (handles both regular and infinite queries)
      const updateQueryData = (queryKey: readonly unknown[], data: unknown) => {
        if (!data) return;

        // Handle infinite query structure (has pages array)
        if (
          typeof data === "object" &&
          "pages" in data &&
          Array.isArray((data as { pages: unknown[] }).pages)
        ) {
          const infiniteData = data as {
            pages: unknown[];
            pageParams: unknown[];
          };
          const updatedPages = infiniteData.pages.map((page) => {
            if (!page || typeof page !== "object") return page;
            const pageObj = page as Record<string, unknown>;
            const updated: Record<string, unknown> = { ...pageObj };

            // Update scheduledPosts array
            if (Array.isArray(pageObj["scheduledPosts"])) {
              updated["scheduledPosts"] = updatePostInArray(
                pageObj["scheduledPosts"] as unknown[]
              );
            }
            // Update posts array
            if (Array.isArray(pageObj["posts"])) {
              updated["posts"] = updatePostInArray(
                pageObj["posts"] as unknown[]
              );
            }
            // Update longformPosts array
            if (Array.isArray(pageObj["longformPosts"])) {
              updated["longformPosts"] = updatePostInArray(
                pageObj["longformPosts"] as unknown[]
              );
            }

            return updated;
          });

          queryClient.setQueryData(queryKey, {
            ...infiniteData,
            pages: updatedPages,
          });
        } else {
          // Handle regular query structure
          const queryData = data as Record<string, unknown>;
          const updated: Record<string, unknown> = { ...queryData };

          // Update scheduledPosts array
          if (Array.isArray(queryData["scheduledPosts"])) {
            updated["scheduledPosts"] = updatePostInArray(
              queryData["scheduledPosts"] as unknown[]
            );
          }
          // Update posts array
          if (Array.isArray(queryData["posts"])) {
            updated["posts"] = updatePostInArray(
              queryData["posts"] as unknown[]
            );
          }
          // Update longformPosts array
          if (Array.isArray(queryData["longformPosts"])) {
            updated["longformPosts"] = updatePostInArray(
              queryData["longformPosts"] as unknown[]
            );
          }

          queryClient.setQueryData(queryKey, updated);
        }
      };

      // Update all dashboard queries
      queryClient
        .getQueryCache()
        .findAll({ queryKey: dashboardKeys.all })
        .forEach((query) => {
          const previousData = query.state.data;
          previousQueries.push({
            queryKey: query.queryKey,
            data: previousData,
          });
          updateQueryData(query.queryKey, previousData);
        });

      // Update all scheduled posts queries
      queryClient
        .getQueryCache()
        .findAll({ queryKey: scheduledPostsKeys.all })
        .forEach((query) => {
          const previousData = query.state.data;
          previousQueries.push({
            queryKey: query.queryKey,
            data: previousData,
          });
          updateQueryData(query.queryKey, previousData);
        });

      // Update calendar queries
      queryClient
        .getQueryCache()
        .findAll({ queryKey: calendarKeys.all })
        .forEach((query) => {
          const previousData = query.state.data;
          previousQueries.push({
            queryKey: query.queryKey,
            data: previousData,
          });
          updateQueryData(query.queryKey, previousData);
        });

      return { previousQueries };
    },
    onError: (_error, _variables, context) => {
      // Rollback optimistic updates on error
      if (context?.previousQueries) {
        context.previousQueries.forEach(({ queryKey, data }) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
    },
    onSuccess: () => {
      invalidateAll();
    },
  });
}
