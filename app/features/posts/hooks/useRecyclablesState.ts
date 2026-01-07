import type { FetcherWithComponents , useFetcher } from "@remix-run/react";
import { useState, useEffect } from "react";

import { nostrAdapter } from "~/lib/nostr-adapter.client";

import type { PostData } from "../types";

interface Post {
  id: string;
  caption?: string | null;
  postedAt: Date | null;
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
  const [sortConfig, setSortConfig] = useState<SortConfig>({
    key: "postedAt",
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
  const sortedPosts = [...posts].sort((a, b) => {
    if (sortConfig.key === "postedAt") {
      const dateA = new Date(a[sortConfig.key] ?? 0).getTime();
      const dateB = new Date(b[sortConfig.key] ?? 0).getTime();
      return sortConfig.direction === "asc" ? dateA - dateB : dateB - dateA;
    }

    // Handle engagement metrics sorting
    if (
      [
        "likes",
        "replies",
        "mentions",
        "reposts",
        "zaps",
        "satszapped",
      ].includes(sortConfig.key)
    ) {
      const aEventId =
        a.signedEvent &&
        typeof a.signedEvent === "object" &&
        "id" in a.signedEvent &&
        typeof a.signedEvent.id === "string"
          ? a.signedEvent.id
          : null;
      const bEventId =
        b.signedEvent &&
        typeof b.signedEvent === "object" &&
        "id" in b.signedEvent &&
        typeof b.signedEvent.id === "string"
          ? b.signedEvent.id
          : null;
      const aStats =
        aEventId &&
        aEventId in stats &&
        typeof stats[aEventId] === "object" &&
        stats[aEventId] !== null
          ? stats[aEventId]
          : {};
      const bStats =
        bEventId &&
        bEventId in stats &&
        typeof stats[bEventId] === "object" &&
        stats[bEventId] !== null
          ? stats[bEventId]
          : {};
      const aValue = Number(aStats[sortConfig.key as keyof typeof aStats] ?? 0);
      const bValue = Number(bStats[sortConfig.key as keyof typeof bStats] ?? 0);
      return sortConfig.direction === "asc" ? aValue - bValue : bValue - aValue;
    }

    const aValue = (a as Record<string, unknown>)[sortConfig.key] as
      | string
      | number
      | undefined;
    const bValue = (b as Record<string, unknown>)[sortConfig.key] as
      | string
      | number
      | undefined;

    // Handle null/undefined values
    if (aValue == null && bValue == null) return 0;
    if (aValue == null) return sortConfig.direction === "asc" ? -1 : 1;
    if (bValue == null) return sortConfig.direction === "asc" ? 1 : -1;

    if (aValue < bValue) return sortConfig.direction === "asc" ? -1 : 1;
    if (aValue > bValue) return sortConfig.direction === "asc" ? 1 : -1;
    return 0;
  });

  const filteredPosts = sortedPosts.filter((post) =>
    post.caption?.toLowerCase().includes(searchTerm.toLowerCase())
  );

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
      const now = new Date();
      const userTimezone =
        user &&
        typeof user === "object" &&
        "timezone" in user &&
        typeof user.timezone === "string"
          ? user.timezone
          : "UTC";
      const localDate = new Date(
        now.toLocaleString("en-US", { timeZone: userTimezone })
      );
      localDate.setHours(localDate.getHours() + 1);

      const repostData = postsData.map((post: PostData, index: number) => {
        const scheduleDate = new Date(localDate);
        scheduleDate.setHours(scheduleDate.getHours() + index);

        return {
          caption: post.caption ?? "",
          fileUrl:
            Array.isArray(post.fileUrl) &&
            post.fileUrl.length > 0
              ? post.fileUrl[0]
              : "",
          queueType: post.queueType ?? "unassigned",
          scheduledFor: scheduleDate
            .toLocaleString("en-US", {
              year: "numeric",
              month: "2-digit",
              day: "2-digit",
              hour: "2-digit",
              minute: "2-digit",
              hour12: false,
            })
            .replace(/(\d+)\/(\d+)\/(\d+),\s(\d+):(\d+)/, "$3-$1-$2T$4:$5"),
          originalPostId: post.id,
        };
      });

      sessionStorage.setItem("repostData", JSON.stringify(repostData));
      window.location.href = "/dashboard/bulkposts?mode=recycle";
      setSelectedPosts(new Set());
    }

    if (
      fetcherData &&
      "scheduledRepostData" in fetcherData &&
      Array.isArray(fetcherData.scheduledRepostData)
    ) {
      const postsData = fetcherData.scheduledRepostData;

      const now = new Date();
      const userTimezoneForScheduled =
        user &&
        typeof user === "object" &&
        "timezone" in user &&
        typeof user.timezone === "string"
          ? user.timezone
          : "UTC";
      const localDate = new Date(
        now.toLocaleString("en-US", { timeZone: userTimezoneForScheduled })
      );
      localDate.setHours(localDate.getHours() + 1);

      const scheduledRepostData = postsData.map(
        (post: PostData, index: number) => {
          const scheduleDate = new Date(localDate);
          scheduleDate.setHours(scheduleDate.getHours() + index);

          return {
            caption: "",
            fileUrl: "",
            queueType: post.queueType ?? "unassigned",
            scheduledFor: scheduleDate
              .toLocaleString("en-US", {
                year: "numeric",
                month: "2-digit",
                day: "2-digit",
                hour: "2-digit",
                minute: "2-digit",
                hour12: false,
              })
              .replace(/(\d+)\/(\d+)\/(\d+),\s(\d+):(\d+)/, "$3-$1-$2T$4:$5"),
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
      window.location.href = "/dashboard/bulkposts?mode=repost";
      setSelectedPosts(new Set());
    }

    if (
      fetcherData &&
      "quotePostData" in fetcherData &&
      fetcherData.quotePostData
    ) {
      const quoteData = fetcherData.quotePostData;
      sessionStorage.setItem("quotePostData", JSON.stringify(quoteData));
      window.location.href = "/dashboard/bulkposts?mode=quote";
      setSelectedPosts(new Set());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Dependencies are intentionally limited to avoid unnecessary re-renders
  }, [repostFetcher.data, user?.timezone, repostFetcher]);

  // Handle individual repost actions
  useEffect(() => {
    const handleRepost = async () => {
      const dataRaw = individualRepostFetcher.data;
      const data =
        dataRaw && typeof dataRaw === "object" && !Array.isArray(dataRaw)
          ? (dataRaw as {
              repostEventData?: unknown;
              quotePostData?: unknown;
              error?: unknown;
              message?: unknown;
            })
          : null;

      if (
        data &&
        "repostEventData" in data &&
        data.repostEventData &&
        typeof data.repostEventData === "object" &&
        !Array.isArray(data.repostEventData)
      ) {
        try {
          const eventDataRaw = data.repostEventData as {
            kind?: unknown;
            content?: unknown;
            tags?: unknown;
            created_at?: unknown;
            pubkey?: unknown;
            [key: string]: unknown;
          };

          // Convert to NostrEventData format expected by signEventFn
          const eventData = {
            kind: typeof eventDataRaw.kind === "number" ? eventDataRaw.kind : 1,
            content:
              typeof eventDataRaw.content === "string"
                ? eventDataRaw.content
                : "",
            tags: Array.isArray(eventDataRaw.tags) ? eventDataRaw.tags : [],
            created_at:
              typeof eventDataRaw.created_at === "number"
                ? eventDataRaw.created_at
                : Math.floor(Date.now() / 1000),
            pubkey:
              typeof eventDataRaw.pubkey === "string"
                ? eventDataRaw.pubkey
                : "",
          };

          // Sign the event using client-side signing
          const { signedEvent } = await nostrAdapter.signEvent(eventData);

          // Get user relays from user data
          const sanitizedRelays =
            user &&
            typeof user === "object" &&
            "relays" in user &&
            Array.isArray(user.relays)
              ? user.relays
              : ["wss://relay.primal.net"];

          // Publish the signed event
          const response = await fetch("/api/publish", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              relays: sanitizedRelays,
              event: signedEvent,
            }),
          });

          if (!response.ok) {
            throw new Error("Failed to publish repost");
          }

          // Add delay before showing success toast
          setTimeout(() => {
            const tags = Array.isArray(eventData.tags) ? eventData.tags : [];
            const eTag: unknown = tags.find(
              (tag: unknown) => Array.isArray(tag) && tag[0] === "e"
            );
            const eventId =
              Array.isArray(eTag) && typeof eTag[1] === "string" ? eTag[1] : "";
            setToast({
              type: "success",
              message: "Post reposted successfully!",
              link: eventId ? `https://primal.net/e/${eventId}` : undefined,
              linkText: "View Original Post",
            });

            // Hide toast after 8 seconds for success with link
            setTimeout(() => setToast(null), 8000);
          }, 1000); // 1 second delay
        } catch (error: unknown) {
          console.error("Repost signing/publishing error:", error);
          const errorMessage =
            error instanceof Error
              ? error.message
              : "Failed to sign or publish repost";
          setToast({
            type: "error",
            message: errorMessage,
          });

          // Hide toast after 5 seconds for errors
          setTimeout(() => setToast(null), 5000);
        }
      } else if (data && "quotePostData" in data && data.quotePostData) {
        // Handle individual quote post - redirect to bulk posts with single item
        const quoteData = data.quotePostData;

        // Store quote post data in sessionStorage
        sessionStorage.setItem("quotePostData", JSON.stringify(quoteData));

        // Navigate to bulk posts page with quote mode
        window.location.href = "/dashboard/bulkposts?mode=quote";
      } else if (data && "error" in data && data.error) {
        const message =
          typeof data.message === "string"
            ? data.message
            : "Failed to create repost";
        setToast({
          type: "error",
          message,
        });

        // Hide toast after 5 seconds for errors
        setTimeout(() => setToast(null), 5000);
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
