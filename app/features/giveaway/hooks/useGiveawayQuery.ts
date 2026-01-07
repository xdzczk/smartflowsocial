/**
 * TanStack Query hooks for giveaway
 * Provides caching and background refetching for giveaway pages
 */

import {
  useFetcher,
  useLoaderData,
  useParams,
  useSearchParams,
} from "@remix-run/react";
import { useQuery } from "@tanstack/react-query";

import type { PostDTO } from "~/features/posts/dtos";
import { fromPostDTOArray } from "~/features/posts/dtos";
import type { PostStats } from "~/features/posts/stats.server";
import type { PostData, QueueType } from "~/features/posts/types";
import type { UserWithHashTagPresets as _UserWithHashTagPresets } from "~/features/user";
import { safeValidateLoaderResponse } from "~/lib/validation/loader-responses";
import {
  giveawayLoaderDataSchema,
  type GiveawayLoaderData,
} from "~/lib/validation/schemas/loader-responses.schemas";

import type { RelatedEvent } from "../types";

// GiveawayLoaderData is now exported from schemas

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
  const queueType = params["queueType"] ?? "all";
  const days = parseInt(searchParams.get("days") ?? "7", 10);

  const loaderDataRaw = useLoaderData();
  const fetcher = useFetcher();

  // Validate initial loader data
  const validatedLoaderData = safeValidateLoaderResponse(
    loaderDataRaw,
    giveawayLoaderDataSchema
  );

  return useQuery({
    queryKey: giveawayKeys.list(queueType, days),
    queryFn: async () => {
      // Use fetcher to refetch data
      const url = `/dashboard/giveaway${queueType !== "all" ? `/${queueType}` : ""}?days=${days}`;
      fetcher.load(url);

      return new Promise<GiveawayLoaderData>((resolve, reject) => {
        const checkFetcher = () => {
          if (fetcher.state === "idle") {
            if (fetcher.data) {
              const validated = safeValidateLoaderResponse(
                fetcher.data,
                giveawayLoaderDataSchema
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
    refetchOnMount: false,
  });
}

/**
 * Processed giveaway data with deserialized DTOs
 */
export function useGiveawayData() {
  const query = useGiveawayQuery();
  const rawData = query.data;

  if (!rawData) {
    const emptyPosts: Array<
      PostData & { stats?: PostStats; totalEngagement?: number }
    > = [];
    const emptyStats: Record<string, PostStats> = {};
    const emptyRelatedEvents: RelatedEvent[] = [];
    const emptyQueueTypes: QueueType[] = [];
    return {
      posts: emptyPosts,
      stats: emptyStats,
      relatedEvents: emptyRelatedEvents,
      user: null,
      queueTypes: emptyQueueTypes,
      selectedQueueType: "all",
      isLoading: query.isLoading,
      rawData: null,
    };
  }

  // Deserialize DTOs (with string dates) back to PostData (with Date objects)
  const posts: Array<
    PostData & {
      stats?: PostStats;
      totalEngagement?: number;
    }
  > = Array.isArray(rawData.posts)
    ? rawData.posts.map((dto) => {
        const postArray = fromPostDTOArray([dto as PostDTO]);
        const post = postArray[0];
        if (!post) {
          throw new Error("Failed to deserialize post DTO");
        }
        const result: PostData & {
          stats?: PostStats;
          totalEngagement?: number;
        } = {
          ...post,
          stats: dto.stats,
          totalEngagement: dto.totalEngagement,
        };
        return result;
      })
    : [];

  // Type assertions for stats
  const stats: Record<string, PostStats> =
    rawData.stats &&
    typeof rawData.stats === "object" &&
    !Array.isArray(rawData.stats)
      ? rawData.stats
      : {};

  return {
    posts,
    stats,
    relatedEvents: Array.isArray(rawData.relatedEvents)
      ? rawData.relatedEvents
      : [],
    user: rawData.user,
    queueTypes: Array.isArray(rawData.queueTypes) ? rawData.queueTypes : [],
    selectedQueueType: rawData.selectedQueueType ?? "all",
    isLoading: query.isLoading,
    rawData,
  };
}
