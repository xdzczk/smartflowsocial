import {
  useFetcher,
  useNavigate,
  useRevalidator,
  useSearchParams,
} from "@remix-run/react";
import { useQueryClient } from "@tanstack/react-query";
import { useState, useEffect, useCallback, useMemo, useRef } from "react";

import type { ToastMessage } from "~/components/types";
import { signingAttempts } from "~/features/auth/signing/signing-attempts.client";
import {
  durableIntent,
  startRecoverableSign,
} from "~/features/auth/signing/use-recoverable-sign.client";
import {
  invalidateDependentCaches,
  useRefreshPostViews,
} from "~/features/posts/hooks/useRefreshPostViews";
import type {
  CombinedContent,
  LongFormPostData,
  PostData,
} from "~/features/posts/types";
import {
  convertQuoteDataToBulkPosts,
  convertRepostDataToBulkPosts,
} from "~/features/posts/utils/bulk-composer-data";
import { nostrAdapter } from "~/lib/nostr-adapter.client";
import { getNostrClientUrlsFromUser } from "~/lib/nostr-client-urls";
import { useOptionalUser } from "~/lib/remix-utils";
import {
  addHours,
  formatForDateTimeLocal,
  nowInTimezone,
} from "~/lib/temporal";

import {
  parseBulkDeleteIds,
  prunePublishedPostsFromAllQueries,
} from "./usePublishedPostsCache";
import {
  ACTION_BULK_DELETE,
  ACTION_BULK_DELETE_LONGFORM,
  ACTION_BULK_DELETE_MIXED,
  ACTION_BULK_QUOTE,
  ACTION_BULK_REPOST,
  ACTION_BULK_SCHEDULED_REPOST,
  PATH_BULK_POSTS_QUOTE,
  PATH_BULK_POSTS_RECYCLE,
  PATH_BULK_POSTS_REPOST,
  STORAGE_KEY_QUOTE_POST_DATA,
  STORAGE_KEY_REPOST_DATA,
  STORAGE_KEY_SCHEDULED_REPOST_DATA,
} from "./usePublishedPostsConstants";
import type {
  FetcherErrorResponse,
  QuotePostData,
  UsePublishedPostsProps,
} from "./usePublishedPostsTypes";

export type { BulkComposerPayload } from "./usePublishedPostsTypes";

