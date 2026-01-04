/**
 * TanStack Query hooks for engagement feed
 * Provides caching and background refetching for engagement feed page
 */

import { useFetcher, useLoaderData } from "@remix-run/react";
import { useSearchParams } from "@remix-run/react";
import { useQuery } from "@tanstack/react-query";

import { safeValidateLoaderResponse } from "~/lib/validation/loader-responses.server";
import {
  engagementLoaderDataSchema,
  type EngagementLoaderData,
} from "~/lib/validation/schemas/loader-responses.schemas";

import type { PostData } from "~/features/posts/types";
import type { PostDTO } from "~/features/posts/dtos";
import { fromPostDTOArray } from "~/features/posts/dtos";

import type { EventStats, GroupedNotification } from "../types";

// EngagementLoaderData is now exported from schemas

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
  
  const loaderDataRaw = useLoaderData();
  const fetcher = useFetcher();

  // Validate initial loader data
  const validatedLoaderData = safeValidateLoaderResponse(
    loaderDataRaw,
    engagementLoaderDataSchema,
  );

  return useQuery({
    queryKey: engagementKeys.list(page),
    queryFn: async () => {
      // Use fetcher to refetch data
      const url = `/dashboard/engagement/feed?page=${page}`;
      fetcher.load(url);
      
      return new Promise<EngagementLoaderData>((resolve, reject) => {
        const checkFetcher = () => {
          if (fetcher.state === "idle") {
            if (fetcher.data) {
              const validated = safeValidateLoaderResponse(
                fetcher.data,
                engagementLoaderDataSchema,
              );
              if (validated) {
                resolve(validated as EngagementLoaderData);
              } else {
                reject(new Error("Invalid data received from fetcher"));
              }
            } else if (validatedLoaderData) {
              resolve(validatedLoaderData as EngagementLoaderData);
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
    initialData: validatedLoaderData ?? undefined,
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

  if (!rawData) {
    return {
      posts: [] as PostData[],
      stats: {} as Record<string, EventStats>,
      user: null,
      groupedNotifications: {
        replies: [] as GroupedNotification[],
        quotes: [] as GroupedNotification[],
      },
      trustScores: {} as Record<string, number>,
      isLoading: query.isLoading,
      rawData: null,
    };
  }

  // Deserialize DTOs (with string dates) back to PostData (with Date objects)
  const posts: PostData[] = Array.isArray(rawData.posts)
    ? fromPostDTOArray(rawData.posts as PostDTO[])
    : [];

  // Type guard for stats
  const stats: Record<string, EventStats> =
    rawData.stats && typeof rawData.stats === "object" && !Array.isArray(rawData.stats)
      ? rawData.stats
      : {};

  // Type guard for groupedNotifications - cast after validation
  const groupedNotifications: {
    replies: GroupedNotification[];
    quotes: GroupedNotification[];
  } = {
    replies: Array.isArray(rawData.groupedNotifications?.replies)
      ? (rawData.groupedNotifications.replies as unknown as GroupedNotification[])
      : [],
    quotes: Array.isArray(rawData.groupedNotifications?.quotes)
      ? (rawData.groupedNotifications.quotes as unknown as GroupedNotification[])
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

