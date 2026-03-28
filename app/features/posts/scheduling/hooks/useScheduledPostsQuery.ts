/**
 * TanStack Query hooks for scheduled posts
 * Provides caching and background refetching for scheduled posts page
 */

import {
  useFetcher,
  useLoaderData,
  useParams,
  useSearchParams,
} from "@remix-run/react";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import { combineContent } from "~/features/posts/combined";
import type { PostDTO, LongFormPostDTO } from "~/features/posts/dtos";
import {
  fromPostDTOArray,
  fromLongFormPostDTOArray,
} from "~/features/posts/dtos";
import { getQueueAccentHex } from "~/features/posts/queue-colors";
import type {
  PostData,
  LongFormPostData,
  CombinedContent,
  QueueType,
  UserData,
  HashTagPreset,
} from "~/features/posts/types";
import { convertJsonValueToScheduleConfig } from "~/features/posts/types";
import { isRepostPost } from "~/features/posts/utils/content-helpers";
import { useInfiniteRemixQuery } from "~/lib/query/hooks/useInfiniteRemixQuery";
import { useDeferredRouteLoaderData } from "~/lib/remix/deferred-route-loader-context";
import { validateHashTagPresets } from "~/lib/validation/hashtag-presets";
import { safeValidateLoaderResponse } from "~/lib/validation/loader-responses";
import {
  scheduledPostsLoaderDataSchema,
  type ScheduledPostsLoaderData,
} from "~/lib/validation/schemas/loader-responses.schemas";

/**
 * Query key factory for scheduled posts
 */
export const scheduledPostsKeys = {
  all: ["scheduled-posts"] as const,
  lists: () => [...scheduledPostsKeys.all, "list"] as const,
  list: (
    queueType?: string,
    tab?: string,
    dateFrom?: string,
    dateTo?: string
  ) =>
    [
      ...scheduledPostsKeys.lists(),
      queueType,
      tab,
      dateFrom ?? "",
      dateTo ?? "",
    ] as const,
};

// ScheduledPostsLoaderData is now exported from schemas

/**
 * Hook to fetch scheduled posts with TanStack Query
 */
