/**
 * TanStack Query hooks for posted posts
 * Provides caching, background refetching, and optimistic updates
 */

import {
  useFetcher,
  useLoaderData,
  useParams,
  useSearchParams,
} from "@remix-run/react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import type { User as _User } from "~/features/user";
import { useInfiniteRemixQuery } from "~/lib/query/hooks/useInfiniteRemixQuery";
import { safeValidateLoaderResponse } from "~/lib/validation/loader-responses";
import {
  postedPostsLoaderDataSchema,
  type PostedPostsLoaderData,
} from "~/lib/validation/schemas/loader-responses.schemas";
import { validateUserData } from "~/lib/validation/user-data";
import type { UserData } from "~/lib/validation/user-data";

import { combineContent } from "../combined";
import type { PostDTO, LongFormPostDTO } from "../dtos";
import { fromPostDTOArray, fromLongFormPostDTOArray } from "../dtos";
import type { PostStats } from "../stats.server";
import type {
  PostData,
  LongFormPostData,
  CombinedContent,
  QueueType,
} from "../types";
import { convertJsonValueToScheduleConfig } from "../types";

// PostedPostsLoaderData is now exported from schemas

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
  const queueType = params["queueType"] ?? "all";
  const currentTab = searchParams.get("tab") ?? "all";
  const page = parseInt(searchParams.get("page") ?? "1", 10);

  // Import loader dynamically to avoid circular dependency
  const loaderDataRaw = useLoaderData();
  const fetcher = useFetcher();

  // Validate initial loader data
  const validatedLoaderData = safeValidateLoaderResponse(
    loaderDataRaw,
    postedPostsLoaderDataSchema
  );

  return useQuery({
    queryKey: postedPostsKeys.list(queueType, currentTab, page),
    queryFn: async () => {
      // Use fetcher to refetch data
      const url = `/dashboard/posted${queueType !== "all" ? `/${queueType}` : ""}?tab=${currentTab}&page=${page}`;
      fetcher.load(url);

      // Wait for fetcher to complete using a more efficient approach
      return new Promise<PostedPostsLoaderData>((resolve, reject) => {
        // Set a maximum timeout to prevent hanging
        const timeoutId = setTimeout(() => {
          if (validatedLoaderData) {
            resolve(validatedLoaderData);
          } else {
            reject(new Error("Fetcher timeout - using initial data"));
          }
        }, 5000); // 5 second max timeout

        const checkFetcher = () => {
          if (fetcher.state === "idle") {
            clearTimeout(timeoutId);
            if (fetcher.data) {
              const validated = safeValidateLoaderResponse(
                fetcher.data,
                postedPostsLoaderDataSchema
              );
              if (validated) {
                resolve(validated);
              } else if (validatedLoaderData) {
                // Fallback to initial data if validation fails
                resolve(validatedLoaderData);
              } else {
                reject(new Error("Invalid data received from fetcher"));
              }
            } else if (validatedLoaderData) {
              resolve(validatedLoaderData);
            } else {
              reject(new Error("Invalid loader data"));
            }
          } else if (fetcher.state === "loading") {
            // Use requestAnimationFrame for more efficient polling
            requestAnimationFrame(() => {
              setTimeout(checkFetcher, 100); // Check every 100ms instead of 50ms
            });
          } else {
            clearTimeout(timeoutId);
            // If fetcher failed, fallback to initial data
            if (validatedLoaderData) {
              resolve(validatedLoaderData);
            } else {
              reject(new Error("Failed to fetch data"));
            }
          }
        };
        checkFetcher();
      });
    },
    initialData: validatedLoaderData,
    staleTime: 30 * 1000, // 30 seconds - data is fresh for 30 seconds
    gcTime: 5 * 60 * 1000, // 5 minutes - keep in cache for 5 minutes
    refetchOnWindowFocus: false, // Disable to prevent unnecessary refetches
    refetchOnMount: false, // Don't refetch on mount if data is fresh
  });
}

/**
 * Hook to fetch posted posts with infinite scroll support
 * Uses Remix loader data as initial data and enables infinite pagination
 */
