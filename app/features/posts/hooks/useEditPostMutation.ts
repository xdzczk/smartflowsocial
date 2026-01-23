/**
 * Hook for edit post mutation with optimistic updates
 * Provides instant UI feedback when editing posts
 */

import { useQueryClient, useMutation } from "@tanstack/react-query";

import { calendarKeys } from "./useCalendarQuery";
import { dashboardKeys } from "./useDashboardQuery";
import { draftsKeys } from "./useDraftsQuery";
import { postedPostsKeys } from "./usePostedPostsQuery";
import { recyclablesKeys } from "./useRecyclablesQuery";
import { scheduledPostsKeys } from "./useScheduledPostsQuery";

interface EditPostVariables {
  postId: string;
  isLongform: boolean;
  formData: FormData;
}

/**
 * Hook for edit post mutation with optimistic updates
 */
export function useEditPostMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ formData }: EditPostVariables) => {
      const response = await fetch("/dashboard", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorData = (await response.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(
          errorData.error ?? `Failed to edit post: ${response.statusText}`
        );
      }

      return response.json();
    },
    onMutate: async ({ postId, isLongform, formData }) => {
      // Extract form data for optimistic update
      const caption = formData.get("caption") as string | null;
      const fileUrl = formData.get("fileUrl") as string | null;
      const hashtags = formData.get("hashtags") as string | null;
      const queueTypeId = formData.get("queueTypeId") as string | null;
      const scheduledFor = formData.get("scheduledFor") as string | null;
      const title = formData.get("title") as string | null;
      const summary = formData.get("summary") as string | null;
      const content = formData.get("content") as string | null;
      const image = formData.get("image") as string | null;

      // Cancel outgoing refetches to avoid overwriting optimistic update
      await queryClient.cancelQueries({ queryKey: dashboardKeys.all });
      await queryClient.cancelQueries({ queryKey: scheduledPostsKeys.all });
      await queryClient.cancelQueries({ queryKey: draftsKeys.all });
      await queryClient.cancelQueries({ queryKey: postedPostsKeys.all });
      await queryClient.cancelQueries({ queryKey: recyclablesKeys.all });
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
            const updated: Record<string, unknown> = { ...post };

            // Update standard post fields
            if (caption !== null) updated["caption"] = caption;
            if (fileUrl !== null) updated["fileUrl"] = fileUrl;
            if (hashtags !== null) {
              updated["tags"] = hashtags.split(" ").filter((tag) => tag.trim());
            }
            if (queueTypeId !== null) updated["queueTypeId"] = queueTypeId;
            if (scheduledFor !== null) {
              updated["scheduledAtUtc"] = new Date(
                parseInt(scheduledFor, 10) * 1000
              ).toISOString();
            }

            // Update longform post fields
            if (isLongform) {
              if (title !== null) updated["title"] = title;
              if (summary !== null) updated["summary"] = summary;
              if (content !== null) updated["content"] = content;
              if (image !== null) updated["image"] = image;
            }

            updated["updatedAt"] = new Date().toISOString();
            return updated;
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

      // Update all affected queries
      const queryKeys = [
        dashboardKeys.all,
        scheduledPostsKeys.all,
        draftsKeys.all,
        postedPostsKeys.all,
        recyclablesKeys.all,
        calendarKeys.all,
      ];

      queryKeys.forEach((queryKey) => {
        queryClient
          .getQueryCache()
          .findAll({ queryKey })
          .forEach((query) => {
            const previousData = query.state.data;
            previousQueries.push({
              queryKey: query.queryKey,
              data: previousData,
            });
            updateQueryData(query.queryKey, previousData);
          });
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
      // Invalidate all post-related queries to refetch fresh data
      void queryClient.invalidateQueries({ queryKey: dashboardKeys.all });
      void queryClient.invalidateQueries({ queryKey: scheduledPostsKeys.all });
      void queryClient.invalidateQueries({ queryKey: draftsKeys.all });
      void queryClient.invalidateQueries({ queryKey: postedPostsKeys.all });
      void queryClient.invalidateQueries({ queryKey: recyclablesKeys.all });
      void queryClient.invalidateQueries({ queryKey: calendarKeys.all });
    },
  });
}