export function usePublishedPosts({
  user,
  allContent,
  posts: _posts,
  onOpenBulkComposer,
}: UsePublishedPostsProps) {
  const _revalidator = useRevalidator();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const refreshAllPostViews = useRefreshPostViews();
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

  const rootUser = useOptionalUser();
  const nostrUrls = useMemo(
    () => getNostrClientUrlsFromUser(rootUser),
    [rootUser]
  );

  const deleteFetcher = useFetcher<{ success?: boolean; error?: string }>();
  const bulkDeleteFetcher = useFetcher<{ success?: boolean; error?: string }>();
  const previousDeleteStateRef = useRef(deleteFetcher.state);
  const previousDeleteDataRef = useRef(deleteFetcher.data);
  const previousBulkDeleteStateRef = useRef(bulkDeleteFetcher.state);
  const previousBulkDeleteDataRef = useRef(bulkDeleteFetcher.data);
  const lastDeleteSubmissionRef = useRef<{
    action: "delete" | "deleteLongForm";
    postId: string;
  } | null>(null);
  const lastBulkDeleteSubmissionRef = useRef<{
    action:
      | typeof ACTION_BULK_DELETE
      | typeof ACTION_BULK_DELETE_LONGFORM
      | typeof ACTION_BULK_DELETE_MIXED;
    postIds: string[];
  } | null>(null);
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

  const optimisticallyRemovePublishedItems = useCallback(
    (ids: string[]) => {
      prunePublishedPostsFromAllQueries(queryClient, ids);
    },
    [queryClient]
  );

  const didFetcherMutationSucceed = useCallback(
    (data: { success?: boolean; error?: string } | undefined): boolean => {
      if (!data) return true;
      if (typeof data.success === "boolean") return data.success;
      return !data.error;
    },
    []
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

  const toggleSelectAll = (filteredPosts: PostData[] | CombinedContent[]) => {
    if (selectedPosts.size === filteredPosts.length) {
      setSelectedPosts(new Set());
    } else {
      setSelectedPosts(new Set(filteredPosts.map((post) => post.id)));
    }
  };

  const handleBulkDelete = () => {
    if (selectedPosts.size === 0) return;

    optimisticallyRemovePublishedItems(Array.from(selectedPosts));

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
    const previousState = previousBulkDeleteStateRef.current;
    const currentState = bulkDeleteFetcher.state;
    const dataChanged =
      bulkDeleteFetcher.data !== previousBulkDeleteDataRef.current;
    const fetcherData = bulkDeleteFetcher.data;
    const formData = bulkDeleteFetcher.formData;
    const action = formData?.get("_action");
    if (
      (action === ACTION_BULK_DELETE ||
        action === ACTION_BULK_DELETE_LONGFORM ||
        action === ACTION_BULK_DELETE_MIXED) &&
      formData
    ) {
      lastBulkDeleteSubmissionRef.current = {
        action,
        postIds: parseBulkDeleteIds(formData),
      };
    }
    const submission = lastBulkDeleteSubmissionRef.current;

    if (
      currentState === "idle" &&
      submission &&
      (previousState !== "idle" || dataChanged) &&
      didFetcherMutationSucceed(fetcherData)
    ) {
      optimisticallyRemovePublishedItems(submission.postIds);
      setSelectedPosts(new Set());
      refreshAllPostViews();
      invalidateDependentCaches(queryClient);
      lastBulkDeleteSubmissionRef.current = null;
    } else if (previousState !== "idle" && currentState === "idle") {
      lastBulkDeleteSubmissionRef.current = null;
    }

    previousBulkDeleteStateRef.current = currentState;
    previousBulkDeleteDataRef.current = bulkDeleteFetcher.data;
  }, [
    bulkDeleteFetcher.state,
    bulkDeleteFetcher.data,
    bulkDeleteFetcher.formData,
    didFetcherMutationSucceed,
    optimisticallyRemovePublishedItems,
    queryClient,
    refreshAllPostViews,
  ]);

  useEffect(() => {
    const previousState = previousDeleteStateRef.current;
    const currentState = deleteFetcher.state;
    const dataChanged = deleteFetcher.data !== previousDeleteDataRef.current;
    const deleteFetcherData = deleteFetcher.data;
    const formData = deleteFetcher.formData;
    const action = formData?.get("_action");
    const submittedPostId = formData?.get("postId");
    if (
      (action === "delete" || action === "deleteLongForm") &&
      typeof submittedPostId === "string" &&
      submittedPostId.length > 0
    ) {
      lastDeleteSubmissionRef.current = { action, postId: submittedPostId };
    }
    const submission = lastDeleteSubmissionRef.current;
    const didComplete =
      currentState === "idle" &&
      submission &&
      (previousState !== "idle" || dataChanged) &&
      didFetcherMutationSucceed(deleteFetcherData);
    if (!didComplete) {
      if (previousState !== "idle" && currentState === "idle") {
        lastDeleteSubmissionRef.current = null;
      }
      previousDeleteStateRef.current = currentState;
      previousDeleteDataRef.current = deleteFetcher.data;
      return;
    }
    optimisticallyRemovePublishedItems([submission.postId]);
    refreshAllPostViews();
    invalidateDependentCaches(queryClient);
    lastDeleteSubmissionRef.current = null;
    previousDeleteStateRef.current = currentState;
    previousDeleteDataRef.current = deleteFetcher.data;
  }, [
    deleteFetcher.state,
    deleteFetcher.data,
    deleteFetcher.formData,
    didFetcherMutationSucceed,
    optimisticallyRemovePublishedItems,
    queryClient,
    refreshAllPostViews,
  ]);

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
        navigate(PATH_BULK_POSTS_RECYCLE, { replace: true });
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
        navigate(PATH_BULK_POSTS_REPOST, { replace: true });
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
        const initialPosts = convertQuoteDataToBulkPosts(quoteData);
        onOpenBulkComposer({ mode: "quote", initialPosts });
        setSelectedPosts(new Set());
      } else {
        sessionStorage.setItem(
          STORAGE_KEY_QUOTE_POST_DATA,
          JSON.stringify(quoteData)
        );
        navigate(PATH_BULK_POSTS_QUOTE, { replace: true });
        setSelectedPosts(new Set());
      }
    }

    if (repostFetcher.data?.longformQuotePostData) {
      const quoteData = repostFetcher.data.longformQuotePostData;

      if (onOpenBulkComposer) {
        const initialPosts = convertQuoteDataToBulkPosts(quoteData);
        onOpenBulkComposer({ mode: "quote", initialPosts });
        setSelectedPosts(new Set());
      } else {
        sessionStorage.setItem("quotePostData", JSON.stringify(quoteData));
        navigate(PATH_BULK_POSTS_QUOTE, { replace: true });
        setSelectedPosts(new Set());
      }
    }
  }, [repostFetcher.data, user?.timezone, onOpenBulkComposer, navigate]);

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

          // Get user relays from user data
          const sanitizedRelays = user.userRelays ?? [];

          // Per-article idempotency key. Includes the submission instant
          // so re-clicking "Repost article" later starts a fresh attempt
          // instead of being deduped against the prior one.
          const originalEventId = String(
            originalPost?.nostrEventId ?? originalPost?.signedEvent?.id ?? ""
          );
          const idempotencyKey = `longform-repost:${originalEventId}:${Date.now()}`;

          const result = await startRecoverableSign({
            intent: durableIntent(
              "long_form_publish",
              idempotencyKey,
              "Repost article"
            ),
            surface: `published-posts:longform-repost:${originalEventId}`,
            performSignAndSubmit: async (submissionId) => {
              const { signedEvent } = await nostrAdapter.signEvent(eventData, {
                clearCacheOnError: false,
              });

              const response = await fetch("/api/publish", {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  relays: sanitizedRelays,
                  event: signedEvent,
                  attemptId: submissionId,
                }),
              });

              if (!response.ok) {
                const message = `Failed to publish longform repost (${response.status})`;
                signingAttempts.markFailed(submissionId, message);
                throw new Error(message);
              }
              signingAttempts.markCompleted(submissionId);
            },
          });

          if (!result.ok) {
            // Recoverable failure modes (`awaiting_signer`) keep the
            // global recovery banner up; only surface a toast for the
            // terminal branches the banner can't drive on its own.
            if (result.reason === "fatal" || result.reason === "expired") {
              throw new Error(
                result.lastError ?? `Failed to publish longform repost`
              );
            }
            return;
          }

          // Show success toast
          setTimeout(() => {
            setToast({
              type: "success",
              message: "Article reposted successfully!",
              link: nostrUrls.articleUrl(originalEventId),
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
  }, [longformRepostFetcher.data, user, nostrUrls]);

  // Handle longform quote responses
  useEffect(() => {
    if (longformQuoteFetcher.data?.longformQuotePostData) {
      const quoteData = longformQuoteFetcher.data.longformQuotePostData;

      // Store longform quote post data in sessionStorage
      sessionStorage.setItem("quotePostData", JSON.stringify(quoteData));

      // Navigate to bulk posts page with quote mode
      navigate(PATH_BULK_POSTS_QUOTE, { replace: true });
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
  }, [longformQuoteFetcher.data, navigate]);

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

          // Get user relays from user data
          const sanitizedRelays = user.userRelays ?? [];

          // Locate the parent event id in the kind-6 tags so we can scope
          // the per-attempt idempotency key. Falls back to the submission
          // instant when no `e` tag is present.
          const originalEventId = String(
            eventData.tags.find((tag: string[]) => tag[0] === "e")?.[1] ?? ""
          );
          const idempotencyKey = `individual-repost:${originalEventId || "no-event"}:${Date.now()}`;

          const result = await startRecoverableSign({
            intent: durableIntent("publish_quote", idempotencyKey, "Repost"),
            surface: `published-posts:individual-repost:${originalEventId || "unknown"}`,
            performSignAndSubmit: async (submissionId) => {
              const { signedEvent } = await nostrAdapter.signEvent(eventData, {
                clearCacheOnError: false,
              });

              const response = await fetch("/api/publish", {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  relays: sanitizedRelays,
                  event: signedEvent,
                  attemptId: submissionId,
                }),
              });

              if (!response.ok) {
                const message = `Failed to publish repost (${response.status})`;
                signingAttempts.markFailed(submissionId, message);
                throw new Error(message);
              }
              signingAttempts.markCompleted(submissionId);
            },
          });

          if (!result.ok) {
            if (result.reason === "fatal" || result.reason === "expired") {
              throw new Error(result.lastError ?? `Failed to publish repost`);
            }
            return;
          }

          // Add delay before showing success toast
          setTimeout(() => {
            setToast({
              type: "success",
              message: "Post reposted successfully!",
              link: nostrUrls.eventUrl(originalEventId),
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
        navigate(PATH_BULK_POSTS_QUOTE, { replace: true });
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
  }, [individualRepostFetcher.data, user, navigate, nostrUrls]);

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
    optimisticallyRemovePublishedItems,
  };
}
