/**
 * TanStack Query hooks for published posts
 * Provides caching, background refetching, and optimistic updates
 */

import {
  useFetcher,
  useLoaderData,
  useParams,
  useSearchParams,
} from "@remix-run/react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";

import type { User as _User } from "~/features/user";
import { useInfiniteRemixQuery } from "~/lib/query/hooks/useInfiniteRemixQuery";
import { safeValidateLoaderResponse } from "~/lib/validation/loader-responses";
import {
  publishedPostsLoaderDataSchema,
  type PublishedPostsLoaderData,
} from "~/lib/validation/schemas/loader-responses.schemas";
import { validateUserData } from "~/lib/validation/user-data";
import type { UserData } from "~/lib/validation/user-data";

import { combineContent } from "../combined";
import type { PostDTO, LongFormPostDTO } from "../dtos";
import { fromPostDTOArray, fromLongFormPostDTOArray } from "../dtos";
import { getQueueAccentHex } from "../queue-colors";
import type { PostStats } from "../stats.server";
import type {
  PostData,
  LongFormPostData,
  CombinedContent,
  QueueType,
} from "../types";
import { convertJsonValueToScheduleConfig } from "../types";
import { isRepostPost } from "../utils/content-helpers";

// PublishedPostsLoaderData is now exported from schemas

/**
 * Query key factory for published posts
 */
export const publishedPostsKeys = {
  all: ["published-posts"] as const,
  lists: () => [...publishedPostsKeys.all, "list"] as const,
  list: (
    queueType?: string,
    tab?: string,
    page?: number,
    dateFrom?: string,
    dateTo?: string
  ) =>
    [
      ...publishedPostsKeys.lists(),
      queueType,
      tab,
      page ?? "",
      dateFrom ?? "",
      dateTo ?? "",
    ] as const,
  detail: (id: string) => [...publishedPostsKeys.all, "detail", id] as const,
};

/**
 * Hook to fetch published posts with TanStack Query
 * Uses Remix loader data as initial data and enables client-side refetching
 */
