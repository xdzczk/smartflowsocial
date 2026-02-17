import { useFetcher, useRevalidator, useSearchParams } from "@remix-run/react";
import { useState, useEffect } from "react";

import type { ToastMessage } from "~/components/types";
import { nostrAdapter } from "~/lib/nostr-adapter.client";
import {
  addHours,
  formatForDateTimeLocal,
  nowInTimezone,
} from "~/lib/temporal";
import type { UserData } from "~/lib/validation/user-data";

import type {
  BulkPost,
  CombinedContent,
  PostData,
  LongFormPostData,
} from "./types";
import {
  convertQuoteDataToBulkPosts,
  convertRepostDataToBulkPosts,
} from "./utils/bulk-composer-data";

// Action constants
const ACTION_BULK_SCHEDULED_REPOST = "bulkScheduledRepost";
const ACTION_BULK_QUOTE = "bulkQuote";
const ACTION_BULK_DELETE = "bulkDelete";
const ACTION_BULK_DELETE_LONGFORM = "bulkDeleteLongForm";
const ACTION_BULK_DELETE_MIXED = "bulkDeleteMixed";
const ACTION_BULK_REPOST = "bulkRepost";

// Session storage keys
const STORAGE_KEY_REPOST_DATA = "repostData";
const STORAGE_KEY_SCHEDULED_REPOST_DATA = "scheduledRepostData";
const STORAGE_KEY_QUOTE_POST_DATA = "quotePostData";

// Navigation paths
const PATH_BULK_POSTS_RECYCLE = "/dashboard/bulkposts?mode=recycle";
const PATH_BULK_POSTS_REPOST = "/dashboard/bulkposts?mode=repost";
const PATH_BULK_POSTS_QUOTE = "/dashboard/bulkposts?mode=quote";

// Common type definitions to avoid duplication
interface QuotePostData {
  caption: string;
  fileUrl: string;
  queueType: string;
  scheduledFor: string;
  originalPostId: string;
  originalEventId?: string;
  originalEventPubkey?: string;
  isQuotePost?: boolean;
  originalCaption?: string;
}

interface FetcherErrorResponse {
  error?: string;
  message?: string;
}

export type BulkComposerPayload =
  | { mode: "recycle"; initialPosts: BulkPost[] }
  | { mode: "repost"; scheduledRepostData: unknown[] }
  | { mode: "quote"; initialPosts: BulkPost[] };

interface UsePublishedPostsProps {
  user: UserData | null;
  allContent: CombinedContent[];
  posts: PostData[];
  /** When set, bulk repost/quote/recycle open the in-page composer modal instead of redirecting. */
  onOpenBulkComposer?: (payload: BulkComposerPayload) => void;
}

