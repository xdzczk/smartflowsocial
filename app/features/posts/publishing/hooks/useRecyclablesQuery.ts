/**
 * TanStack Query hooks for recyclable posts
 * Provides caching and background refetching for recyclables page
 */

import {
  useFetcher,
  useLoaderData,
  useParams,
  useSearchParams,
} from "@remix-run/react";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import type { PostDTO } from "~/features/posts/dtos";
import { fromPostDTOArray } from "~/features/posts/dtos";
import type { PostStats as _PostStats } from "~/features/posts/stats.server";
import type { PostData, QueueType } from "~/features/posts/types";
import type { UserWithHashTagPresets as _UserWithHashTagPresets } from "~/features/user";
import { useInfiniteRemixQuery } from "~/lib/query/hooks/useInfiniteRemixQuery";
import { useDeferredRouteLoaderData } from "~/lib/remix/deferred-route-loader-context";
import { safeValidateLoaderResponse } from "~/lib/validation/loader-responses";
import {
  recyclablesLoaderDataSchema,
  type RecyclablesLoaderData,
} from "~/lib/validation/schemas/loader-responses.schemas";

// RecyclablesLoaderData is now exported from schemas

/**
 * Query key factory for recyclables
 */
export const recyclablesKeys = {
  all: ["recyclables"] as const,
  lists: () => [...recyclablesKeys.all, "list"] as const,
  list: (
    queueType?: string,
    page?: number,
    dateFrom?: string,
    dateTo?: string,
    olderThan?: string
  ) =>
    [
      ...recyclablesKeys.lists(),
      queueType,
      page,
      dateFrom ?? "",
      dateTo ?? "",
      olderThan ?? "",
    ] as const,
  detail: (id: string) => [...recyclablesKeys.all, "detail", id] as const,
};

/**
 * Hook to fetch recyclable posts with TanStack Query
 * Uses Remix loader data as initial data and enables client-side refetching
 */
export function useRecyclablesQuery() {
  const params = useParams();
  const [searchParams] = useSearchParams();
  const queueType = params["queueType"] ?? "all";
  const page = 1; // Recyclables doesn't use pagination in URL currently, but we'll support it
  const dateFrom = searchParams.get("dateFrom") ?? "";
  const dateTo = searchParams.get("dateTo") ?? "";
  const olderThan = searchParams.get("olderThan") ?? "";

  const resolvedFromDefer = useDeferredRouteLoaderData();
  const loaderDataRaw = useLoaderData();
  const fetcher = useFetcher();

  const validatedLoaderData = useMemo(() => {
    if (resolvedFromDefer !== undefined && resolvedFromDefer !== null) {
      return (
        safeValidateLoaderResponse(
          resolvedFromDefer,
          recyclablesLoaderDataSchema
        ) ?? undefined
      );
    }
    return safeValidateLoaderResponse(
      loaderDataRaw,
      recyclablesLoaderDataSchema
    );
  }, [resolvedFromDefer, loaderDataRaw]);

  const queryParams = new URLSearchParams({ page: String(page) });
  if (dateFrom) queryParams.set("dateFrom", dateFrom);
  if (dateTo) queryParams.set("dateTo", dateTo);
  if (olderThan) queryParams.set("olderThan", olderThan);

  return useQuery({
    queryKey: recyclablesKeys.list(
      queueType,
      page,
      dateFrom,
      dateTo,
      olderThan
    ),
    queryFn: async () => {
      // Use fetcher to refetch data
      const url = `/dashboard/recyclables${queueType !== "all" ? `/${queueType}` : ""}?${queryParams.toString()}`;
      fetcher.load(url);

      // Wait for fetcher to complete
      return new Promise<RecyclablesLoaderData>((resolve, reject) => {
        const checkFetcher = () => {
          if (fetcher.state === "idle") {
            if (fetcher.data) {
              const validated = safeValidateLoaderResponse(
                fetcher.data,
                recyclablesLoaderDataSchema
              );
              if (validated) {
                resolve(validated);
              } else {
                reject(new Error("Invalid data received from fetcher"));
              }
            } else if (validatedLoaderData) {
              resolve(validatedLoaderData);
            } else {
              reject(new Error("Invalid loader data"));
            }
          } else {
            setTimeout(checkFetcher, 50);
          }
        };
        checkFetcher();
      });
    },
    initialData: validatedLoaderData,
    staleTime: 30 * 1000, // 30 seconds
  });
}

