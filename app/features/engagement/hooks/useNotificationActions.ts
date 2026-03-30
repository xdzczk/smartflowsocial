import { useQueryClient } from "@tanstack/react-query";
import { nip19 } from "nostr-tools";
import { useCallback, useEffect, useState } from "react";

import type { SignedEvent } from "~/features/nostr/types";
import { nostrAdapter } from "~/lib/nostr-adapter.client";

import type { NotificationEvent, NostrTag } from "../types";

import { engagementKeys } from "./useEngagementQuery";

const DEFAULT_RELAY = "wss://relay.primal.net";
const PUBLISH_API_ENDPOINT = "/api/publish";

export interface NotificationActionTarget {
  eventId: string;
  pubkey: string;
  content?: string;
}

export interface UseNotificationActionsProps {
  notification: NotificationActionTarget;
  userRelays?: string[];
  /** When true, omit success toasts for publish/defer (caller shows inline feedback). */
  suppressSuccessToast?: boolean;
}

export interface ToastState {
  type: "success" | "error";
  message: string;
}

export interface ChildReply {
  id: string;
  pubkey: string;
  content: string;
  created_at: number;
  tags?: string[][];
}

export function useNotificationActions({
  notification,
  userRelays = [DEFAULT_RELAY],
  suppressSuccessToast = false,
}: UseNotificationActionsProps) {
  const queryClient = useQueryClient();

  // UI state
  const [showReplyInput, setShowReplyInput] = useState(false);
  const [replyContent, setReplyContent] = useState("");
  const [showQuoteInput, setShowQuoteInput] = useState(false);
  const [quoteContent, setQuoteContent] = useState("");
  const [showChildReplies, setShowChildReplies] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);

  // Loading states
  const [isReplying, setIsReplying] = useState(false);
  const [isReposting, setIsReposting] = useState(false);
  const [isQuoting, setIsQuoting] = useState(false);
  const [isLoadingReplies, setIsLoadingReplies] = useState(false);

  // Child replies data
  const [childReplies, setChildReplies] = useState<ChildReply[]>([]);
  const [childMetadata, setChildMetadata] = useState<Record<string, unknown>>(
    {}
  );

  const showToast = (
    type: "success" | "error",
    message: string,
    duration = 3000
  ) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), duration);
  };

  const copyNevent = async () => {
    try {
      const neventEncoded = nip19.neventEncode({
        id: notification.eventId,
        relays: [DEFAULT_RELAY],
        author: notification.pubkey,
      });

      await navigator.clipboard.writeText(`nostr:${neventEncoded}`);
      showToast("success", "NEvent copied to clipboard!", 2000);
    } catch (error) {
      const { handleAsyncErrorWithMessage } =
        await import("~/lib/error-handler.client");
      handleAsyncErrorWithMessage(
        error,
        "Failed to copy",
        {
          component: "useNotificationActions",
          action: "handleCopyNEvent",
        },
        false // Don't show toast, we call showToast instead
      );
      showToast("error", "Failed to copy", 2000);
    }
  };

  const handleReply = async (): Promise<boolean> => {
    if (!replyContent.trim()) return false;

    setIsReplying(true);
    try {
      const kind1EventData = {
        kind: 1,
        content: replyContent,
        tags: [
          ["e", notification.eventId, DEFAULT_RELAY, "reply"],
          ["p", notification.pubkey],
        ],
        created_at: Math.floor(Date.now() / 1000),
      };

      const { signedEvent } =
        await nostrAdapter.signEventWithOneRetry(kind1EventData);

      const response = await fetch(PUBLISH_API_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          relays: userRelays,
          event: signedEvent,
          recordAsReply: {
            replyToEventId: notification.eventId,
          },
        }),
      });

      if (!response.ok) throw new Error("Failed to publish reply");

      if (!suppressSuccessToast) {
        showToast("success", "Reply posted successfully!");
      }
      setReplyContent("");
      setShowReplyInput(false);
      return true;
    } catch (error) {
      const { handleAsyncError, getErrorMessage } =
        await import("~/lib/error-handler.client");
      handleAsyncError(
        error,
        {
          component: "useNotificationActions",
          action: "handleReply",
        },
        false
      ); // Don't show toast, we call showToast instead
      showToast("error", getErrorMessage(error) || "Failed to post reply");
      return false;
    } finally {
      setIsReplying(false);
    }
  };

  const handleRepost = async (): Promise<boolean> => {
    setIsReposting(true);
    try {
      const kind6EventData = {
        kind: 6,
        content: "",
        tags: [
          ["e", notification.eventId, "wss://relay.primal.net"],
          ["p", notification.pubkey],
        ],
        created_at: Math.floor(Date.now() / 1000),
      };

      const { signedEvent } =
        await nostrAdapter.signEventWithOneRetry(kind6EventData);

      const response = await fetch(PUBLISH_API_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          relays: userRelays,
          event: signedEvent,
        }),
      });

      if (!response.ok) throw new Error("Failed to publish repost");

      if (!suppressSuccessToast) {
        showToast("success", "Reposted successfully!");
      }
      return true;
    } catch (error) {
      const { handleAsyncError, getErrorMessage } =
        await import("~/lib/error-handler.client");
      handleAsyncError(
        error,
        {
          component: "useNotificationActions",
          action: "handleRepost",
        },
        false
      ); // Don't show toast, we call showToast instead
      showToast("error", getErrorMessage(error) || "Failed to repost");
      return false;
    } finally {
      setIsReposting(false);
    }
  };

  const handleLike = async (): Promise<boolean> => {
    try {
      const kind7EventData = {
        kind: 7,
        content: "+",
        tags: [
          ["e", notification.eventId],
          ["p", notification.pubkey],
        ],
        created_at: Math.floor(Date.now() / 1000),
      };

      const { signedEvent } =
        await nostrAdapter.signEventWithOneRetry(kind7EventData);

      const response = await fetch(PUBLISH_API_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          relays: userRelays,
          event: signedEvent,
        }),
      });

      if (!response.ok) throw new Error("Failed to publish like");

      if (!suppressSuccessToast) {
        showToast("success", "Liked!", 2000);
      }
      return true;
    } catch (error) {
      const { handleAsyncError, getErrorMessage } =
        await import("~/lib/error-handler.client");
      handleAsyncError(
        error,
        {
          component: "useNotificationActions",
          action: "handleLike",
        },
        false
      ); // Don't show toast, we call showToast instead
      showToast("error", getErrorMessage(error) || "Failed to like");
      return false;
    }
  };

  const handleQuote = async (): Promise<boolean> => {
    if (!quoteContent.trim()) return false;

    setIsQuoting(true);
    try {
      const neventEncoded = nip19.neventEncode({
        id: notification.eventId,
        relays: [DEFAULT_RELAY],
        author: notification.pubkey,
      });

      const quotePostContent = [quoteContent, `nostr:${neventEncoded}`]
        .filter(Boolean)
        .join("\n\n");

      const kind1EventData = {
        kind: 1,
        content: quotePostContent,
        tags: [
          ["e", notification.eventId, DEFAULT_RELAY, "mention"],
          ["p", notification.pubkey, "", "mention"],
        ],
        created_at: Math.floor(Date.now() / 1000),
      };

      const { signedEvent } =
        await nostrAdapter.signEventWithOneRetry(kind1EventData);

      const response = await fetch(PUBLISH_API_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          relays: userRelays,
          event: signedEvent,
        }),
      });

      if (!response.ok) throw new Error("Failed to publish quote post");

      if (!suppressSuccessToast) {
        showToast("success", "Quote posted successfully!");
      }
      setQuoteContent("");
      setShowQuoteInput(false);
      setShowReplyInput(false);
      return true;
    } catch (error) {
      const { handleAsyncError, getErrorMessage } =
        await import("~/lib/error-handler.client");
      handleAsyncError(
        error,
        {
          component: "useNotificationActions",
          action: "handleQuote",
        },
        false
      ); // Don't show toast, we call showToast instead
      showToast("error", getErrorMessage(error) || "Failed to post quote");
      return false;
    } finally {
      setIsQuoting(false);
    }
  };

  const deferAction = async (params: {
    actionType: "reply" | "quote" | "repost";
    mode: "draft" | "schedule";
    content: string;
    scheduledFor?: string | null;
    signedEvent?: SignedEvent | null;
  }): Promise<boolean> => {
    try {
      let signedEvent: SignedEvent | null = params.signedEvent ?? null;
      if (params.mode === "schedule") {
        if (!params.scheduledFor) {
          showToast("error", "Pick a schedule time");
          return false;
        }
        const unix = Math.floor(new Date(params.scheduledFor).getTime() / 1000);
        const relay = userRelays[0] ?? DEFAULT_RELAY;
        if (!signedEvent) {
          if (params.actionType === "reply") {
            const { signedEvent: se } =
              await nostrAdapter.signEventWithOneRetry({
                kind: 1,
                content: params.content,
                tags: [
                  ["e", notification.eventId, relay, "reply"],
                  ["p", notification.pubkey],
                ],
                created_at: unix,
              });
            signedEvent = se;
          } else if (params.actionType === "quote") {
            const neventEncoded = nip19.neventEncode({
              id: notification.eventId,
              relays: [relay],
              author: notification.pubkey,
            });
            const quotePostContent = [params.content, `nostr:${neventEncoded}`]
              .filter(Boolean)
              .join("\n\n");
            const { signedEvent: se } =
              await nostrAdapter.signEventWithOneRetry({
                kind: 1,
                content: quotePostContent,
                tags: [
                  ["e", notification.eventId, relay, "mention"],
                  ["p", notification.pubkey, "", "mention"],
                ],
                created_at: unix,
              });
            signedEvent = se;
          } else {
            const { signedEvent: se } =
              await nostrAdapter.signEventWithOneRetry({
                kind: 6,
                content: "",
                tags: [
                  ["e", notification.eventId, relay],
                  ["p", notification.pubkey],
                ],
                created_at: unix,
              });
            signedEvent = se;
          }
        }
      }

      const response = await fetch("/api/engagement/defer-action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId: notification.eventId,
          actionType: params.actionType,
          mode: params.mode,
          content: params.content,
          scheduledFor: params.scheduledFor ?? null,
          signedEvent:
            params.mode === "schedule" && signedEvent ? signedEvent : undefined,
        }),
      });
      if (!response.ok) throw new Error("Failed to defer action");
      if (!suppressSuccessToast) {
        showToast(
          "success",
          params.mode === "draft" ? "Draft saved" : "Action scheduled"
        );
      }
      await queryClient.invalidateQueries({ queryKey: engagementKeys.lists() });
      return true;
    } catch (error) {
      const { handleAsyncError, getErrorMessage } =
        await import("~/lib/error-handler.client");
      handleAsyncError(
        error,
        {
          component: "useNotificationActions",
          action: "deferAction",
        },
        false
      );
      showToast(
        "error",
        getErrorMessage(error) || "Failed to create deferred action"
      );
      return false;
    }
  };

  const fetchChildReplies = useCallback(async () => {
    if (isLoadingReplies || childReplies.length > 0) return;

    setIsLoadingReplies(true);
    try {
      const response = await fetch(
        `/api/thread-view?event_id=${notification.eventId}`
      );
      if (!response.ok) throw new Error("Failed to fetch replies");

      const data = (await response.json()) as {
        events?: NotificationEvent[];
        metadata?: Record<string, unknown>;
      };

      // Filter to only show direct replies
      const directReplies = (data.events ?? []).filter(
        (event: NotificationEvent) => {
          const eTags = event.tags.filter((tag: NostrTag) => tag[0] === "e");
          return eTags.some((tag: NostrTag) => tag[1] === notification.eventId);
        }
      );

      setChildReplies(directReplies);
      setChildMetadata(data.metadata ?? {});
    } catch (error) {
      const { handleAsyncErrorWithMessage } =
        await import("~/lib/error-handler.client");
      handleAsyncErrorWithMessage(
        error,
        "Failed to load replies",
        {
          component: "useNotificationActions",
          action: "fetchChildReplies",
        },
        false // Don't show toast, we call showToast instead
      );
      showToast("error", "Failed to load replies");
    } finally {
      setIsLoadingReplies(false);
    }
  }, [notification.eventId, isLoadingReplies, childReplies.length]);

  // Auto-fetch child replies when expanded
  useEffect(() => {
    if (showChildReplies && childReplies.length === 0) {
      void fetchChildReplies();
    }
  }, [showChildReplies, childReplies.length, fetchChildReplies]);

  return {
    // State
    toast,
    showReplyInput,
    replyContent,
    showQuoteInput,
    quoteContent,
    showChildReplies,
    childReplies,
    childMetadata,

    // Loading states
    isReplying,
    isReposting,
    isQuoting,
    isLoadingReplies,

    // Setters
    setShowReplyInput,
    setReplyContent,
    setShowQuoteInput,
    setQuoteContent,
    setShowChildReplies,

    // Actions
    copyNevent,
    handleReply,
    handleRepost,
    handleLike,
    handleQuote,
    deferAction,
    fetchChildReplies,
  };
}
