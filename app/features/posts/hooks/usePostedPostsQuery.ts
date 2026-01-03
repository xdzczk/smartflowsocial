/**
 * TanStack Query hooks for posted posts
 * Provides caching, background refetching, and optimistic updates
 */

import { useFetcher, useLoaderData } from "@remix-run/react";
import { useParams, useSearchParams } from "@remix-run/react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import type { User } from "~/features/user";

import type { PostDTO, LongFormPostDTO } from "../dtos";
import {
  fromPostDTOArray,
  fromLongFormPostDTOArray,
} from "../dtos";
import type { PostStats } from "../stats.server";
import type {
  PostData,
  LongFormPostData,
  CombinedContent,
  QueueType,
} from "../types";
import { convertJsonValueToScheduleConfig } from "../types";

/**
 * Type for posted posts loader data
 */
export type PostedPostsLoaderData = {
  posts: PostDTO[];
  longformPosts: LongFormPostDTO[];
  allContent: CombinedContent[];
  user: User | null;
  queueTypes: QueueType[];
  pagination: {
    total: number;
    pages: number;
    currentPage: number;
    limit: number;
  };
  stats: Record<string, PostStats>;
};

/**
 * Query key factory for posted posts
 */
export const postedPostsKeys = {
  all: ["posted-posts"] as const,
  lists: () => [...postedPostsKeys.all, "list"] as const,
  list: (queueType?: string, tab?: string, page?: number) =>
    [...postedPostsKeys.lists(), queueType, tab, page] as const,
  detail: (id: string) => [...postedPostsKeys.all, "detail", id] as const,
};

/**
 * Hook to fetch posted posts with TanStack Query
 * Uses Remix loader data as initial data and enables client-side refetching
 */
export function usePostedPostsQuery() {
  const params = useParams();
  const [searchParams] = useSearchParams();
  const queueType = params.queueType ?? "all";
  const currentTab = searchParams.get("tab") ?? "all";
  const page = parseInt(searchParams.get("page") ?? "1", 10);
  
  // Import loader dynamically to avoid circular dependency
  const loaderData = useLoaderData();
  const fetcher = useFetcher();

  return useQuery({
    queryKey: postedPostsKeys.list(queueType, currentTab, page),
    queryFn: async () => {
      // Use fetcher to refetch data
      const url = `/dashboard/posted${queueType !== "all" ? `/${queueType}` : ""}?tab=${currentTab}&page=${page}`;
      fetcher.load(url);
      
      // Wait for fetcher to complete
      return new Promise<PostedPostsLoaderData>((resolve, reject) => {
        const checkFetcher = () => {
          if (fetcher.state === "idle") {
            if (fetcher.data) {
              resolve(fetcher.data as unknown as PostedPostsLoaderData);
            } else {
              resolve(loaderData as PostedPostsLoaderData);
            }
          } else if (fetcher.state === "loading") {
            setTimeout(checkFetcher, 50);
          } else {
            reject(new Error("Failed to fetch data"));
          }
        };
        checkFetcher();
      });
    },
    initialData: loaderData as PostedPostsLoaderData,
    staleTime: 30 * 1000, // 30 seconds - data is fresh for 30 seconds
    gcTime: 5 * 60 * 1000, // 5 minutes - keep in cache for 5 minutes
    refetchOnWindowFocus: true,
    refetchOnMount: false, // Don't refetch on mount if data is fresh
  });
}

/**
 * Hook to get processed post data from query
 */