/**
 * Hook to fetch recyclable posts with infinite scroll support
 * Uses Remix loader data as initial data and enables infinite pagination
 */
export function useRecyclablesInfiniteQuery() {
  const params = useParams();
  const [searchParams] = useSearchParams();
  const queueType = params["queueType"] ?? "all";
  const dateFrom = searchParams.get("dateFrom") ?? "";
  const dateTo = searchParams.get("dateTo") ?? "";
  const olderThan = searchParams.get("olderThan") ?? "";

  const resolvedFromDefer = useDeferredRouteLoaderData();
  const loaderDataRaw = useLoaderData();

  const validatedLoaderData = useMemo(() => {
    if (resolvedFromDefer !== undefined && resolvedFromDefer !== null) {
      return (
        safeValidateLoaderResponse(
          resolvedFromDefer,
          recyclablesLoaderDataSchema
        ) ?? null
      );
    }
    return safeValidateLoaderResponse(
      loaderDataRaw,
      recyclablesLoaderDataSchema
    );
  }, [resolvedFromDefer, loaderDataRaw]);

  if (!validatedLoaderData) {
    throw new Error("Invalid loader data");
  }

  const buildQueryString = (pageParam: number) => {
    const q = new URLSearchParams({ page: String(pageParam) });
    if (dateFrom) q.set("dateFrom", dateFrom);
    if (dateTo) q.set("dateTo", dateTo);
    if (olderThan) q.set("olderThan", olderThan);
    return q.toString();
  };

  return useInfiniteRemixQuery<RecyclablesLoaderData>({
    queryKey: recyclablesKeys.list(
      queueType,
      undefined,
      dateFrom,
      dateTo,
      olderThan
    ),
    initialData: validatedLoaderData,
    getNextPageParam: (lastPage) => {
      const { pagination } = lastPage;
      if (
        typeof pagination.currentPage === "number" &&
        typeof pagination.pages === "number" &&
        pagination.currentPage < pagination.pages
      ) {
        return pagination.currentPage + 1;
      }
      return;
    },
    buildUrl: (pageParam) =>
      `/dashboard/recyclables${queueType !== "all" ? `/${queueType}` : ""}?${buildQueryString(pageParam)}`,
    staleTime: 30 * 1000, // 30 seconds
    maxPages: 10, // Limit to 200 items (10 pages × 20 items per page)
  });
}

/**
 * Processed recyclables data with deserialized DTOs
 * Works with both regular and infinite queries
 */
export function useRecyclablesData() {
  const query = useRecyclablesQuery();
  const rawData = query.data;

  if (!rawData) {
    const emptyPosts: PostData[] = [];
    const emptyStats: Record<
      string,
      {
        likes?: number;
        replies?: number;
        mentions?: number;
        reposts?: number;
        zaps?: number;
        satszapped?: number;
      }
    > = {};
    const emptyQueueTypes: QueueType[] = [];
    return {
      posts: emptyPosts,
      pagination: { total: 0, pages: 0, currentPage: 1, limit: 50 },
      stats: emptyStats,
      user: null,
      queueTypes: emptyQueueTypes,
      selectedQueueType: "all",
      isLoading: query.isLoading,
      rawData: null,
    };
  }

  // Deserialize DTOs (with string dates) back to PostData (with Date objects)
  const posts: PostData[] = Array.isArray(rawData.posts)
    ? fromPostDTOArray(rawData.posts as unknown as PostDTO[])
    : [];

  // Type assertions for stats
  const stats: Record<
    string,
    {
      likes?: number;
      replies?: number;
      mentions?: number;
      reposts?: number;
      zaps?: number;
      satszapped?: number;
    }
  > =
    typeof rawData.stats === "object" && !Array.isArray(rawData.stats)
      ? rawData.stats
      : {};

  // Type assertion for pagination
  const pagination =
    typeof rawData.pagination === "object" &&
    !Array.isArray(rawData.pagination) &&
    "total" in rawData.pagination &&
    "pages" in rawData.pagination &&
    "currentPage" in rawData.pagination &&
    "limit" in rawData.pagination
      ? {
          total:
            typeof rawData.pagination.total === "number"
              ? rawData.pagination.total
              : 0,
          pages:
            typeof rawData.pagination.pages === "number"
              ? rawData.pagination.pages
              : 0,
          currentPage:
            typeof rawData.pagination.currentPage === "number"
              ? rawData.pagination.currentPage
              : 1,
          limit:
            typeof rawData.pagination.limit === "number"
              ? rawData.pagination.limit
              : 50,
        }
      : { total: 0, pages: 0, currentPage: 1, limit: 50 };

  return {
    posts,
    pagination,
    stats,
    user: rawData.user,
    queueTypes: Array.isArray(rawData.queueTypes) ? rawData.queueTypes : [],
    selectedQueueType: rawData.selectedQueueType || "all",
    isLoading: query.isLoading,
    rawData,
  };
}

