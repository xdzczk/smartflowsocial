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

import { useInfiniteRemixQuery } from "~/lib/query/hooks/useInfiniteRemixQuery";
import { validateHashTagPresets } from "~/lib/validation/hashtag-presets";
import { safeValidateLoaderResponse } from "~/lib/validation/loader-responses";
import {
  scheduledPostsLoaderDataSchema,
  type ScheduledPostsLoaderData,
} from "~/lib/validation/schemas/loader-responses.schemas";

import { combineContent } from "../combined";
import type { PostDTO, LongFormPostDTO } from "../dtos";
import { fromPostDTOArray, fromLongFormPostDTOArray } from "../dtos";
import { getQueueAccentHex } from "../queue-colors";
import type {
  PostData,
  LongFormPostData,
  CombinedContent,
  QueueType,
  UserData,
  HashTagPreset,
} from "../types";
import { convertJsonValueToScheduleConfig } from "../types";
import { isRepostPost } from "../utils/content-helpers";

/**
 * Query key factory for scheduled posts
 */
export const scheduledPostsKeys = {
  all: ["scheduled-posts"] as const,
  lists: () => [...scheduledPostsKeys.all, "list"] as const,
  list: (queueType?: string, tab?: string) =>
    [...scheduledPostsKeys.lists(), queueType, tab] as const,
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

  const loaderDataRaw = useLoaderData();
  const fetcher = useFetcher();

  // Validate initial loader data
  const validatedLoaderData = safeValidateLoaderResponse(
    loaderDataRaw,
    scheduledPostsLoaderDataSchema
  );

  return useQuery({
    queryKey: scheduledPostsKeys.list(queueType, currentTab),
    queryFn: async () => {
      const url =
        queueType !== "all"
          ? params["queueType"]
            ? `/dashboard/scheduled/${queueType}?tab=${currentTab}`
            : `/dashboard/scheduled?tab=${currentTab}&queueType=${queueType}`
          : `/dashboard/scheduled?tab=${currentTab}`;
      fetcher.load(url);

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

  const loaderDataRaw = useLoaderData();

  // Validate initial loader data
  const validatedLoaderData = safeValidateLoaderResponse(
    loaderDataRaw,
    scheduledPostsLoaderDataSchema
  );

  if (!validatedLoaderData) {
    throw new Error("Invalid loader data");
  }

  return useInfiniteRemixQuery<ScheduledPostsLoaderData>({
    queryKey: scheduledPostsKeys.list(queueType, currentTab),
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
    buildUrl: (pageParam) =>
      queueType !== "all"
        ? params["queueType"]
          ? `/dashboard/scheduled/${queueType}?tab=${currentTab}&page=${pageParam}`
          : `/dashboard/scheduled?tab=${currentTab}&queueType=${queueType}&page=${pageParam}`
        : `/dashboard/scheduled?tab=${currentTab}&page=${pageParam}`,
    staleTime: 30 * 1000, // 30 seconds
    maxPages: 10, // Limit to 200 items (10 pages × 20 items per page)
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

  // Flatten all pages
  const allPages = data.pages;
  const allPosts: PostData[] = [];
  const allLongformPosts: LongFormPostData[] = [];

  // Process each page
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
    };
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
  const paginationRaw =
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

  // Extract pagination totals for displaying counts
  const pagination =
    paginationRaw &&
    typeof paginationRaw === "object" &&
    "total" in paginationRaw &&
    typeof paginationRaw.total === "number"
      ? paginationRaw.total
      : allPosts.length;
  const longformPagination =
    longformPaginationRaw &&
    typeof longformPaginationRaw === "object" &&
    "total" in longformPaginationRaw &&
    typeof longformPaginationRaw.total === "number"
      ? longformPaginationRaw.total
      : allLongformPosts.length;

  // Calculate totals: Posts = original only, Reposts = repost/quote
  const totalRepostsCount = allPosts.filter((p) => isRepostPost(p)).length;
  const totalPostsCount = allPosts.filter((p) => !isRepostPost(p)).length;
  const totalContentCount = pagination + longformPagination;

  return {
    posts: allPosts,
    longformPosts: allLongformPosts,
    allContent,
    user: userRaw,
    queueTypes,
    hashTagPresets,
    // Pagination totals for display
    totalPostsCount,
    totalRepostsCount,
    totalLongformCount: longformPagination,
    totalContentCount,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    error: null,
  };
}
