/**
 * TanStack Query hooks for dashboard data
 * Provides caching and background refetching for dashboard index
 */

import { useFetcher, useLoaderData } from "@remix-run/react";
import { useParams, useSearchParams } from "@remix-run/react";
import { useQuery } from "@tanstack/react-query";

import type { PostDTO, LongFormPostDTO } from "../dtos";
import {
  fromPostDTOArray,
  fromLongFormPostDTOArray,
} from "../dtos";
import { convertJsonValueToScheduleConfig } from "../types";
import type {
  PostData,
  LongFormPostData,
  CombinedContent,
  QueueType,
} from "../types";
import type { UserData } from "../types";
import type { HashTagPreset } from "../types";

/**
 * Query key factory for dashboard data
 */
export const dashboardKeys = {
  all: ["dashboard"] as const,
  lists: () => [...dashboardKeys.all, "list"] as const,
  list: (queueType?: string, tab?: string) =>
    [...dashboardKeys.lists(), queueType, tab] as const,
};

/**
 * Type for dashboard loader data
 */
export type DashboardLoaderData = {
  scheduledPosts: PostDTO[];
  longformPosts: LongFormPostDTO[];
  allContent: CombinedContent[];
  user: UserData | null;
  queueTypes: QueueType[];
  hashTagPresets: HashTagPreset[];
  postStatistics?: {
    totalScheduled: number;
    totalDrafts: number;
    totalPosted: number;
  };
};

/**
 * Hook to fetch dashboard data with TanStack Query
 */
export function useDashboardQuery() {
  const params = useParams();
  const [searchParams] = useSearchParams();
  const queueType = params.queueType ?? "all";
  const currentTab = searchParams.get("tab") ?? "all";
  
  const loaderData = useLoaderData();
  const fetcher = useFetcher();

  return useQuery({
    queryKey: dashboardKeys.list(queueType, currentTab),
    queryFn: async () => {
      const url = `/dashboard${queueType !== "all" ? `/${queueType}` : ""}?tab=${currentTab}`;
      fetcher.load(url);
      
      return new Promise<DashboardLoaderData>((resolve, reject) => {
        const checkFetcher = () => {
          if (fetcher.state === "idle") {
            if (fetcher.data) {
              resolve(fetcher.data as unknown as DashboardLoaderData);
            } else {
              resolve(loaderData as DashboardLoaderData);
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
    initialData: loaderData as DashboardLoaderData,
    staleTime: 30 * 1000, // 30 seconds
    gcTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: true,
    refetchOnMount: false,
  });
}

/**
 * Hook to get processed dashboard data from query
 */
export function useDashboardData() {
  const { data, isLoading, error } = useDashboardQuery();
  
  if (!data) {
    return {
      scheduledPosts: [] as PostData[],
      longformPosts: [] as LongFormPostData[],
      allContent: [] as CombinedContent[],
      user: null as UserData | null,
      queueTypes: [] as QueueType[],
      hashTagPresets: [] as HashTagPreset[],
      postStatistics: undefined,
      isLoading,
      error,
    };
  }

  const typedData = data;
  const scheduledPostsRaw =
    "scheduledPosts" in typedData && Array.isArray(typedData.scheduledPosts)
      ? typedData.scheduledPosts
      : [];
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
  const postStatisticsRaw = "postStatistics" in typedData ? typedData.postStatistics : undefined;

  const scheduledPosts: PostData[] = Array.isArray(scheduledPostsRaw)
    ? fromPostDTOArray(scheduledPostsRaw)
    : [];
  const longformPosts: LongFormPostData[] = Array.isArray(longformPostsRaw)
    ? fromLongFormPostDTOArray(longformPostsRaw)
    : [];
  const allContent: CombinedContent[] = Array.isArray(allContentRaw)
    ? (allContentRaw as unknown as CombinedContent[])
    : [];
  const queueTypes: QueueType[] = Array.isArray(queueTypesRaw)
    ? queueTypesRaw.map((qt: unknown) => {
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
    scheduledPosts,
    longformPosts,
    allContent,
    user: userRaw,
    queueTypes,
    hashTagPresets,
    postStatistics: postStatisticsRaw,
    isLoading,
    error,
  };
}