export function useScheduledPostsQuery() {
  const params = useParams();
  const [searchParams] = useSearchParams();
  const queueType =
    params["queueType"] ?? searchParams.get("queueType") ?? "all";
  const currentTab = searchParams.get("tab") ?? "all";
  const dateFrom = searchParams.get("dateFrom") ?? undefined;
  const dateTo = searchParams.get("dateTo") ?? undefined;

  const resolvedFromDefer = useDeferredRouteLoaderData();
  const loaderDataRaw = useLoaderData();
  const fetcher = useFetcher();

  const validatedLoaderData = useMemo(() => {
    if (resolvedFromDefer !== undefined && resolvedFromDefer !== null) {
      return (
        safeValidateLoaderResponse(
          resolvedFromDefer,
          scheduledPostsLoaderDataSchema
        ) ?? undefined
      );
    }
    return safeValidateLoaderResponse(
      loaderDataRaw,
      scheduledPostsLoaderDataSchema
    );
  }, [resolvedFromDefer, loaderDataRaw]);

  const dateParams =
    dateFrom || dateTo
      ? `&dateFrom=${encodeURIComponent(dateFrom ?? "")}&dateTo=${encodeURIComponent(dateTo ?? "")}`
      : "";

  return useQuery({
    queryKey: scheduledPostsKeys.list(queueType, currentTab, dateFrom, dateTo),
    queryFn: async () => {
      const base =
        queueType !== "all"
          ? params["queueType"]
            ? `/dashboard/scheduled/${queueType}?tab=${currentTab}`
            : `/dashboard/scheduled?tab=${currentTab}&queueType=${queueType}`
          : `/dashboard/scheduled?tab=${currentTab}`;
      fetcher.load(base + dateParams);

      return new Promise<ScheduledPostsLoaderData>((resolve, reject) => {
        const checkFetcher = () => {
          if (fetcher.state === "idle") {
            if (fetcher.data) {
              const validated = safeValidateLoaderResponse(
                fetcher.data,
                scheduledPostsLoaderDataSchema
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
          } else if (fetcher.state === "loading") {
            setTimeout(checkFetcher, 50);
          } else {
            reject(new Error("Failed to fetch data"));
          }
        };
        checkFetcher();
      });
    },
    initialData: validatedLoaderData,
    staleTime: 30 * 1000, // 30 seconds
    gcTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: true,
    refetchOnMount: false,
  });
}

/**
 * Hook to fetch scheduled posts with infinite scroll support
 */
export function useScheduledPostsInfiniteQuery() {
  const params = useParams();
  const [searchParams] = useSearchParams();
  const queueType =
    params["queueType"] ?? searchParams.get("queueType") ?? "all";
  const currentTab = searchParams.get("tab") ?? "all";
  const dateFrom = searchParams.get("dateFrom") ?? undefined;
  const dateTo = searchParams.get("dateTo") ?? undefined;

  const resolvedFromDefer = useDeferredRouteLoaderData();
  const loaderDataRaw = useLoaderData();

  const validatedLoaderData = useMemo(() => {
    if (resolvedFromDefer !== undefined && resolvedFromDefer !== null) {
      return (
        safeValidateLoaderResponse(
          resolvedFromDefer,
          scheduledPostsLoaderDataSchema
        ) ?? null
      );
    }
    return safeValidateLoaderResponse(
      loaderDataRaw,
      scheduledPostsLoaderDataSchema
    );
  }, [resolvedFromDefer, loaderDataRaw]);

  if (!validatedLoaderData) {
    throw new Error("Invalid loader data");
  }

  const dateParams =
    dateFrom || dateTo
      ? `&dateFrom=${encodeURIComponent(dateFrom ?? "")}&dateTo=${encodeURIComponent(dateTo ?? "")}`
      : "";

  return useInfiniteRemixQuery<ScheduledPostsLoaderData>({
    queryKey: scheduledPostsKeys.list(queueType, currentTab, dateFrom, dateTo),
    initialData: validatedLoaderData,
    getNextPageParam: (lastPage) => {
      const pagination =
        "pagination" in lastPage ? lastPage.pagination : undefined;
      if (
        pagination &&
        typeof pagination === "object" &&
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
    buildUrl: (pageParam) => {
      const base =
        queueType !== "all"
          ? params["queueType"]
            ? `/dashboard/scheduled/${queueType}?tab=${currentTab}&page=${pageParam}`
            : `/dashboard/scheduled?tab=${currentTab}&queueType=${queueType}&page=${pageParam}`
          : `/dashboard/scheduled?tab=${currentTab}&page=${pageParam}`;
      return base + dateParams;
    },
    staleTime: 30 * 1000, // 30 seconds
    maxPages: undefined, // No cap – load until server reports no more pages (same as Dashboard Flow)
    refetchInterval: 15_000, // Live updates when scheduled posts are published
    refetchIntervalInBackground: true,
  });
}

/**
 * Hook to get processed scheduled posts data from query
 */
export function useScheduledPostsData() {
  const { data, isLoading, error } = useScheduledPostsQuery();

  if (!data) {
    return {
      posts: [] as PostData[],
      longformPosts: [] as LongFormPostData[],
      allContent: [] as CombinedContent[],
      user: null as UserData | null,
      queueTypes: [] as QueueType[],
      hashTagPresets: [] as HashTagPreset[],
      isLoading,
      error,
    };
  }

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
  const queueTypesRaw =
    "queueTypes" in typedData && Array.isArray(typedData.queueTypes)
      ? typedData.queueTypes
      : [];
  const hashTagPresetsRaw =
    "hashTagPresets" in typedData && Array.isArray(typedData.hashTagPresets)
      ? typedData.hashTagPresets
      : [];

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
    "scheduledFor",
    "asc"
  );
  const queueTypes: QueueType[] = Array.isArray(queueTypesRaw)
    ? queueTypesRaw
        .map((qt: unknown) => {
          if (
            qt &&
            typeof qt === "object" &&
            !Array.isArray(qt) &&
            "id" in qt &&
            "name" in qt
          ) {
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
            const name =
              typeof q.name === "string" ? q.name : String(q.name ?? "");
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
          }
          return null;
        })
        .filter((qt): qt is QueueType => qt !== null)
    : [];
  // Validate HashTagPreset array with Zod schema
  const hashTagPresets: HashTagPreset[] =
    validateHashTagPresets(hashTagPresetsRaw);

  return {
    posts,
    longformPosts,
    allContent,
    user: userRaw,
    queueTypes,
    hashTagPresets,
    isLoading,
    error,
  };
}

function emptyScheduledPostsInfiniteResult(
  isLoading: boolean,
  isFetchingNextPage: boolean,
  fetchNextPage: () => void
) {
  return {
    posts: [] as PostData[],
    longformPosts: [] as LongFormPostData[],
    allContent: [] as CombinedContent[],
    user: null as UserData | null,
    queueTypes: [] as QueueType[],
    hashTagPresets: [] as HashTagPreset[],
    totalContentCount: 0,
    totalPostsCount: 0,
    totalRepostsCount: 0,
    totalLongformCount: 0,
    isLoading,
    isFetchingNextPage,
    hasNextPage: false,
    fetchNextPage,
    error: null,
  };
}

function parsePagePosts(pageData: Record<string, unknown>) {
  const pagePostsRaw =
    "posts" in pageData && Array.isArray(pageData["posts"])
      ? pageData["posts"]
      : [];
  const pageLongformPostsRaw =
    "longformPosts" in pageData && Array.isArray(pageData["longformPosts"])
      ? pageData["longformPosts"]
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
  return { pagePosts, pageLongformPosts };
}

/**
 * Hook to get processed scheduled posts data from infinite query
 * Flattens posts and longform posts across all pages
 */
export function useScheduledPostsInfiniteData() {
  const query = useScheduledPostsInfiniteQuery();
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } =
    query;

  // data.pages always exists due to initialData, so we process it directly
  if (data.pages.length === 0) {
    return emptyScheduledPostsInfiniteResult(
      isLoading,
      isFetchingNextPage,
      () => {
        void fetchNextPage();
      }
    );
  }

  // Flatten all pages
  const allPages = data.pages;
  const allPosts: PostData[] = [];
  const allLongformPosts: LongFormPostData[] = [];

  // Process each page
  for (const pageData of allPages) {
    const { pagePosts, pageLongformPosts } = parsePagePosts(
      pageData as Record<string, unknown>
    );
    allPosts.push(...pagePosts);
    allLongformPosts.push(...pageLongformPosts);
  }

  // Reconstruct allContent from flattened posts
  const allContent: CombinedContent[] = combineContent(
    allPosts,
    allLongformPosts,
    "scheduledFor",
    "asc"
  );

  // Get other data from last page
  const lastPage = allPages[allPages.length - 1];
  if (!lastPage) {
    return emptyScheduledPostsInfiniteResult(
      isLoading,
      isFetchingNextPage,
      () => {
        void fetchNextPage();
      }
    );
  }

  const userRaw = "user" in lastPage ? lastPage.user : null;
  const queueTypesRaw =
    "queueTypes" in lastPage && Array.isArray(lastPage.queueTypes)
      ? lastPage.queueTypes
      : [];
  const hashTagPresetsRaw =
    "hashTagPresets" in lastPage && Array.isArray(lastPage.hashTagPresets)
      ? lastPage.hashTagPresets
      : [];
  const _paginationRaw =
    "pagination" in lastPage ? lastPage.pagination : undefined;
  const longformPaginationRaw =
    "longformPagination" in lastPage ? lastPage.longformPagination : undefined;

  const queueTypes: QueueType[] = Array.isArray(queueTypesRaw)
    ? queueTypesRaw
        .map((qt: unknown) => {
          if (
            qt &&
            typeof qt === "object" &&
            !Array.isArray(qt) &&
            "id" in qt &&
            "name" in qt
          ) {
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
            const name =
              typeof q.name === "string" ? q.name : String(q.name ?? "");
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
          }
          return null;
        })
        .filter((qt): qt is QueueType => qt !== null)
    : [];
  const hashTagPresets: HashTagPreset[] =
    validateHashTagPresets(hashTagPresetsRaw);

  // Use server-provided totals from first page when available (complete before load-more)
  const firstPage = allPages[0];
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
  const longformPagination =
    longformPaginationRaw &&
    typeof longformPaginationRaw === "object" &&
    "total" in longformPaginationRaw &&
    typeof longformPaginationRaw.total === "number"
      ? longformPaginationRaw.total
      : allLongformPosts.length;
  const totalLongformCount = serverTotalLongformCount ?? longformPagination;
  const totalContentCount =
    serverTotalContentCount ?? allPosts.length + allLongformPosts.length;

  return {
    posts: allPosts,
    longformPosts: allLongformPosts,
    allContent,
    user: userRaw,
    queueTypes,
    hashTagPresets,
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
  };
}
