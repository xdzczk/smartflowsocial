/**
 * TanStack Query hooks for engagement feed
 * Provides caching and background refetching for engagement feed page
 */

import { useFetcher, useLoaderData, useSearchParams } from "@remix-run/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";

import type { PostDTO } from "~/features/posts/dtos";
import { fromPostDTOArray } from "~/features/posts/dtos";
import type { PostData } from "~/features/posts/types";
import { useInfiniteRemixQuery } from "~/lib/query/hooks/useInfiniteRemixQuery";
import { safeValidateLoaderResponse } from "~/lib/validation/loader-responses";
import {
  engagementLoaderDataSchema,
  type EngagementLoaderData,
} from "~/lib/validation/schemas/loader-responses.schemas";

import { ENGAGEMENT_FEED_PAGE_SIZE } from "../constants";
import { useEngagementResolvedLoaderData } from "../context/EngagementResolvedLoaderContext";
import { ENGAGEMENT_LOADER_FALLBACK } from "../engagement-loader-fallback";
import type { EventStats, GroupedNotification } from "../types";

interface EngagementItemStateValue {
  state:
    | "UNHANDLED"
    | "DRAFTED"
    | "SCHEDULED"
    | "REPLIED"
    | "IGNORED"
    | "SNOOZED"
    | "HANDLED";
  repliedFromApp: boolean;
  snoozedUntil?: string | null;
}

interface EngagementLinkedAction {
  kind:
    | "DRAFT"
    | "SCHEDULED_REPLY"
    | "SCHEDULED_QUOTE"
    | "SCHEDULED_REPOST"
    | "QUEUED_REPLY"
    | "QUEUED_QUOTE"
    | "QUEUED_REPOST";
  postId?: string | null;
  draftId?: string | null;
  queueTypeId?: string | null;
  label?: string | null;
  scheduledFor?: string | null;
  isCanceled?: boolean;
  isPublished?: boolean;
}

// EngagementLoaderData is now exported from schemas

/** Fallback when loader returns invalid or error payload so the app does not throw. */
function getEmptyEngagementLoaderData(): EngagementLoaderData {
  return ENGAGEMENT_LOADER_FALLBACK;
}

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
    engagementLoaderDataSchema
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
                engagementLoaderDataSchema
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
 * Hook to fetch engagement data with infinite scroll support
 */
export function useEngagementInfiniteQuery() {
  const resolvedFromDefer = useEngagementResolvedLoaderData();
  const loaderDataRaw = useLoaderData();

  const validatedLoaderData = useMemo(() => {
    if (resolvedFromDefer !== undefined) {
      return (
        safeValidateLoaderResponse(
          resolvedFromDefer,
          engagementLoaderDataSchema
        ) ?? resolvedFromDefer
      );
    }
    return safeValidateLoaderResponse(
      loaderDataRaw,
      engagementLoaderDataSchema
    );
  }, [resolvedFromDefer, loaderDataRaw]);

  const initialData = validatedLoaderData ?? getEmptyEngagementLoaderData();

  return useInfiniteRemixQuery<EngagementLoaderData>({
    queryKey: engagementKeys.list(),
    initialData,
    getNextPageParam: (lastPage, allPages) => {
      const posts = Array.isArray(lastPage.posts) ? lastPage.posts : [];
      if (posts.length < ENGAGEMENT_FEED_PAGE_SIZE) {
        return;
      }
      return allPages.length + 1;
    },
    buildUrl: (pageParam) => `/dashboard/engagement/feed?page=${pageParam}`,
    staleTime: 15 * 1000, // 15 seconds
    maxPages: 10, // 10 pages × 50 = 500 posts max
    // Background refetching to keep engagement feed fresh (light real-time)
    refetchInterval: 15000, // Refetch every 15 seconds
    refetchIntervalInBackground: true, // Continue refetching when tab is inactive
  });
}

/**
 * Processed engagement data
 */
