/**
 * TanStack Query hooks for engagement feed
 * Provides caching and background refetching for engagement feed page
 */

import { useFetcher, useLoaderData } from "@remix-run/react";
import { useSearchParams } from "@remix-run/react";
import { useQuery } from "@tanstack/react-query";

import type { PostData } from "~/features/posts/types";

import type { EventStats, GroupedNotification } from "../types";

/**
 * Type for engagement loader data
 */
export type EngagementLoaderData = {
  posts: PostData[];
  stats: Record<string, EventStats>;
  user: Record<string, unknown> | null;
  notifications: {
    all: unknown[];
    replies: unknown[];
    mentions: unknown[];
    zaps: unknown[];
    quotes: unknown[];
  };
  groupedNotifications: {
    replies: GroupedNotification[];
    quotes: GroupedNotification[];
  };
  trustScores: Record<string, number>;
};

/**
 * Query key factory for engagement
 */
export const engagementKeys = {
  all: ["engagement"] as const,
  lists: () => [...engagementKeys.all, "list"] as const,
  list: (page?: number) => [...engagementKeys.lists(), page] as const,
  detail: (id: string) => [...engagementKeys.all, "detail", id] as const,
};

/**
 * Hook to fetch engagement data with TanStack Query
 */
export function useEngagementQuery() {
  const [searchParams] = useSearchParams();
  const page = parseInt(searchParams.get("page") ?? "1", 10);
  
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
  const loaderData = useLoaderData() as unknown as EngagementLoaderData;
  const fetcher = useFetcher();

  return useQuery({
    queryKey: engagementKeys.list(page),
    queryFn: async () => {
      // Use fetcher to refetch data
      const url = `/dashboard/engagement/feed?page=${page}`;
      fetcher.load(url);
      
      return new Promise<EngagementLoaderData>((resolve) => {
        const checkFetcher = () => {
          if (fetcher.state === "idle") {
            if (fetcher.data) {
              resolve(fetcher.data as unknown as EngagementLoaderData);
            } else {
              resolve(loaderData);
            }
          } else {
            setTimeout(checkFetcher, 50);
          }
        };
        checkFetcher();
      });
    },
    initialData: loaderData,
    staleTime: 30 * 1000, // 30 seconds
    refetchOnMount: false,
  });
}

/**
 * Processed engagement data
 */
export function useEngagementData() {
  const query = useEngagementQuery();
  const rawData = query.data;

  // Type guard for posts
  const posts: PostData[] = Array.isArray(rawData.posts)
    ? rawData.posts.filter((post): post is PostData => {
        return (
          post !== null &&
          typeof post === "object" &&
          "id" in post &&
          typeof (post as { id: unknown }).id === "string"
        );
      })
    : [];

  // Type guard for stats
  const stats: Record<string, EventStats> =
    rawData.stats && typeof rawData.stats === "object" && !Array.isArray(rawData.stats)
      ? rawData.stats
      : {};

  // Type guard for groupedNotifications
  const groupedNotifications: {
    replies: GroupedNotification[];
    quotes: GroupedNotification[];
  } = {
    replies: Array.isArray(rawData.groupedNotifications?.replies)
      ? rawData.groupedNotifications.replies
      : [],
    quotes: Array.isArray(rawData.groupedNotifications?.quotes)
      ? rawData.groupedNotifications.quotes
      : [],
  };

  // Type guard for trustScores
  const trustScores: Record<string, number> =
    rawData.trustScores && typeof rawData.trustScores === "object" && !Array.isArray(rawData.trustScores)
      ? Object.fromEntries(
          Object.entries(rawData.trustScores).map(([key, value]) => [
            key,
            typeof value === "number" ? value : 0,
          ]),
        )
      : {};

  // Type guard for user
  const user =
    rawData.user && typeof rawData.user === "object" && !Array.isArray(rawData.user)
      ? rawData.user
      : null;

  return {
    posts,
    stats,
    user,
    groupedNotifications,
    trustScores,
    isLoading: query.isLoading,
    rawData,
  };
}

