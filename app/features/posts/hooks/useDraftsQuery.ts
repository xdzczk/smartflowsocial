/**
 * TanStack Query hooks for drafts
 * Provides caching and background refetching for drafts page
 */

import { useFetcher, useLoaderData, useParams } from "@remix-run/react";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import { useInfiniteRemixQuery } from "~/lib/query/hooks/useInfiniteRemixQuery";
import { getNextPageParamFromPaginationTotals } from "~/lib/query/infinite-remix-pagination";
import { useDeferredRouteLoaderData } from "~/lib/remix/deferred-route-loader-context";
import { safeValidateLoaderResponse } from "~/lib/validation/loader-responses";
import {
  draftsLoaderDataSchema,
  type DraftsLoaderData,
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
} from "../types";
import { convertJsonValueToScheduleConfig } from "../types";

/**
 * Query key factory for drafts
 */
export const draftsKeys = {
  all: ["drafts"] as const,
  lists: () => [...draftsKeys.all, "list"] as const,
  list: (queueType?: string) => [...draftsKeys.lists(), queueType] as const,
};

// DraftsLoaderData is now exported from schemas

/**
 * Hook to fetch drafts data with TanStack Query
 */
export function useDraftsQuery() {
  const params = useParams();
  const queueType = params["queueType"] ?? "all";

  const resolvedFromDefer = useDeferredRouteLoaderData();
  const loaderDataRaw = useLoaderData();
  const fetcher = useFetcher();

  const validatedLoaderData = useMemo(() => {
    if (resolvedFromDefer !== undefined && resolvedFromDefer !== null) {
      return (
        safeValidateLoaderResponse(resolvedFromDefer, draftsLoaderDataSchema) ??
        undefined
      );
    }
    return safeValidateLoaderResponse(loaderDataRaw, draftsLoaderDataSchema);
  }, [resolvedFromDefer, loaderDataRaw]);

  return useQuery({
    queryKey: draftsKeys.list(queueType),
    queryFn: async () => {
      const url = `/dashboard/drafts${queueType !== "all" ? `/${queueType}` : ""}`;
      fetcher.load(url);

      return new Promise<DraftsLoaderData>((resolve, reject) => {
        const checkFetcher = () => {
          if (fetcher.state === "idle") {
            if (fetcher.data) {
              const validated = safeValidateLoaderResponse(
                fetcher.data,
                draftsLoaderDataSchema
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
 * Hook to fetch drafts with infinite scroll support
 */
export function useDraftsInfiniteQuery() {
  const params = useParams();
  const queueType = params["queueType"] ?? "all";

  const resolvedFromDefer = useDeferredRouteLoaderData();
  const loaderDataRaw = useLoaderData();

  const validatedLoaderData = useMemo(() => {
    if (resolvedFromDefer !== undefined && resolvedFromDefer !== null) {
      return (
        safeValidateLoaderResponse(resolvedFromDefer, draftsLoaderDataSchema) ??
        null
      );
    }
    return safeValidateLoaderResponse(loaderDataRaw, draftsLoaderDataSchema);
  }, [resolvedFromDefer, loaderDataRaw]);

  if (!validatedLoaderData) {
    throw new Error("Invalid loader data");
  }

  return useInfiniteRemixQuery<DraftsLoaderData>({
    queryKey: draftsKeys.list(queueType),
    initialData: validatedLoaderData,
    getNextPageParam: (lastPage, allPages) =>
      getNextPageParamFromPaginationTotals(lastPage, allPages),
    buildUrl: (pageParam) =>
      `/dashboard/drafts${queueType !== "all" ? `/${queueType}` : ""}?page=${pageParam}`,
    staleTime: 30 * 1000, // 30 seconds
    maxPages: 10, // Limit to 200 items (10 pages × 20 items per page)
  });
}

/**
 * Hook to get processed drafts data from query
 */
export function useDraftsData() {
  const { data, isLoading, error } = useDraftsQuery();

  if (!data) {
    return {
      posts: [] as PostData[],
      longformPosts: [] as LongFormPostData[],
      allContent: [] as CombinedContent[],
      user: null as UserData | null,
      queueTypes: [] as QueueType[],
      selectedQueueType: "all",
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
  const selectedQueueTypeRaw =
    "selectedQueueType" in typedData ? typedData.selectedQueueType : "all";

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
    "createdAt",
    "desc"
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
            const statusRaw = (q as { status?: unknown }).status;
            const status =
              typeof statusRaw === "string" &&
              (statusRaw === "active" ||
                statusRaw === "paused" ||
                statusRaw === "archived")
                ? statusRaw
                : undefined;
            const userId = typeof q.userId === "string" ? q.userId : "";
            const queueType: QueueType = {
              id,
              name,
              color,
              colorToken: colorToken ?? undefined,
              description: undefined,
              scheduleType,
              scheduleConfig,
              status,
              isEnabled,
              userId,
            };
            return queueType;
          }
          return null;
        })
        .filter((qt): qt is QueueType => qt !== null)
    : [];
  const selectedQueueType =
    typeof selectedQueueTypeRaw === "string" ? selectedQueueTypeRaw : "all";

  return {
    posts,
    longformPosts,
    allContent,
    user: userRaw,
    queueTypes,
    selectedQueueType,
    isLoading,
    error,
  };
}

/**
 * Hook to get processed drafts data from infinite query
 * Flattens posts and longform posts across all pages
 */
export function useDraftsInfiniteData() {
  const query = useDraftsInfiniteQuery();
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
      selectedQueueType: "all",
      bulkDraftGroups: [] as Array<{
        id: string;
        postCount: number;
        updatedAt: string;
      }>,
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
    "createdAt",
    "desc"
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
      selectedQueueType: "all",
      bulkDraftGroups: [] as Array<{
        id: string;
        postCount: number;
        updatedAt: string;
      }>,
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
  const selectedQueueTypeRaw =
    "selectedQueueType" in lastPage ? lastPage.selectedQueueType : "all";

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
            const statusRaw = (q as { status?: unknown }).status;
            const status =
              typeof statusRaw === "string" &&
              (statusRaw === "active" ||
                statusRaw === "paused" ||
                statusRaw === "archived")
                ? statusRaw
                : undefined;
            const userId = typeof q.userId === "string" ? q.userId : "";
            const queueType: QueueType = {
              id,
              name,
              color,
              colorToken: colorToken ?? undefined,
              description: undefined,
              scheduleType,
              scheduleConfig,
              status,
              isEnabled,
              userId,
            };
            return queueType;
          }
          return null;
        })
        .filter((qt): qt is QueueType => qt !== null)
    : [];
  const selectedQueueType =
    typeof selectedQueueTypeRaw === "string" ? selectedQueueTypeRaw : "all";

  const bulkDraftGroupsRaw =
    "bulkDraftGroups" in lastPage && Array.isArray(lastPage.bulkDraftGroups)
      ? lastPage.bulkDraftGroups
      : [];
  const bulkDraftGroups = bulkDraftGroupsRaw.map(
    (g: { id: string; postCount: number; updatedAt: string }) => ({
      id: g.id,
      postCount: g.postCount,
      updatedAt: g.updatedAt,
    })
  );

  return {
    posts: allPosts,
    longformPosts: allLongformPosts,
    allContent,
    user: userRaw,
    queueTypes,
    selectedQueueType,
    bulkDraftGroups,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    error: null,
  };
}