export function usePublishedPosts({
  user,
  allContent,
  posts: _posts,
  onOpenBulkComposer,
}: UsePublishedPostsProps) {
  const _revalidator = useRevalidator();
  const [searchParams] = useSearchParams();

  // Get current tab from URL params - default to "all"
  const currentTab = searchParams.get("tab") ?? "all";

  const [sortConfig, setSortConfig] = useState<{
    key: string;
    direction: "asc" | "desc";
  }>({
    key: "publishedAt",
    direction: "desc",
  });
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedPost, setSelectedPost] = useState<PostData | null>(null);
  const [selectedPosts, setSelectedPosts] = useState<Set<string>>(new Set());
  const [selectedLongFormPost, setSelectedLongFormPost] =
    useState<LongFormPostData | null>(null);
  const [toast, setToast] = useState<ToastMessage | null>(null);

  const deleteFetcher = useFetcher<{ success?: boolean; error?: string }>();
  const bulkDeleteFetcher = useFetcher<{ success?: boolean; error?: string }>();
  const repostFetcher = useFetcher<{
    repostData?: PostData[];
    scheduledRepostData?: PostData[];
    quotePostData?: QuotePostData[];
    longformQuotePostData?: QuotePostData[];
  }>();
  const individualRepostFetcher = useFetcher<
    {
      repostEventData?: {
        kind: number;
        content: string;
        tags: string[][];
        created_at: number;
      };
      quotePostData?: QuotePostData[];
      originalPost?: PostData;
    } & FetcherErrorResponse
  >();
  const longformRepostFetcher = useFetcher<
    {
      longformRepostEventData?: {
        kind: number;
        content: string;
        tags: string[][];
        created_at: number;
      };
      originalPost?: LongFormPostData;
    } & FetcherErrorResponse
  >();
  const longformQuoteFetcher = useFetcher<
    {
      longformQuotePostData?: QuotePostData[];
    } & FetcherErrorResponse
  >();

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

  const toggleSelectAll = (filteredPosts: PostData[] | CombinedContent[]) => {
    if (selectedPosts.size === filteredPosts.length) {
      setSelectedPosts(new Set());
    } else {
      setSelectedPosts(new Set(filteredPosts.map((post) => post.id)));
    }
  };

  const handleBulkDelete = () => {
    if (selectedPosts.size === 0) return;

    // For All tab, we need to handle mixed content types
    if (currentTab === "all") {
      const selectedItems = allContent
        .filter((item) => selectedPosts.has(item.id))
        .map((item) => ({ id: item.id, type: item.type }));

      const formData = new FormData();
      formData.append("_action", ACTION_BULK_DELETE_MIXED);
      formData.append("itemData", JSON.stringify(selectedItems));

      bulkDeleteFetcher.submit(formData, { method: "post" });
    } else {
      // For individual tabs, use the original handlers
      const formData = new FormData();
      formData.append(
        "_action",
        currentTab === "longform"
          ? ACTION_BULK_DELETE_LONGFORM
          : ACTION_BULK_DELETE
      );
      formData.append("postIds", JSON.stringify(Array.from(selectedPosts)));

      bulkDeleteFetcher.submit(formData, { method: "post" });
    }
  };

  const handleBulkRepost = () => {
    if (selectedPosts.size === 0) return;

    if (currentTab === "all") {
      // For All tab, only process regular posts (longform doesn't support bulk repost)
      const selectedItems = allContent.filter(
        (item) => selectedPosts.has(item.id) && item.type === "post"
      );

      if (selectedItems.length === 0) {
        alert("No regular posts selected for recycling.");
        return;
      }

      const formData = new FormData();
      formData.append("_action", ACTION_BULK_REPOST);
      formData.append(
        "postIds",
        JSON.stringify(selectedItems.map((item) => item.id))
      );

      repostFetcher.submit(formData, { method: "post" });
    } else {
      const formData = new FormData();
      formData.append("_action", ACTION_BULK_REPOST);
      formData.append("postIds", JSON.stringify(Array.from(selectedPosts)));

      repostFetcher.submit(formData, { method: "post" });
    }
  };

  const handleBulkScheduledRepost = () => {
    if (selectedPosts.size === 0) return;

    if (currentTab === "all") {
      // For All tab, only process regular posts
      const selectedItems = allContent.filter(
        (item) => selectedPosts.has(item.id) && item.type === "post"
      );

      if (selectedItems.length === 0) {
        alert("No regular posts selected for reposting.");
        return;
      }

      const formData = new FormData();
      formData.append("_action", ACTION_BULK_SCHEDULED_REPOST);
      formData.append(
        "postIds",
        JSON.stringify(selectedItems.map((item) => item.id))
      );

      repostFetcher.submit(formData, { method: "post" });
    } else {
      const formData = new FormData();
      formData.append("_action", ACTION_BULK_SCHEDULED_REPOST);
      formData.append("postIds", JSON.stringify(Array.from(selectedPosts)));

      repostFetcher.submit(formData, { method: "post" });
    }
  };

  const handleBulkQuote = () => {
    if (selectedPosts.size === 0) return;

    if (currentTab === "all") {
      // For All tab, only process regular posts
      const selectedItems = allContent.filter(
        (item) => selectedPosts.has(item.id) && item.type === "post"
      );

      if (selectedItems.length === 0) {
        alert("No regular posts selected for quote posting.");
        return;
      }

      const formData = new FormData();
      formData.append("_action", ACTION_BULK_QUOTE);
      formData.append(
        "postIds",
        JSON.stringify(selectedItems.map((item) => item.id))
      );

      repostFetcher.submit(formData, { method: "post" });
    } else {
      const formData = new FormData();
      formData.append("_action", ACTION_BULK_QUOTE);
      formData.append("postIds", JSON.stringify(Array.from(selectedPosts)));

      repostFetcher.submit(formData, { method: "post" });
    }
  };

  useEffect(() => {
    if (bulkDeleteFetcher.data?.success) {
      setSelectedPosts(new Set());
    }
  }, [bulkDeleteFetcher.data]);

  useEffect(() => {
    if (repostFetcher.data?.repostData) {
      const postsData = repostFetcher.data.repostData as unknown as PostData[];

      const userTimezone = user?.timezone ?? "UTC";
      const now = nowInTimezone(userTimezone);
      const baseTime = addHours(now, 1);

      const repostData = postsData.map((post, index: number) => {
        const scheduleZoned = addHours(baseTime, index);
        const scheduledFor = formatForDateTimeLocal(
          scheduleZoned,
          userTimezone
        );
        const qt = post.queueType;
        const queueType =
          typeof qt === "string"
            ? qt
            : ((qt && typeof qt === "object" && "name" in qt
                ? (qt as { name?: string }).name
                : null) ?? "unassigned");
        return {
          caption: post.caption ?? "",
          fileUrl:
            Array.isArray(post.fileUrl) && post.fileUrl.length > 0
              ? post.fileUrl[0]
              : "",
          queueType,
          scheduledFor,
          isRecyclable: Boolean(post.isRecyclable),
          originalPostId: post.id,
        };
      });

      if (onOpenBulkComposer) {
        const initialPosts = convertRepostDataToBulkPosts(repostData);
        onOpenBulkComposer({ mode: "recycle", initialPosts });
        setSelectedPosts(new Set());
      } else {
        sessionStorage.setItem(
          STORAGE_KEY_REPOST_DATA,
          JSON.stringify(repostData)
        );
        window.location.href = PATH_BULK_POSTS_RECYCLE;
        setSelectedPosts(new Set());
      }
    }

    if (repostFetcher.data?.scheduledRepostData) {
      const postsData = repostFetcher.data.scheduledRepostData;

      if (postsData.length === 0) {
        setToast({
          type: "error",
          message:
            "No posts found to schedule. Make sure you selected regular posts (not articles).",
        });
        setTimeout(() => setToast(null), 5000);
        return;
      }

      const userTimezone = user?.timezone ?? "UTC";
      const now = nowInTimezone(userTimezone);
      const baseTime = addHours(now, 1);

      const postsDataTyped = repostFetcher.data
        .scheduledRepostData as unknown as PostData[];
      const scheduledRepostData = postsDataTyped.map((post, index: number) => {
        const scheduleZoned = addHours(baseTime, index);
        const scheduledFor = formatForDateTimeLocal(
          scheduleZoned,
          userTimezone
        );
        const qt = post.queueType;
        const queueType =
          typeof qt === "string"
            ? qt
            : ((qt && typeof qt === "object" && "name" in qt
                ? (qt as { name?: string }).name
                : null) ?? "unassigned");
        return {
          caption: "",
          fileUrl: "",
          queueType,
          scheduledFor,
          originalPostId: post.id,
          originalEventId: post.signedEvent?.id,
          originalEventPubkey: post.signedEvent?.pubkey,
          isKind6Repost: true,
        };
      });

      if (onOpenBulkComposer) {
        onOpenBulkComposer({ mode: "repost", scheduledRepostData });
        setSelectedPosts(new Set());
      } else {
        sessionStorage.setItem(
          STORAGE_KEY_SCHEDULED_REPOST_DATA,
          JSON.stringify(scheduledRepostData)
        );
        window.location.href = PATH_BULK_POSTS_REPOST;
        setSelectedPosts(new Set());
      }
    }

    if (repostFetcher.data?.quotePostData) {
      const quoteData = repostFetcher.data.quotePostData;

      if (quoteData.length === 0) {
        setToast({
          type: "error",
          message:
            "No posts found to schedule. Make sure you selected regular posts (not articles).",
        });
        setTimeout(() => setToast(null), 5000);
        return;
      }

      if (onOpenBulkComposer) {
        const initialPosts = convertQuoteDataToBulkPosts(
          quoteData as Parameters<typeof convertQuoteDataToBulkPosts>[0]
        );
        onOpenBulkComposer({ mode: "quote", initialPosts });
        setSelectedPosts(new Set());
      } else {
        sessionStorage.setItem(
          STORAGE_KEY_QUOTE_POST_DATA,
          JSON.stringify(quoteData)
        );
        window.location.href = PATH_BULK_POSTS_QUOTE;
        setSelectedPosts(new Set());
      }
    }

    if (repostFetcher.data?.longformQuotePostData) {
      const quoteData = repostFetcher.data.longformQuotePostData;

      if (onOpenBulkComposer) {
        const initialPosts = convertQuoteDataToBulkPosts(
          quoteData as Parameters<typeof convertQuoteDataToBulkPosts>[0]
        );
        onOpenBulkComposer({ mode: "quote", initialPosts });
        setSelectedPosts(new Set());
      } else {
        sessionStorage.setItem("quotePostData", JSON.stringify(quoteData));
        window.location.href = PATH_BULK_POSTS_QUOTE;
        setSelectedPosts(new Set());
      }
    }
  }, [repostFetcher.data, user?.timezone, onOpenBulkComposer]);

  // Handle longform repost responses
  useEffect(() => {
    const handleLongformRepost = async () => {
      if (longformRepostFetcher.data?.longformRepostEventData) {
        try {
          if (!user) {
            setToast({
              type: "error",
              message: "User data not available. Please refresh the page.",
            });
            setTimeout(() => setToast(null), 5000);
            return;
          }

          const eventData = longformRepostFetcher.data.longformRepostEventData;
          const originalPost = longformRepostFetcher.data.originalPost;

          // Sign the event using client-side signing
          const { signedEvent } = await nostrAdapter.signEvent(eventData);

          // Get user relays from user data
          const sanitizedRelays = user.userRelays ?? [];

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
            throw new Error("Failed to publish longform repost");
          }

          // Show success toast
          setTimeout(() => {
            setToast({
              type: "success",
              message: "Article reposted successfully!",
              link: `https://primal.net/a/${String(originalPost?.nostrEventId ?? originalPost?.signedEvent?.id ?? "")}`,
              linkText: "View Original Article",
            });

            // Hide toast after 8 seconds
            setTimeout(() => setToast(null), 8000);
          }, 1000);
        } catch (error: unknown) {
          const { handleAsyncError, getErrorMessage } =
            await import("~/lib/error-handler.client");
          handleAsyncError(
            error,
            {
              component: "usePublishedPosts",
              action: "handleLongformRepost",
            },
            false
          ); // Don't show toast, we set toast state instead
          setToast({
            type: "error",
            message:
              getErrorMessage(error) ||
              "Failed to sign or publish longform repost",
          });

          // Hide toast after 5 seconds for errors
          setTimeout(() => setToast(null), 5000);
        }
      } else if (longformRepostFetcher.data?.error) {
        setToast({
          type: "error",
          message:
            longformRepostFetcher.data.message ??
            "Failed to create longform repost",
        });

        // Hide toast after 5 seconds for errors
        setTimeout(() => setToast(null), 5000);
      }
    };

    if (longformRepostFetcher.data) {
      void handleLongformRepost();
    }
  }, [longformRepostFetcher.data, user]);

  // Handle longform quote responses
  useEffect(() => {
    if (longformQuoteFetcher.data?.longformQuotePostData) {
      const quoteData = longformQuoteFetcher.data.longformQuotePostData;

      // Store longform quote post data in sessionStorage
      sessionStorage.setItem("quotePostData", JSON.stringify(quoteData));

      // Navigate to bulk posts page with quote mode
      window.location.href = PATH_BULK_POSTS_QUOTE;
    } else if (longformQuoteFetcher.data?.error) {
      setToast({
        type: "error",
        message:
          longformQuoteFetcher.data.message ??
          "Failed to create longform quote post",
      });

      // Hide toast after 5 seconds for errors
      setTimeout(() => setToast(null), 5000);
    }
  }, [longformQuoteFetcher.data]);

  useEffect(() => {
    const handleRepost = async () => {
      if (individualRepostFetcher.data?.repostEventData) {
        try {
          if (!user) {
            setToast({
              type: "error",
              message: "User data not available. Please refresh the page.",
            });
            setTimeout(() => setToast(null), 5000);
            return;
          }

          const eventData = individualRepostFetcher.data.repostEventData;

          // Sign the event using client-side signing
          const { signedEvent } = await nostrAdapter.signEvent(eventData);

          // Get user relays from user data
          const sanitizedRelays = user.userRelays ?? [];

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
            setToast({
              type: "success",
              message: "Post reposted successfully!",
              link: `https://primal.net/e/${String(eventData.tags.find((tag: string[]) => tag[0] === "e")?.[1] ?? "")}`,
              linkText: "View Original Post",
            });

            // Hide toast after 8 seconds for success with link
            setTimeout(() => setToast(null), 8000);
          }, 1000); // 1 second delay
        } catch (error: unknown) {
          const { handleAsyncError, getErrorMessage } =
            await import("~/lib/error-handler.client");
          handleAsyncError(
            error,
            {
              component: "usePublishedPosts",
              action: "handleRepost",
            },
            false
          ); // Don't show toast, we set toast state instead
          setToast({
            type: "error",
            message:
              getErrorMessage(error) || "Failed to sign or publish repost",
          });

          // Hide toast after 5 seconds for errors
          setTimeout(() => setToast(null), 5000);
        }
      } else if (individualRepostFetcher.data?.quotePostData) {
        // Handle individual quote post - redirect to bulk posts with single item
        const quoteData = individualRepostFetcher.data.quotePostData;

        // Store quote post data in sessionStorage
        sessionStorage.setItem("quotePostData", JSON.stringify(quoteData));

        // Navigate to bulk posts page with quote mode
        window.location.href = "/dashboard/bulkposts?mode=quote";
      } else if (individualRepostFetcher.data?.error) {
        setToast({
          type: "error",
          message:
            individualRepostFetcher.data.message ?? "Failed to create repost",
        });

        // Hide toast after 5 seconds for errors
        setTimeout(() => setToast(null), 5000);
      }
    };

    if (individualRepostFetcher.data) {
      void handleRepost();
    }
  }, [individualRepostFetcher.data, user]);

  return {
    currentTab,
    sortConfig,
    setSortConfig,
    searchTerm,
    setSearchTerm,
    selectedPost,
    setSelectedPost,
    selectedPosts,
    setSelectedPosts,
    selectedLongFormPost,
    setSelectedLongFormPost,
    toast,
    setToast,
    deleteFetcher,
    bulkDeleteFetcher,
    repostFetcher,
    individualRepostFetcher,
    longformRepostFetcher,
    longformQuoteFetcher,
    requestSort,
    togglePostSelection,
    toggleSelectAll,
    handleBulkDelete,
    handleBulkRepost,
    handleBulkScheduledRepost,
    handleBulkQuote,
  };
}
