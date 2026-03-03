import { useNavigate } from "@remix-run/react";
import type { FetcherWithComponents, useFetcher } from "@remix-run/react";
import { useState, useEffect, useMemo } from "react";

import { logClientError } from "~/lib/error-handler.client";
import { nostrAdapter } from "~/lib/nostr-adapter.client";
import {
  addHours,
  compareZonedDateTime,
  formatForDateTimeLocal,
  fromDate,
  fromUnixTimestamp,
  nowInTimezone,
  nowSeconds,
} from "~/lib/temporal";

import type { PostData } from "../types";

interface Post {
  id: string;
  caption?: string | null;
  publishedAt: Date | null;
  fileUrl: string[];
  signedEvent: { id: string };
  queueType?: { name: string; color?: string | null } | null;
  status?: string;
  [key: string]: unknown; // Allow additional properties from Prisma
}

type Stats = Record<
  string,
  {
    likes?: number;
    replies?: number;
    mentions?: number;
    reposts?: number;
    zaps?: number;
    satszapped?: number;
  }
>;

interface User {
  timezone?: string | null;
  relays?: string[];
}

interface RepostFetcherData {
  repostData?: PostData[];
  scheduledRepostData?: PostData[];
  quotePostData?: {
    caption?: string;
    fileUrl?: string | string[];
    queueType?: string;
    scheduledFor?: string;
    originalPostId?: string;
    originalEventId?: string;
    originalEventPubkey?: string;
    [key: string]: unknown;
  };
}

export interface IndividualRepostFetcherData {
  repostEventData?: {
    kind: number;
    content: string;
    tags: string[][];
    created_at: number;
    pubkey: string;
    [key: string]: unknown;
  };
  quotePostData?: {
    caption?: string;
    fileUrl?: string | string[];
    queueType?: string;
    scheduledFor?: string;
    originalPostId?: string;
    originalEventId?: string;
    originalEventPubkey?: string;
    [key: string]: unknown;
  };
  error?: boolean;
  message?: string;
}

interface UseRecyclablesStateProps {
  posts: Post[] | PostData[]; // Accept any post type from loader
  stats: Stats;
  user?: User | null;
  repostFetcher:
    | FetcherWithComponents<RepostFetcherData>
    | FetcherWithComponents<unknown>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Remix fetcher type requires any for dynamic action types
  bulkDeleteFetcher: ReturnType<typeof useFetcher<any>>;
  bulkRepostFetcher: ReturnType<typeof useFetcher>;
  individualRepostFetcher: FetcherWithComponents<IndividualRepostFetcherData>;
}

interface SortConfig {
  key: string;
  direction: "asc" | "desc";
}

/**
 * Custom hook for managing recyclables posts state and operations
 */