export function useEngagementData() {
  const query = useEngagementQuery();
  const rawData = query.data;

  if (!rawData) {
    const emptyPosts: PostData[] = [];
    const emptyStats: Record<string, EventStats> = {};
    const emptyGroupedNotifications: {
      replies: GroupedNotification[];
      quotes: GroupedNotification[];
    } = {
      replies: [],
      quotes: [],
    };
    const emptyTrustScores: Record<string, number> = {};
    const emptyEngagementItemStates: Record<string, EngagementItemStateValue> =
      {};
    const emptyEngagementLinkedActions: Record<
      string,
      EngagementLinkedAction[]
    > = {};
    const emptyGroupSummaries: Record<
      string,
      {
        total: number;
        needResponse: number;
        drafted: number;
        scheduled: number;
        handled: number;
      }
    > = {};
    return {
      posts: emptyPosts,
      stats: emptyStats,
      user: null,
      groupedNotifications: emptyGroupedNotifications,
      trustScores: emptyTrustScores,
      engagementItemStates: emptyEngagementItemStates,
      engagementLinkedActions: emptyEngagementLinkedActions,
      groupSummaries: emptyGroupSummaries,
      isLoading: query.isLoading,
      rawData: null,
    };
  }

  // Deserialize DTOs (with string dates) back to PostData (with Date objects)
  const posts: PostData[] = Array.isArray(rawData.posts)
    ? fromPostDTOArray(rawData.posts as unknown as PostDTO[])
    : [];

  // Type guard for stats
  const stats: Record<string, EventStats> =
    typeof rawData.stats === "object" && !Array.isArray(rawData.stats)
      ? rawData.stats
      : {};

  // Type guard for groupedNotifications - cast after validation
  const groupedNotifications: {
    replies: GroupedNotification[];
    quotes: GroupedNotification[];
  } = {
    replies: Array.isArray(rawData.groupedNotifications.replies)
      ? (rawData.groupedNotifications
          .replies as unknown as GroupedNotification[])
      : [],
    quotes: Array.isArray(rawData.groupedNotifications.quotes)
      ? (rawData.groupedNotifications
          .quotes as unknown as GroupedNotification[])
      : [],
  };

  // Type guard for trustScores
  const trustScores: Record<string, number> =
    typeof rawData.trustScores === "object" &&
    !Array.isArray(rawData.trustScores)
      ? Object.fromEntries(
          Object.entries(rawData.trustScores).map(([key, value]) => [
            key,
            typeof value === "number" ? value : 0,
          ])
        )
      : {};

  // Type guard for user
  const user =
    rawData.user &&
    typeof rawData.user === "object" &&
    !Array.isArray(rawData.user)
      ? rawData.user
      : null;

  // Type guard for engagementItemStates (defensive for loader response shape)
  const engagementItemStates: Record<string, EngagementItemStateValue> =
    typeof rawData.engagementItemStates === "object" &&
    rawData.engagementItemStates !== null && // eslint-disable-line @typescript-eslint/no-unnecessary-condition -- defensive guard for loader
    !Array.isArray(rawData.engagementItemStates)
      ? rawData.engagementItemStates
      : {};
  const engagementLinkedActions: Record<string, EngagementLinkedAction[]> =
    rawData.engagementLinkedActions ?? {};
  const groupSummaries: Record<
    string,
    {
      total: number;
      needResponse: number;
      drafted: number;
      scheduled: number;
      handled: number;
    }
  > = rawData.groupSummaries ?? {};

  return {
    posts,
    stats,
    user,
    groupedNotifications,
    trustScores,
    engagementItemStates,
    engagementLinkedActions,
    groupSummaries,
    isLoading: query.isLoading,
    rawData,
  };
}

/**
 * Processed engagement data from infinite query
 * Aggregates notifications across all pages
 */