export function usePostedPostsInfiniteQuery() {
  const params = useParams();
  const [searchParams] = useSearchParams();
  const queueType = params["queueType"] ?? "all";
  const currentTab = searchParams.get("tab") ?? "all";

  const loaderDataRaw = useLoaderData();

  // Validate initial loader data
  const validatedLoaderData = safeValidateLoaderResponse(
    loaderDataRaw,
    postedPostsLoaderDataSchema
  );

  if (!validatedLoaderData) {
    throw new Error("Invalid loader data");
  }

  return useInfiniteRemixQuery<PostedPostsLoaderData>({
    queryKey: postedPostsKeys.list(queueType, currentTab),
    initialData: validatedLoaderData,
    getNextPageParam: (lastPage) => {
      const pagination =
        "pagination" in lastPage ? lastPage.pagination : undefined;
      if (
        pagination &&
        "currentPage" in pagination &&
        "pages" in pagination &&
        typeof pagination.currentPage === "number" &&
        typeof pagination.pages === "number" &&
        pagination.currentPage < pagination.pages
      ) {
        return pagination.currentPage + 1;
      }
      return;
    },
    buildUrl: (pageParam) =>
      `/dashboard/posted${queueType !== "all" ? `/${queueType}` : ""}?tab=${currentTab}&page=${pageParam}`,
    staleTime: 30 * 1000, // 30 seconds
    maxPages: 10, // Limit to 200 items (10 pages × 20 items per page)
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

  // Data is already validated by the query hook
  const typedData = data;
  const postsRaw =
    "posts" in typedData && Array.isArray(typedData.posts)
      ? typedData.posts
      : [];
  const longformPostsRaw =
    "longformPosts" in typedData && Array.isArray(typedData.longformPosts)
      ? typedData.longformPosts
      : [];
  const userRaw = "user" in typedData ? typedData.user : null;
  const user: UserData | null = userRaw ? validateUserData(userRaw) : null;
  const queueTypesRaw =
    "queueTypes" in typedData && Array.isArray(typedData.queueTypes)
      ? typedData.queueTypes
      : [];
  const paginationRaw =
    "pagination" in typedData ? typedData.pagination : undefined;
  const statsRaw = "stats" in typedData ? typedData.stats : undefined;

  const posts: PostData[] = Array.isArray(postsRaw)
    ? fromPostDTOArray(postsRaw as unknown as PostDTO[])
    : [];
  const longformPosts: LongFormPostData[] = Array.isArray(longformPostsRaw)
    ? fromLongFormPostDTOArray(longformPostsRaw as unknown as LongFormPostDTO[])
    : [];
  // Reconstruct allContent on client from deserialized posts/longformPosts
  const allContent: CombinedContent[] = combineContent(
    posts,
    longformPosts,
    "postedAt",
    "desc"
  );
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
          q.scheduleConfig
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
  const pagination =
    paginationRaw &&
    typeof paginationRaw === "object" &&
    !Array.isArray(paginationRaw) &&
    "total" in paginationRaw &&
    "pages" in paginationRaw &&
    "currentPage" in paginationRaw &&
    "limit" in paginationRaw
      ? {
          total:
            typeof paginationRaw.total === "number" ? paginationRaw.total : 0,
          pages:
            typeof paginationRaw.pages === "number" ? paginationRaw.pages : 0,
          currentPage:
            typeof paginationRaw.currentPage === "number"
              ? paginationRaw.currentPage
              : 1,
          limit:
            typeof paginationRaw.limit === "number" ? paginationRaw.limit : 50,
        }
      : { total: 0, pages: 0, currentPage: 1, limit: 50 };
  const stats: Record<string, PostStats> =
    statsRaw && typeof statsRaw === "object" && !Array.isArray(statsRaw)
      ? statsRaw
      : {};

  return {
    posts,
    longformPosts,
    allContent,
    user,
    queueTypes,
    pagination,
    stats,
    isLoading,
    error,
    rawData: typedData,
  };
}

/**
 * Helper to create empty state for posted posts infinite data
 */
function createEmptyPostedPostsData<TFetchNextPage>(
  isLoading: boolean,
  isFetchingNextPage: boolean,
  hasNextPage: boolean,
  fetchNextPage: TFetchNextPage
) {
  return {
    posts: [] as PostData[],
    longformPosts: [] as LongFormPostData[],
    allContent: [] as CombinedContent[],
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    error: null,
    user: null,
    queueTypes: [] satisfies QueueType[],
    pagination: { total: 0, pages: 0, currentPage: 1, limit: 20 },
    stats: {} satisfies Record<string, PostStats>,
  };
}

/**
 * Helper to process a single page and extract posts, longform posts, and stats
 */
function processPageData(
  pageData: PostedPostsLoaderData,
  allPosts: PostData[],
  allLongformPosts: LongFormPostData[],
  allStats: Record<string, PostStats>
) {
  const pagePostsRaw =
    "posts" in pageData && Array.isArray(pageData.posts) ? pageData.posts : [];
  const pageLongformPostsRaw =
    "longformPosts" in pageData && Array.isArray(pageData.longformPosts)
      ? pageData.longformPosts
      : [];

  const pagePosts: PostData[] = Array.isArray(pagePostsRaw)
    ? fromPostDTOArray(pagePostsRaw as unknown as PostDTO[])
    : [];
  const pageLongformPosts: LongFormPostData[] = Array.isArray(
    pageLongformPostsRaw
  )
    ? fromLongFormPostDTOArray(
        pageLongformPostsRaw as unknown as LongFormPostDTO[]
      )
    : [];

  allPosts.push(...pagePosts);
  allLongformPosts.push(...pageLongformPosts);

  // Aggregate stats
  const pageStatsRaw = "stats" in pageData ? pageData.stats : undefined;
  if (
    pageStatsRaw &&
    typeof pageStatsRaw === "object" &&
    !Array.isArray(pageStatsRaw)
  ) {
    Object.assign(allStats, pageStatsRaw);
  }
}

/**
 * Helper to process queue types from raw data
 */
function processQueueTypes(queueTypesRaw: unknown[]): QueueType[] {
  return queueTypesRaw.map((qt: unknown) => {
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
    const scheduleConfig = convertJsonValueToScheduleConfig(q.scheduleConfig);
    const isEnabled =
      typeof q.isEnabled === "boolean" ? q.isEnabled : q.isEnabled !== false;
    const userId = typeof q.userId === "string" ? q.userId : "";
    return {
      id,
      name,
      color,
      description: undefined,
      scheduleType,
      scheduleConfig,
      isEnabled,
      userId,
    };
  });
}

/**
 * Helper to process pagination from raw data
 */
function processPagination(paginationRaw: unknown) {
  if (
    paginationRaw &&
    typeof paginationRaw === "object" &&
    !Array.isArray(paginationRaw) &&
    "total" in paginationRaw &&
    "pages" in paginationRaw &&
    "currentPage" in paginationRaw &&
    "limit" in paginationRaw
  ) {
    return {
      total: typeof paginationRaw.total === "number" ? paginationRaw.total : 0,
      pages: typeof paginationRaw.pages === "number" ? paginationRaw.pages : 0,
      currentPage:
        typeof paginationRaw.currentPage === "number"
          ? paginationRaw.currentPage
          : 1,
      limit: typeof paginationRaw.limit === "number" ? paginationRaw.limit : 20,
    };
  }
  return { total: 0, pages: 0, currentPage: 1, limit: 20 };
}

/**
 * Hook to get processed post data from infinite query
 * Flattens pages and aggregates data across all pages
 */
export function usePostedPostsInfiniteData() {
  const query = usePostedPostsInfiniteQuery();
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } =
    query;

  // data.pages always exists due to initialData, so we process it directly
  if (data.pages.length === 0) {
    return createEmptyPostedPostsData(
      isLoading,
      isFetchingNextPage,
      false,
      fetchNextPage
    );
  }

  // Flatten all pages
  const allPages = data.pages;
  const allPosts: PostData[] = [];
  const allLongformPosts: LongFormPostData[] = [];
  const allStats: Record<string, PostStats> = {};

  // Process each page
  for (const pageData of allPages) {
    processPageData(pageData, allPosts, allLongformPosts, allStats);
  }

  // Reconstruct allContent from flattened posts
  const allContent: CombinedContent[] = combineContent(
    allPosts,
    allLongformPosts,
    "postedAt",
    "desc"
  );

  // Get pagination and other data from last page
  const lastPage = allPages[allPages.length - 1];
  if (!lastPage) {
    return createEmptyPostedPostsData(
      isLoading,
      isFetchingNextPage,
      false,
      fetchNextPage
    );
  }

  const userRaw = "user" in lastPage ? lastPage.user : null;
  const user: UserData | null = userRaw ? validateUserData(userRaw) : null;
  const queueTypesRaw =
    "queueTypes" in lastPage && Array.isArray(lastPage.queueTypes)
      ? lastPage.queueTypes
      : [];
  const paginationRaw =
    "pagination" in lastPage ? lastPage.pagination : undefined;

  const queueTypes: QueueType[] = Array.isArray(queueTypesRaw)
    ? processQueueTypes(queueTypesRaw)
    : [];
  const pagination = processPagination(paginationRaw);

  return {
    posts: allPosts,
    longformPosts: allLongformPosts,
    allContent,
    user,
    queueTypes,
    pagination,
    stats: allStats,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    error: null,
    rawData: lastPage,
  };
}

/**
 * Mutation hook for bulk delete with optimistic updates
 */
export function useBulkDeletePostsMutation() {
  const queryClient = useQueryClient();
  const params = useParams();
  const [searchParams] = useSearchParams();
  const queueType = params["queueType"] ?? "all";
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
        postedPostsKeys.list(queueType, currentTab, page)
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
                        !postIds.includes(p.id)
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
                        !postIds.includes(c.id)
                    )
                  : [],
            };
          }
        );
      }

      return { previousData };
    },
    onError: (err, variables, context) => {
      // Rollback on error
      if (context?.previousData) {
        queryClient.setQueryData(
          postedPostsKeys.list(queueType, currentTab, page),
          context.previousData
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
