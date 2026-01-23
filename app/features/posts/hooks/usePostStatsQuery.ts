/**
 * TanStack Query hook for fetching post stats client-side
 * Fetches stats after page load to avoid blocking initial render
 */

import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import type { PostStats } from "../stats.server";
import type { PostData } from "../types";

/**
 * Query key factory for post stats
 */
export const postStatsKeys = {
  all: ["post-stats"] as const,
  list: (eventIds: string[]) =>
    [...postStatsKeys.all, "list", eventIds.sort().join(",")] as const,
};

/**
 * Fetch stats from API route
 */
async function fetchPostStats(
  eventIds: string[]
): Promise<Record<string, PostStats>> {
  const response = await fetch("/api/post-stats", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ eventIds }),
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch stats: ${response.statusText}`);
  }

  const data = (await response.json()) as { stats: Record<string, PostStats> };
  return data.stats;
}

/**
 * Extract event IDs from posts
 */
function extractEventIds(posts: PostData[]): string[] {
  return posts
    .map((post) => {
      const signedEvent = post.signedEvent;
      if (
        signedEvent &&
        typeof signedEvent === "object" &&
        "id" in signedEvent &&
        typeof signedEvent["id"] === "string"
      ) {
        return signedEvent["id"];
      }
      return null;
    })
    .filter((id): id is string => id !== null);
}

/**
 * Hook to fetch post stats client-side
 * Merges fetched stats with initial empty stats
 */
export function usePostStatsQuery(posts: PostData[]) {
  // Extract event IDs from posts
  const eventIds = useMemo(() => extractEventIds(posts), [posts]);

  // Only fetch if we have event IDs
  const enabled = eventIds.length > 0;

  // Start with empty stats for all event IDs
  const initialStats = useMemo(() => {
    const stats: Record<string, PostStats> = {};
    eventIds.forEach((eventId) => {
      stats[eventId] = {
        likes: 0,
        replies: 0,
        mentions: 0,
        reposts: 0,
        zaps: 0,
        satszapped: 0,
      };
    });
    return stats;
  }, [eventIds]);

  const query = useQuery({
    queryKey: postStatsKeys.list(eventIds),
    queryFn: () => fetchPostStats(eventIds),
    enabled,
    staleTime: 30 * 1000, // 30 seconds - stats are fresh for 30 seconds
    gcTime: 5 * 60 * 1000, // 5 minutes - keep in cache for 5 minutes
    refetchOnWindowFocus: false, // Don't refetch on window focus
    refetchOnMount: false, // Don't refetch on mount if data is fresh
    retry: 1, // Retry once on failure
    retryDelay: 1000, // Wait 1 second before retry
    // Use select to only return merged stats, preventing re-renders when other query data changes
    select: (data: Record<string, PostStats>) => {
      // Merge fetched stats with initial empty stats
      return { ...initialStats, ...data };
    },
  });

  return {
    stats: query.data ?? initialStats,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    isFetching: query.isFetching,
  };
}