export function useEngagementInfiniteData() {
  const query = useEngagementInfiniteQuery();
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } =
    query;

  // data.pages always exists due to initialData, so we process it directly
  if (data.pages.length === 0) {
    const emptyPosts: PostData[] = [];
    const emptyStats: Record<string, EventStats> = {};
    const emptyGroupedNotifications: {
      replies: GroupedNotification[];
      quotes: GroupedNotification[];
      mentions: GroupedNotification[];
    } = {
      replies: [],
      quotes: [],
      mentions: [],
    };
    const emptyTrustScores: Record<string, number> = {};
    const emptyEngagementItemStates: Record<string, EngagementItemStateValue> =
      {};
    const emptyEngagementLinkedActions: Record<
      string,
      EngagementLinkedAction[]
    > = {};
    const emptyGroupSummaries: Record<
      string,
      {
        total: number;
        needResponse: number;
        drafted: number;
        scheduled: number;
        handled: number;
      }
    > = {};
    return {
      posts: emptyPosts,
      stats: emptyStats,
      user: null,
      groupedNotifications: emptyGroupedNotifications,
      trustScores: emptyTrustScores,
      engagementItemStates: emptyEngagementItemStates,
      engagementLinkedActions: emptyEngagementLinkedActions,
      groupSummaries: emptyGroupSummaries,
      lastCheckedAt: null,
      followedPubkeys: [] as string[],
      isLoading,
      isFetchingNextPage,
      hasNextPage: false,
      fetchNextPage,
      rawData: null,
    };
  }

  // Flatten and aggregate across all pages
  const allPages = data.pages;
  const allPosts: PostData[] = [];
  const allStats: Record<string, EventStats> = {};
  const allReplies: GroupedNotification[] = [];
  const allQuotes: GroupedNotification[] = [];
  const allMentions: GroupedNotification[] = [];
  const allTrustScores: Record<string, number> = {};
  const allEngagementItemStates: Record<string, EngagementItemStateValue> = {};
  const allEngagementLinkedActions: Record<string, EngagementLinkedAction[]> =
    {};
  const allGroupSummaries: Record<
    string,
    {
      total: number;
      needResponse: number;
      drafted: number;
      scheduled: number;
      handled: number;
    }
  > = {};

  // Process each page
  for (const pageData of allPages) {
    // Aggregate posts
    const pagePosts: PostData[] = Array.isArray(pageData.posts)
      ? fromPostDTOArray(pageData.posts as unknown as PostDTO[])
      : [];
    allPosts.push(...pagePosts);

    // Aggregate stats
    if (typeof pageData.stats === "object" && !Array.isArray(pageData.stats)) {
      Object.assign(allStats, pageData.stats);
    }

    // Aggregate notifications
    const replies = Array.isArray(pageData.groupedNotifications.replies)
      ? (pageData.groupedNotifications
          .replies as unknown as GroupedNotification[])
      : [];
    const quotes = Array.isArray(pageData.groupedNotifications.quotes)
      ? (pageData.groupedNotifications
          .quotes as unknown as GroupedNotification[])
      : [];
    const mentions = Array.isArray(pageData.groupedNotifications.mentions)
      ? (pageData.groupedNotifications
          .mentions as unknown as GroupedNotification[])
      : [];
    allReplies.push(...replies);
    allQuotes.push(...quotes);
    allMentions.push(...mentions);

    // Aggregate trust scores
    if (
      typeof pageData.trustScores === "object" &&
      !Array.isArray(pageData.trustScores)
    ) {
      Object.assign(
        allTrustScores,
        Object.fromEntries(
          Object.entries(pageData.trustScores).map(([key, value]) => [
            key,
            typeof value === "number" ? value : 0,
          ])
        )
      );
    }

    // Aggregate engagement item states (defensive for page shape)
    if (
      typeof pageData.engagementItemStates === "object" &&
      pageData.engagementItemStates !== null && // eslint-disable-line @typescript-eslint/no-unnecessary-condition -- defensive guard for page data
      !Array.isArray(pageData.engagementItemStates)
    ) {
      Object.assign(allEngagementItemStates, pageData.engagementItemStates);
    }
    if (pageData.engagementLinkedActions) {
      Object.assign(
        allEngagementLinkedActions,
        pageData.engagementLinkedActions
      );
    }
    if (pageData.groupSummaries) {
      Object.assign(allGroupSummaries, pageData.groupSummaries);
    }
  }

  // Get user from last page
  const lastPage = allPages[allPages.length - 1];
  const firstPage = allPages[0];
  const lastCheckedAt =
    firstPage && typeof firstPage.lastCheckedAt === "string"
      ? firstPage.lastCheckedAt
      : null;
  const followedPubkeys: string[] = Array.isArray(firstPage?.followedPubkeys)
    ? firstPage.followedPubkeys
    : [];

  if (!lastPage) {
    return {
      posts: allPosts,
      stats: allStats,
      user: null,
      groupedNotifications: {
        replies: allReplies,
        quotes: allQuotes,
        mentions: allMentions,
      },
      trustScores: allTrustScores,
      engagementItemStates: allEngagementItemStates,
      engagementLinkedActions: allEngagementLinkedActions,
      groupSummaries: allGroupSummaries,
      lastCheckedAt: null,
      followedPubkeys,
      isLoading,
      isFetchingNextPage,
      hasNextPage: false,
      fetchNextPage,
      rawData: null,
    };
  }

  const user =
    lastPage.user &&
    typeof lastPage.user === "object" &&
    !Array.isArray(lastPage.user)
      ? lastPage.user
      : null;

  return {
    posts: allPosts,
    stats: allStats,
    user,
    groupedNotifications: {
      replies: allReplies,
      quotes: allQuotes,
      mentions: allMentions,
    },
    trustScores: allTrustScores,
    engagementItemStates: allEngagementItemStates,
    engagementLinkedActions: allEngagementLinkedActions,
    groupSummaries: allGroupSummaries,
    lastCheckedAt,
    followedPubkeys,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    rawData: lastPage,
  };
}