export function useRecyclablesState({
  posts,
  stats,
  user,
  repostFetcher,
  bulkDeleteFetcher,
  bulkRepostFetcher,
  individualRepostFetcher,
}: UseRecyclablesStateProps) {
  const navigate = useNavigate();
  const [sortConfig, setSortConfig] = useState<SortConfig>({
    key: "publishedAt",
    direction: "desc",
  });
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [selectedPosts, setSelectedPosts] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<{
    type: "success" | "error";
    message: string;
    link?: string;
    linkText?: string;
  } | null>(null);

  // Sort and filter posts
  // ============================================================================
  // Helper Functions
  // ============================================================================

  function getEventId(post: PostData): string | null {
    if (
      post.signedEvent &&
      typeof post.signedEvent === "object" &&
      "id" in post.signedEvent &&
      typeof post.signedEvent.id === "string"
    ) {
      return post.signedEvent.id;
    }
    return null;
  }

  function getPostStats(
    eventId: string | null,
    stats: Record<string, unknown>
  ): Record<string, unknown> {
    if (
      eventId &&
      eventId in stats &&
      typeof stats[eventId] === "object" &&
      !Array.isArray(stats[eventId])
    ) {
      return stats[eventId] as Record<string, unknown>;
    }
    return {};
  }

  function compareByEngagementMetric(
    a: PostData,
    b: PostData,
    sortKey: string,
    direction: "asc" | "desc",
    stats: Record<string, unknown>
  ): number {
    const aEventId = getEventId(a);
    const bEventId = getEventId(b);
    const aStats = getPostStats(aEventId, stats);
    const bStats = getPostStats(bEventId, stats);
    const aValue = Number(aStats[sortKey] ?? 0);
    const bValue = Number(bStats[sortKey] ?? 0);
    return direction === "asc" ? aValue - bValue : bValue - aValue;
  }

  function compareByDate(
    a: PostData,
    b: PostData,
    sortKey: string,
    direction: "asc" | "desc"
  ): number {
    try {
      const valueA = a[sortKey as keyof PostData];
      const valueB = b[sortKey as keyof PostData];

      const zonedA =
        valueA instanceof Date
          ? fromDate(valueA, "UTC")
          : typeof valueA === "string"
            ? fromUnixTimestamp(parseInt(valueA, 10), "UTC")
            : typeof valueA === "number"
              ? fromUnixTimestamp(Math.floor(valueA / 1000), "UTC")
              : null;

      const zonedB =
        valueB instanceof Date
          ? fromDate(valueB, "UTC")
          : typeof valueB === "string"
            ? fromUnixTimestamp(parseInt(valueB, 10), "UTC")
            : typeof valueB === "number"
              ? fromUnixTimestamp(Math.floor(valueB / 1000), "UTC")
              : null;

      if (!zonedA || !zonedB) return 0;

      const comparison = compareZonedDateTime(zonedA, zonedB);
      return direction === "asc" ? comparison : -comparison;
    } catch {
      // Fallback to 0 if conversion fails
      return 0;
    }
  }

  function compareByGenericValue(
    a: PostData,
    b: PostData,
    sortKey: string,
    direction: "asc" | "desc"
  ): number {
    const aValue = (a as unknown as Record<string, unknown>)[sortKey] as
      | string
      | number
      | undefined;
    const bValue = (b as unknown as Record<string, unknown>)[sortKey] as
      | string
      | number
      | undefined;

    if (aValue == null && bValue == null) return 0;
    if (aValue == null) return direction === "asc" ? -1 : 1;
    if (bValue == null) return direction === "asc" ? 1 : -1;

    if (aValue < bValue) return direction === "asc" ? -1 : 1;
    if (aValue > bValue) return direction === "asc" ? 1 : -1;
    return 0;
  }

  function isEngagementMetric(key: string): boolean {
    return [
      "likes",
      "replies",
      "mentions",
      "reposts",
      "zaps",
      "satszapped",
    ].includes(key);
  }

  function sortRecyclablePosts(
    posts: PostData[],
    sortConfig: { key: string; direction: "asc" | "desc" },
    stats: Record<string, unknown>
  ): PostData[] {
    return [...posts].sort((a, b) => {
      if (sortConfig.key === "publishedAt") {
        return compareByDate(a, b, sortConfig.key, sortConfig.direction);
      }
      if (isEngagementMetric(sortConfig.key)) {
        return compareByEngagementMetric(
          a,
          b,
          sortConfig.key,
          sortConfig.direction,
          stats
        );
      }
      return compareByGenericValue(a, b, sortConfig.key, sortConfig.direction);
    });
  }

  // Sort posts - memoized to prevent unnecessary re-sorting on every render
  const sortedPosts = useMemo(() => {
    return sortRecyclablePosts(posts as PostData[], sortConfig, stats);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sortRecyclablePosts is a stable function defined in the same scope
  }, [posts, sortConfig, stats]);

  // Filter posts - memoized to prevent unnecessary filtering on every render
  const filteredPosts = useMemo(() => {
    return sortedPosts.filter((post) =>
      post.caption?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [sortedPosts, searchTerm]);

  const requestSort = (key: string) => {
    setSortConfig((current) => ({
      key,
      direction:
        current.key === key && current.direction === "asc" ? "desc" : "asc",
    }));
  };

  const togglePostSelection = (postId: string) => {
    setSelectedPosts((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(postId)) {
        newSet.delete(postId);
      } else {
        newSet.add(postId);
      }
      return newSet;
    });
  };

  const toggleSelectAll = () => {
    if (selectedPosts.size === filteredPosts.length) {
      setSelectedPosts(new Set());
    } else {
      setSelectedPosts(new Set(filteredPosts.map((post) => post.id)));
    }
  };

  const handleBulkDelete = () => {
    if (selectedPosts.size === 0) return;

    const formData = new FormData();
    formData.append("_action", "bulkDelete");
    formData.append("postIds", JSON.stringify(Array.from(selectedPosts)));

    bulkDeleteFetcher.submit(formData, { method: "post" });
  };

  const handleBulkRepost = () => {
    if (selectedPosts.size === 0) return;

    const formData = new FormData();
    formData.append("_action", "bulkRepost");
    formData.append("postIds", JSON.stringify(Array.from(selectedPosts)));

    bulkRepostFetcher.submit(formData, { method: "post" });
  };

  const handleBulkScheduledRepost = () => {
    if (selectedPosts.size === 0) return;

    const formData = new FormData();
    formData.append("_action", "bulkScheduledRepost");
    formData.append("postIds", JSON.stringify(Array.from(selectedPosts)));

    bulkRepostFetcher.submit(formData, { method: "post" });
  };

  const handleBulkQuote = () => {
    if (selectedPosts.size === 0) return;

    const formData = new FormData();
    formData.append("_action", "bulkQuote");
    formData.append("postIds", JSON.stringify(Array.from(selectedPosts)));

    bulkRepostFetcher.submit(formData, { method: "post" });
  };

  // Handle bulk delete success
  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- Remix fetcher data type is complex, validated at runtime
    const dataRaw = bulkDeleteFetcher.data;
    const data =
      dataRaw && typeof dataRaw === "object" && !Array.isArray(dataRaw)
        ? (dataRaw as { success?: unknown })
        : null;
    if (data && typeof data.success === "boolean" && data.success) {
      setSelectedPosts(new Set());
    }
  }, [bulkDeleteFetcher.data]);

  // Handle repost data and navigation
  useEffect(() => {
    const fetcherDataRaw: unknown = repostFetcher.data;
    const fetcherData: RepostFetcherData | null =
      fetcherDataRaw &&
      typeof fetcherDataRaw === "object" &&
      !Array.isArray(fetcherDataRaw) &&
      "repostData" in fetcherDataRaw
        ? (fetcherDataRaw as RepostFetcherData)
        : null;
    if (
      fetcherData &&
      "repostData" in fetcherData &&
      Array.isArray(fetcherData.repostData)
    ) {
      const postsData = fetcherData.repostData;

      // Prepare repost data with 1 hour default scheduling
      const userTimezone =
        user &&
        typeof user === "object" &&
        "timezone" in user &&
        typeof user.timezone === "string"
          ? user.timezone
          : "UTC";

      const now = nowInTimezone(userTimezone);
      const baseTime = addHours(now, 1);

      const repostData = postsData.map((post: PostData, index: number) => {
        const scheduleZoned = addHours(baseTime, index);
        const scheduledFor = formatForDateTimeLocal(
          scheduleZoned,
          userTimezone
        );

        return {
          caption: post.caption ?? "",
          fileUrl:
            Array.isArray(post.fileUrl) && post.fileUrl.length > 0
              ? post.fileUrl[0]
              : "",
          queueType: post.queueType?.name ?? "unassigned",
          scheduledFor,
          originalPostId: post.id,
        };
      });

      sessionStorage.setItem("repostData", JSON.stringify(repostData));
      navigate("/dashboard/bulkposts?mode=recycle", { replace: true });
      setSelectedPosts(new Set());
    }

    if (
      fetcherData &&
      "scheduledRepostData" in fetcherData &&
      Array.isArray(fetcherData.scheduledRepostData)
    ) {
      const postsData = fetcherData.scheduledRepostData;

      const userTimezoneForScheduled =
        user &&
        typeof user === "object" &&
        "timezone" in user &&
        typeof user.timezone === "string"
          ? user.timezone
          : "UTC";

      const now = nowInTimezone(userTimezoneForScheduled);
      const baseTime = addHours(now, 1);

      const scheduledRepostData = postsData.map(
        (post: PostData, index: number) => {
          const scheduleZoned = addHours(baseTime, index);
          return {
            caption: "",
            fileUrl: "",
            queueType: post.queueType?.name ?? "unassigned",
            scheduledFor: formatForDateTimeLocal(
              scheduleZoned,
              userTimezoneForScheduled
            ),
            originalPostId: post.id,
            originalEventId:
              post.signedEvent &&
              typeof post.signedEvent === "object" &&
              "id" in post.signedEvent &&
              typeof post.signedEvent.id === "string"
                ? post.signedEvent.id
                : undefined,
            originalEventPubkey:
              post.signedEvent &&
              typeof post.signedEvent === "object" &&
              "pubkey" in post.signedEvent &&
              typeof post.signedEvent.pubkey === "string"
                ? post.signedEvent.pubkey
                : undefined,
            isKind6Repost: true,
          };
        }
      );

      sessionStorage.setItem(
        "scheduledRepostData",
        JSON.stringify(scheduledRepostData)
      );
      navigate("/dashboard/bulkposts?mode=repost", { replace: true });
      setSelectedPosts(new Set());
    }

    if (
      fetcherData &&
      "quotePostData" in fetcherData &&
      fetcherData.quotePostData
    ) {
      const quoteData = fetcherData.quotePostData;
      sessionStorage.setItem("quotePostData", JSON.stringify(quoteData));
      navigate("/dashboard/bulkposts?mode=quote", { replace: true });
      setSelectedPosts(new Set());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Dependencies are intentionally limited to avoid unnecessary re-renders
  }, [repostFetcher.data, user?.timezone, repostFetcher, navigate]);

  // Handle individual repost actions
  useEffect(() => {
    const asRecord = (value: unknown): Record<string, unknown> | null =>
      value && typeof value === "object" && !Array.isArray(value)
        ? (value as Record<string, unknown>)
        : null;

    const parseIndividualRepostData = (
      value: unknown
    ): {
      repostEventData?: Record<string, unknown>;
      quotePostData?: unknown;
      error?: unknown;
      message?: unknown;
    } | null => {
      const record = asRecord(value);
      if (!record) return null;
      const repostEventData = asRecord(record["repostEventData"]);
      return {
        repostEventData: repostEventData ?? undefined,
        quotePostData: record["quotePostData"],
        error: record["error"],
        message: record["message"],
      };
    };

    const getUserRelaysForPublish = (): string[] => {
      if (
        user &&
        typeof user === "object" &&
        "relays" in user &&
        Array.isArray(user.relays)
      ) {
        return user.relays.map((r) => String(r)).filter(Boolean);
      }
      return ["wss://relay.primal.net"];
    };

    const buildEventData = (raw: Record<string, unknown>) => {
      return {
        kind: typeof raw["kind"] === "number" ? raw["kind"] : 1,
        content: typeof raw["content"] === "string" ? raw["content"] : "",
        tags: Array.isArray(raw["tags"]) ? raw["tags"] : [],
        created_at:
          typeof raw["created_at"] === "number"
            ? raw["created_at"]
            : nowSeconds(),
        pubkey: typeof raw["pubkey"] === "string" ? raw["pubkey"] : "",
      };
    };

    const extractETagEventId = (tags: unknown): string | null => {
      const isUnknownArray = (value: unknown): value is unknown[] =>
        Array.isArray(value);
      if (!isUnknownArray(tags)) return null;
      const eTag = tags.find((tag) => Array.isArray(tag) && tag[0] === "e");
      return Array.isArray(eTag) && typeof eTag[1] === "string"
        ? eTag[1]
        : null;
    };

    const showErrorToast = (message: string) => {
      setToast({ type: "error", message });
      setTimeout(() => setToast(null), 5000);
    };

    const showRepostSuccessToast = (eventTags: unknown) => {
      const eventId = extractETagEventId(eventTags);
      setToast({
        type: "success",
        message: "Post reposted successfully!",
        link: eventId ? `https://primal.net/e/${eventId}` : undefined,
        linkText: "View Original Post",
      });
      setTimeout(() => setToast(null), 8000);
    };

    const publishRepost = async (repostEventData: Record<string, unknown>) => {
      const eventData = buildEventData(repostEventData);
      const { signedEvent } = await nostrAdapter.signEvent(eventData);

      const response = await fetch("/api/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          relays: getUserRelaysForPublish(),
          event: signedEvent,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to publish repost");
      }

      setTimeout(() => showRepostSuccessToast(eventData.tags), 1000);
    };

    const handleRepost = async () => {
      const data = parseIndividualRepostData(individualRepostFetcher.data);
      if (!data) return;

      if (data.repostEventData) {
        try {
          await publishRepost(data.repostEventData);
        } catch (error: unknown) {
          logClientError(
            error instanceof Error ? error : new Error(String(error)),
            {
              component: "useRecyclablesState",
              action: "repostSignOrPublish",
            }
          );
          const errorMessage =
            error instanceof Error
              ? error.message
              : "Failed to sign or publish repost";
          showErrorToast(errorMessage);
        }
        return;
      }

      if (data.quotePostData) {
        sessionStorage.setItem(
          "quotePostData",
          JSON.stringify(data.quotePostData)
        );
        navigate("/dashboard/bulkposts?mode=quote", { replace: true });
        return;
      }

      if (data.error) {
        const message =
          typeof data.message === "string"
            ? data.message
            : "Failed to create repost";
        showErrorToast(message);
      }
    };

    if (individualRepostFetcher.data) {
      void handleRepost();
    }
  }, [
    individualRepostFetcher.data,
    user?.relays,
    individualRepostFetcher,
    user,
    navigate,
  ]);

  return {
    sortConfig,
    searchTerm,
    selectedPost,
    selectedPosts,
    toast,
    filteredPosts,
    requestSort,
    setSearchTerm,
    setSelectedPost,
    togglePostSelection,
    toggleSelectAll,
    handleBulkDelete,
    handleBulkRepost,
    handleBulkScheduledRepost,
    handleBulkQuote,
    setToast,
  };
}