/**
 * Processed recyclables data from infinite query
 * Flattens pages and aggregates stats across all pages
 */
export function useRecyclablesInfiniteData() {
  const query = useRecyclablesInfiniteQuery();
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } =
    query;

  // data.pages always exists due to initialData, so we process it directly
  if (data.pages.length === 0) {
    const emptyPosts: PostData[] = [];
    const emptyStats: Record<
      string,
      {
        likes?: number;
        replies?: number;
        mentions?: number;
        reposts?: number;
        zaps?: number;
        satszapped?: number;
      }
    > = {};
    const emptyQueueTypes: QueueType[] = [];
    return {
      posts: emptyPosts,
      pagination: { total: 0, pages: 0, currentPage: 1, limit: 20 },
      stats: emptyStats,
      user: null,
      queueTypes: emptyQueueTypes,
      selectedQueueType: "all",
      isLoading,
      isFetchingNextPage,
      hasNextPage: false,
      fetchNextPage,
      rawData: null,
    };
  }

  // Flatten all pages into a single posts array
  const allPages = data.pages;
  const allPosts: PostData[] = [];
  const allStats: Record<
    string,
    {
      likes?: number;
      replies?: number;
      mentions?: number;
      reposts?: number;
      zaps?: number;
      satszapped?: number;
    }
  > = {};

  // Process each page
  for (const pageData of allPages) {
    // Deserialize DTOs
    const pagePosts: PostData[] = Array.isArray(pageData.posts)
      ? fromPostDTOArray(pageData.posts as unknown as PostDTO[])
      : [];
    allPosts.push(...pagePosts);

    // Aggregate stats (merge stats from all pages)
    if (typeof pageData.stats === "object" && !Array.isArray(pageData.stats)) {
      Object.assign(allStats, pageData.stats);
    }
  }

  // Get pagination from the last page
  const lastPage = allPages[allPages.length - 1];
  if (!lastPage) {
    return {
      posts: allPosts,
      pagination: { total: 0, pages: 0, currentPage: 1, limit: 20 },
      stats: allStats,
      user: null,
      queueTypes: [],
      selectedQueueType: "all",
      isLoading,
      isFetchingNextPage,
      hasNextPage: false,
      fetchNextPage,
      rawData: null,
    };
  }

  const pagination =
    typeof lastPage.pagination === "object" &&
    !Array.isArray(lastPage.pagination) &&
    "total" in lastPage.pagination &&
    "pages" in lastPage.pagination &&
    "currentPage" in lastPage.pagination &&
    "limit" in lastPage.pagination
      ? {
          total:
            typeof lastPage.pagination.total === "number"
              ? lastPage.pagination.total
              : 0,
          pages:
            typeof lastPage.pagination.pages === "number"
              ? lastPage.pagination.pages
              : 0,
          currentPage:
            typeof lastPage.pagination.currentPage === "number"
              ? lastPage.pagination.currentPage
              : 1,
          limit:
            typeof lastPage.pagination.limit === "number"
              ? lastPage.pagination.limit
              : 20,
        }
      : { total: 0, pages: 0, currentPage: 1, limit: 20 };

  return {
    posts: allPosts,
    pagination,
    stats: allStats,
    user: lastPage.user,
    queueTypes: Array.isArray(lastPage.queueTypes) ? lastPage.queueTypes : [],
    selectedQueueType: lastPage.selectedQueueType || "all",
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    rawData: lastPage,
  };
}
