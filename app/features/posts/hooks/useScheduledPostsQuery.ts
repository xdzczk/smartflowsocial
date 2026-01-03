/**
 * TanStack Query hooks for scheduled posts
 * Provides caching and background refetching for scheduled posts page
 */

import { useFetcher, useLoaderData } from "@remix-run/react";
import { useParams, useSearchParams } from "@remix-run/react";
import { useQuery } from "@tanstack/react-query";

import type { PostDTO, LongFormPostDTO } from "../dtos";
import {
  fromPostDTOArray,
  fromLongFormPostDTOArray,
} from "../dtos";
import type {
  PostData,
  LongFormPostData,
  CombinedContent,
  QueueType,
  UserData,
  HashTagPreset,
} from "../types";
import { convertJsonValueToScheduleConfig } from "../types";

/**
 * Query key factory for scheduled posts
 */
export const scheduledPostsKeys = {
  all: ["scheduled-posts"] as const,
  lists: () => [...scheduledPostsKeys.all, "list"] as const,
  list: (queueType?: string, tab?: string) =>
    [...scheduledPostsKeys.lists(), queueType, tab] as const,
};

/**
 * Type for scheduled posts loader data
 */
export type ScheduledPostsLoaderData = {
  posts: PostDTO[];
  longformPosts: LongFormPostDTO[];
  allContent: CombinedContent[];
  user: UserData | null;
  queueTypes: QueueType[];
  hashTagPresets: HashTagPreset[];
};

/**
 * Hook to fetch scheduled posts with TanStack Query
 */
export function useScheduledPostsQuery() {
  const params = useParams();
  const [searchParams] = useSearchParams();
  const queueType = params.queueType ?? "all";
  const currentTab = searchParams.get("tab") ?? "all";
  
  const loaderData = useLoaderData();
  const fetcher = useFetcher();

  return useQuery({
    queryKey: scheduledPostsKeys.list(queueType, currentTab),
    queryFn: async () => {
      const url = `/dashboard/scheduled${queueType !== "all" ? `/${queueType}` : ""}?tab=${currentTab}`;
      fetcher.load(url);
      
      return new Promise<ScheduledPostsLoaderData>((resolve, reject) => {
        const checkFetcher = () => {
          if (fetcher.state === "idle") {
            if (fetcher.data) {
              resolve(fetcher.data as unknown as ScheduledPostsLoaderData);
            } else {
              resolve(loaderData as ScheduledPostsLoaderData);
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
    initialData: loaderData as ScheduledPostsLoaderData,
    staleTime: 30 * 1000, // 30 seconds
    gcTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: true,
    refetchOnMount: false,
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
    "posts" in typedData && Array.isArray(typedData.posts) ? typedData.posts : [];
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
  const hashTagPresetsRaw =
    "hashTagPresets" in typedData && Array.isArray(typedData.hashTagPresets)
      ? typedData.hashTagPresets
      : [];

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
    ? queueTypesRaw
        .map((qt: unknown) => {
          if (
            qt &&
            typeof qt === "object" &&
            qt !== null &&
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
          }
          return null;
        })
        .filter((qt): qt is QueueType => qt !== null)
    : [];
  const hashTagPresets: HashTagPreset[] = Array.isArray(hashTagPresetsRaw)
    ? (hashTagPresetsRaw as unknown as HashTagPreset[])
    : [];

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

