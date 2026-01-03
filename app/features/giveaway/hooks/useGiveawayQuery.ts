/**
 * TanStack Query hooks for giveaway
 * Provides caching and background refetching for giveaway pages
 */

import { useFetcher, useLoaderData } from "@remix-run/react";
import { useParams, useSearchParams } from "@remix-run/react";
import { useQuery } from "@tanstack/react-query";

import type { PostDTO } from "~/features/posts/dtos";
import { fromPostDTOArray } from "~/features/posts/dtos";
import type { PostStats } from "~/features/posts/stats.server";
import type { PostData, QueueType } from "~/features/posts/types";
import type { UserWithHashTagPresets } from "~/features/user";

import type { RelatedEvent } from "../types";

/**
 * Type for giveaway loader data
 */
export type GiveawayLoaderData = {
  posts: (PostDTO & {
    stats?: PostStats;
    totalEngagement?: number;
  })[];
  stats: Record<string, PostStats>;
  relatedEvents: RelatedEvent[]; // Uses RelatedEvent from ../types
  user: UserWithHashTagPresets;
  queueTypes: QueueType[];
  selectedQueueType: string;
};

/**
 * Query key factory for giveaway
 */
export const giveawayKeys = {
  all: ["giveaway"] as const,
  lists: () => [...giveawayKeys.all, "list"] as const,
  list: (queueType?: string, days?: number) =>
    [...giveawayKeys.lists(), queueType, days] as const,
  detail: (id: string) => [...giveawayKeys.all, "detail", id] as const,
};

/**
 * Hook to fetch giveaway data with TanStack Query
 */
export function useGiveawayQuery() {
  const params = useParams();
  const [searchParams] = useSearchParams();
  const queueType = params.queueType ?? "all";
  const days = parseInt(searchParams.get("days") ?? "7", 10);
  
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
  const loaderData = useLoaderData() as unknown as GiveawayLoaderData;
  const fetcher = useFetcher();

  return useQuery({
    queryKey: giveawayKeys.list(queueType, days),
    queryFn: async () => {
      // Use fetcher to refetch data
      const url = `/dashboard/giveaway${queueType !== "all" ? `/${queueType}` : ""}?days=${days}`;
      fetcher.load(url);
      
      return new Promise<GiveawayLoaderData>((resolve) => {
        const checkFetcher = () => {
          if (fetcher.state === "idle") {
            if (fetcher.data) {
              resolve(fetcher.data as unknown as GiveawayLoaderData);
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
 * Processed giveaway data with deserialized DTOs
 */
export function useGiveawayData() {
  const query = useGiveawayQuery();
  const rawData = query.data;

  // Deserialize DTOs (with string dates) back to PostData (with Date objects)
  const posts: (PostData & {
    stats?: PostStats;
    totalEngagement?: number;
  })[] = Array.isArray(rawData.posts)
    ? rawData.posts.map((dto) => {
        const post = fromPostDTOArray([dto as PostDTO])[0];
        return {
          ...post,
          stats: dto.stats,
          totalEngagement: dto.totalEngagement,
        };
      })
    : [];

  // Type assertions for stats
  const stats: Record<string, PostStats> =
    rawData.stats && typeof rawData.stats === "object" && !Array.isArray(rawData.stats)
      ? rawData.stats
      : {};

  return {
    posts,
    stats,
    relatedEvents: Array.isArray(rawData.relatedEvents) ? rawData.relatedEvents : [],
    user: rawData.user,
    queueTypes: Array.isArray(rawData.queueTypes) ? rawData.queueTypes : [],
    selectedQueueType: rawData.selectedQueueType ?? "all",
    isLoading: query.isLoading,
    rawData,
  };
}