export function usePublishedPostsQuery() {
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
    publishedPostsLoaderDataSchema
  );

  return useQuery({
    queryKey: publishedPostsKeys.list(queueType, currentTab, page),
    queryFn: async () => {
      // Use fetcher to refetch data
      const url = `/dashboard/published${queueType !== "all" ? `/${queueType}` : ""}?tab=${currentTab}&page=${page}`;
      fetcher.load(url);

      // Wait for fetcher to complete using a more efficient approach
      return new Promise<PublishedPostsLoaderData>((resolve, reject) => {
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
                publishedPostsLoaderDataSchema
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
 * Hook to fetch published posts with infinite scroll support
 * Uses Remix loader data as initial data and enables infinite pagination
 */
export function usePublishedPostsInfiniteQuery() {
  const params = useParams();
  const [searchParams] = useSearchParams();
  const queueType = params["queueType"] ?? "all";
  const currentTab = searchParams.get("tab") ?? "all";
  const dateFrom = searchParams.get("dateFrom") ?? undefined;
  const dateTo = searchParams.get("dateTo") ?? undefined;

  const loaderDataRaw = useLoaderData();

  // Validate initial loader data
  const validatedLoaderData = safeValidateLoaderResponse(
    loaderDataRaw,
    publishedPostsLoaderDataSchema
  );

  if (!validatedLoaderData) {
    throw new Error("Invalid loader data");
  }

  const dateParams =
    dateFrom || dateTo
      ? `&dateFrom=${encodeURIComponent(dateFrom ?? "")}&dateTo=${encodeURIComponent(dateTo ?? "")}`
      : "";

  return useInfiniteRemixQuery<PublishedPostsLoaderData>({
    queryKey: publishedPostsKeys.list(
      queueType,
      currentTab,
      undefined,
      dateFrom,
      dateTo
    ),
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
      `/dashboard/published${queueType !== "all" ? `/${queueType}` : ""}?tab=${currentTab}&page=${pageParam}${dateParams}`,
    staleTime: 30 * 1000, // 30 seconds
    maxPages: undefined, // No cap – load until server reports no more pages (same as Dashboard Flow)
    refetchInterval: 15_000, // Live updates when new posts are published
    refetchIntervalInBackground: true,
  });
}

/**
 * Hook to get processed post data from query
 */
export function usePublishedPostsData() {
  const { data, isLoading, error } = usePublishedPostsQuery();

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
    "publishedAt",
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
        const color = getQueueAccentHex(
          (q as { colorToken?: string | null }).colorToken ?? null
        );
        const colorToken =
          (q as { colorToken?: string | null }).colorToken ?? null;
        const scheduleType =
          typeof q.scheduleType === "string" &&
          (q.scheduleType === "INTERVAL" ||
            q.scheduleType === "FIXED_SLOTS" ||
            q.scheduleType === "WEEKLY_SLOTS")
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
          colorToken: colorToken ?? undefined,
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
 * Helper to create empty state for published posts infinite data
 */
function createEmptyPublishedPostsData<TFetchNextPage>(
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
    totalContentCount: 0,
    totalPostsCount: 0,
    totalRepostsCount: 0,
    totalLongformCount: 0,
  };
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
    const color = getQueueAccentHex(
      (q as { colorToken?: string | null }).colorToken ?? null
    );
    const colorToken = (q as { colorToken?: string | null }).colorToken ?? null;
    const scheduleType =
      typeof q.scheduleType === "string" &&
      (q.scheduleType === "INTERVAL" ||
        q.scheduleType === "FIXED_SLOTS" ||
        q.scheduleType === "WEEKLY_SLOTS")
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
      colorToken: colorToken ?? undefined,
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
export function usePublishedPostsInfiniteData() {
  const query = usePublishedPostsInfiniteQuery();
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } =
    query;

  // Memoize the flattened data to prevent unnecessary recalculations
  // Must be called unconditionally (before any early returns) to follow React Hooks rules
  const { allPosts, allLongformPosts, allStats, allContent } = useMemo(() => {
    // Handle empty pages case
    if (data.pages.length === 0) {
      const emptyStats: Record<string, PostStats> = {};
      return {
        allPosts: [] as PostData[],
        allLongformPosts: [] as LongFormPostData[],
        allStats: emptyStats,
        allContent: [] as CombinedContent[],
      };
    }
    const allPages = data.pages;
    const posts: PostData[] = [];
    const longformPosts: LongFormPostData[] = [];
    const stats: Record<string, PostStats> = {};
    const seenPostIds = new Set<string>();
    const seenLongformIds = new Set<string>();

    // Process each page and deduplicate
    for (const pageData of allPages) {
      const pagePostsRaw =
        "posts" in pageData && Array.isArray(pageData.posts)
          ? pageData.posts
          : [];
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

      // Deduplicate posts by ID and ensure valid structure
      for (const post of pagePosts) {
        if (
          typeof post === "object" &&
          post.id &&
          typeof post.id === "string" &&
          post.id.trim() !== "" &&
          !seenPostIds.has(post.id)
        ) {
          seenPostIds.add(post.id);
          posts.push(post);
        }
      }

      // Deduplicate longform posts by ID and ensure valid structure
      for (const longform of pageLongformPosts) {
        if (
          typeof longform === "object" &&
          longform.id &&
          typeof longform.id === "string" &&
          longform.id.trim() !== "" &&
          !seenLongformIds.has(longform.id)
        ) {
          seenLongformIds.add(longform.id);
          longformPosts.push(longform);
        }
      }

      // Aggregate stats
      const pageStatsRaw = "stats" in pageData ? pageData.stats : undefined;
      if (
        pageStatsRaw &&
        typeof pageStatsRaw === "object" &&
        !Array.isArray(pageStatsRaw)
      ) {
        Object.assign(stats, pageStatsRaw);
      }
    }

    // Reconstruct allContent from flattened posts
    const content: CombinedContent[] = combineContent(
      posts,
      longformPosts,
      "publishedAt",
      "desc"
    );

    return {
      allPosts: posts,
      allLongformPosts: longformPosts,
      allStats: stats,
      allContent: content,
    };
  }, [data.pages]);

  // Handle empty pages case after memoization
  if (data.pages.length === 0) {
    return createEmptyPublishedPostsData(
      isLoading,
      isFetchingNextPage,
      false,
      fetchNextPage
    );
  }

  // Get pagination and other data from last page
  // data.pages.length > 0 is guaranteed at this point due to check above
  const lastPage = data.pages[data.pages.length - 1]!;

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

  // Use server-provided totals from first page when available (complete before load-more)
  const firstPage = data.pages[0];
  const serverTotalPostsCount =
    firstPage &&
    typeof firstPage === "object" &&
    "totalPostsCount" in firstPage &&
    typeof (firstPage as { totalPostsCount?: number }).totalPostsCount ===
      "number"
      ? (firstPage as { totalPostsCount: number }).totalPostsCount
      : undefined;
  const serverTotalRepostsCount =
    firstPage &&
    typeof firstPage === "object" &&
    "totalRepostsCount" in firstPage &&
    typeof (firstPage as { totalRepostsCount?: number }).totalRepostsCount ===
      "number"
      ? (firstPage as { totalRepostsCount: number }).totalRepostsCount
      : undefined;
  const serverTotalLongformCount =
    firstPage &&
    typeof firstPage === "object" &&
    "totalLongformCount" in firstPage &&
    typeof (firstPage as { totalLongformCount?: number }).totalLongformCount ===
      "number"
      ? (firstPage as { totalLongformCount: number }).totalLongformCount
      : undefined;
  const serverTotalContentCount =
    firstPage &&
    typeof firstPage === "object" &&
    "totalContentCount" in firstPage &&
    typeof (firstPage as { totalContentCount?: number }).totalContentCount ===
      "number"
      ? (firstPage as { totalContentCount: number }).totalContentCount
      : undefined;

  const totalPostsCount =
    serverTotalPostsCount ?? allPosts.filter((p) => !isRepostPost(p)).length;
  const totalRepostsCount =
    serverTotalRepostsCount ?? allPosts.filter((p) => isRepostPost(p)).length;
  const totalLongformCount =
    serverTotalLongformCount ?? allLongformPosts.length;
  const totalContentCount =
    serverTotalContentCount ??
    (typeof pagination.total === "number"
      ? pagination.total
      : allPosts.length + allLongformPosts.length);

  return {
    posts: allPosts,
    longformPosts: allLongformPosts,
    allContent,
    user,
    queueTypes,
    pagination,
    stats: allStats,
    // Pagination totals for display (server totals when available)
    totalPostsCount,
    totalRepostsCount,
    totalLongformCount,
    totalContentCount,
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

      const response = await fetch("/dashboard/published", {
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
        queryKey: publishedPostsKeys.list(queueType, currentTab, page),
      });

      // Snapshot previous value
      const previousData = queryClient.getQueryData<PublishedPostsLoaderData>(
        publishedPostsKeys.list(queueType, currentTab, page)
      );

      // Optimistically update
      if (previousData) {
        queryClient.setQueryData<PublishedPostsLoaderData>(
          publishedPostsKeys.list(queueType, currentTab, page),
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
          publishedPostsKeys.list(queueType, currentTab, page),
          context.previousData
        );
      }
    },
    onSettled: () => {
      // Refetch after mutation
      void queryClient.invalidateQueries({
        queryKey: publishedPostsKeys.lists(),
      });
    },
  });
}