export function usePostedPostsData() {
  const { data, isLoading, error } = usePostedPostsQuery();
  
  if (!data) {
    return {
      posts: [] as PostData[],
      longformPosts: [] as LongFormPostData[],
      allContent: [] as CombinedContent[],
      isLoading,
      error,
      user: null,
      queueTypes: [] satisfies QueueType[],
      pagination: { total: 0, pages: 0, currentPage: 1, limit: 50 },
      stats: {} satisfies Record<string, PostStats>,
    };
  }

  const typedData = data as unknown as PostedPostsLoaderData;
  const postsRaw = "posts" in typedData && Array.isArray(typedData.posts) ? typedData.posts : [];
  const longformPostsRaw =
    "longformPosts" in typedData && Array.isArray(typedData.longformPosts)
      ? typedData.longformPosts
      : [];
  const allContentRaw =
    "allContent" in typedData && Array.isArray(typedData.allContent)
      ? typedData.allContent
      : [];
  const userRaw = "user" in typedData ? typedData.user : null;
  const queueTypesRaw =
    "queueTypes" in typedData && Array.isArray(typedData.queueTypes)
      ? typedData.queueTypes
      : [];
  const paginationRaw = "pagination" in typedData ? typedData.pagination : undefined;
  const statsRaw = "stats" in typedData ? typedData.stats : undefined;

  const posts: PostData[] = Array.isArray(postsRaw)
    ? fromPostDTOArray(postsRaw)
    : [];
  const longformPosts: LongFormPostData[] = Array.isArray(longformPostsRaw)
    ? fromLongFormPostDTOArray(longformPostsRaw)
    : [];
  const allContent: CombinedContent[] = Array.isArray(allContentRaw)
    ? (allContentRaw as unknown as CombinedContent[])
    : [];
  const queueTypes: QueueType[] = Array.isArray(queueTypesRaw)
    ? queueTypesRaw.map((qt: unknown) => {
        if (typeof qt !== "object" || qt === null) {
          throw new Error("Invalid queue type");
        }
        const q = qt as {
          id?: unknown;
          name?: unknown;
          color?: unknown;
          scheduleType?: unknown;
          scheduleConfig?: unknown;
          isEnabled?: unknown;
          userId?: unknown;
        };
        const id = typeof q.id === "string" ? q.id : String(q.id ?? "");
        const name = typeof q.name === "string" ? q.name : String(q.name ?? "");
        const color =
          q.color !== null && q.color !== undefined
            ? typeof q.color === "string"
              ? q.color
              : String(q.color)
            : null;
        const scheduleType =
          typeof q.scheduleType === "string" &&
          (q.scheduleType === "INTERVAL" || q.scheduleType === "FIXED_SLOTS")
            ? q.scheduleType
            : undefined;
        const scheduleConfig = convertJsonValueToScheduleConfig(
          q.scheduleConfig,
        );
        const isEnabled =
          typeof q.isEnabled === "boolean"
            ? q.isEnabled
            : q.isEnabled !== false;
        const userId = typeof q.userId === "string" ? q.userId : "";
        const queueType: QueueType = {
          id,
          name,
          color,
          description: undefined,
          scheduleType,
          scheduleConfig,
          isEnabled,
          userId,
        };
        return queueType;
      })
    : [];
  const pagination = paginationRaw &&
    typeof paginationRaw === "object" &&
    !Array.isArray(paginationRaw) &&
    "total" in paginationRaw &&
    "pages" in paginationRaw &&
    "currentPage" in paginationRaw &&
    "limit" in paginationRaw
    ? {
        total: typeof paginationRaw.total === "number" ? paginationRaw.total : 0,
        pages: typeof paginationRaw.pages === "number" ? paginationRaw.pages : 0,
        currentPage: typeof paginationRaw.currentPage === "number" ? paginationRaw.currentPage : 1,
        limit: typeof paginationRaw.limit === "number" ? paginationRaw.limit : 50,
      }
    : { total: 0, pages: 0, currentPage: 1, limit: 50 };
  const stats: Record<string, PostStats> =
    statsRaw && typeof statsRaw === "object" && !Array.isArray(statsRaw)
      ? (statsRaw)
      : {};

  return {
    posts,
    longformPosts,
    allContent,
    user: userRaw,
    queueTypes,
    pagination,
    stats,
    isLoading,
    error,
    rawData: typedData,
  };
}

/**
 * Mutation hook for bulk delete with optimistic updates
 */
export function useBulkDeletePostsMutation() {
  const queryClient = useQueryClient();
  const params = useParams();
  const [searchParams] = useSearchParams();
  const queueType = params.queueType ?? "all";
  const currentTab = searchParams.get("tab") ?? "all";
  const page = parseInt(searchParams.get("page") ?? "1", 10);

  return useMutation({
    mutationFn: async (postIds: string[]) => {
      const formData = new FormData();
      formData.append("_action", "bulk-delete");
      postIds.forEach((id) => {
        formData.append("postIds", id);
      });

      const response = await fetch("/dashboard/posted", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Failed to delete posts");
      }

      return response.json();
    },
    onMutate: async (postIds) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({
        queryKey: postedPostsKeys.list(queueType, currentTab, page),
      });

      // Snapshot previous value
      const previousData = queryClient.getQueryData<PostedPostsLoaderData>(
        postedPostsKeys.list(queueType, currentTab, page),
      );

      // Optimistically update
      if (previousData) {
        queryClient.setQueryData<PostedPostsLoaderData>(
          postedPostsKeys.list(queueType, currentTab, page),
          (old) => {
            if (!old) return old;
            return {
              ...old,
              posts:
                "posts" in old && Array.isArray(old.posts)
                  ? old.posts.filter(
                      (p: unknown) =>
                        p &&
                        typeof p === "object" &&
                        "id" in p &&
                        typeof p.id === "string" &&
                        !postIds.includes(p.id),
                    )
                  : [],
              allContent:
                "allContent" in old && Array.isArray(old.allContent)
                  ? old.allContent.filter(
                      (c: unknown) =>
                        c &&
                        typeof c === "object" &&
                        "id" in c &&
                        typeof c.id === "string" &&
                        !postIds.includes(c.id),
                    )
                  : [],
            };
          },
        );
      }

      return { previousData };
    },
    onError: (err, variables, context) => {
      // Rollback on error
      if (context?.previousData) {
        queryClient.setQueryData(
          postedPostsKeys.list(queueType, currentTab, page),
          context.previousData,
        );
      }
    },
    onSettled: () => {
      // Refetch after mutation
      void queryClient.invalidateQueries({
        queryKey: postedPostsKeys.lists(),
      });
    },
  });
}