/** Engagement item state per eventId */
export type EngagementItemStateMap = Record<string, EngagementItemStateValue>;

/**
 * Hook to mark an engagement item as done (or replied from app).
 * Calls the API and invalidates the engagement list so the UI updates.
 */
export function useMarkEngagementDone() {
  const queryClient = useQueryClient();

  const markDone = async (
    eventId: string,
    repliedFromApp = false,
    state:
      | "UNHANDLED"
      | "DRAFTED"
      | "SCHEDULED"
      | "REPLIED"
      | "IGNORED"
      | "SNOOZED"
      | "HANDLED" = repliedFromApp ? "REPLIED" : "HANDLED",
    snoozedUntil?: string | null
  ) => {
    const res = await fetch("/api/engagement/mark-state", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eventId, repliedFromApp, state, snoozedUntil }),
    });
    const data = (await res.json()) as { success?: boolean; error?: string };
    if (!res.ok || !data.success) {
      throw new Error(data.error ?? "Failed to mark as done");
    }
    await queryClient.invalidateQueries({ queryKey: engagementKeys.lists() });
  };

  const linkAction = async (payload: {
    eventId: string;
    kind:
      | "DRAFT"
      | "SCHEDULED_REPLY"
      | "SCHEDULED_QUOTE"
      | "SCHEDULED_REPOST"
      | "QUEUED_REPLY"
      | "QUEUED_QUOTE"
      | "QUEUED_REPOST";
    state?:
      | "UNHANDLED"
      | "DRAFTED"
      | "SCHEDULED"
      | "REPLIED"
      | "IGNORED"
      | "SNOOZED"
      | "HANDLED";
    postId?: string | null;
    draftId?: string | null;
    queueTypeId?: string | null;
    label?: string | null;
    scheduledFor?: string | null;
  }) => {
    const res = await fetch("/api/engagement/linked-action", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = (await res.json()) as { success?: boolean; error?: string };
    if (!res.ok || !data.success) {
      throw new Error(data.error ?? "Failed to update linked action");
    }
    await queryClient.invalidateQueries({ queryKey: engagementKeys.lists() });
  };

  return { markDone, linkAction };
}
