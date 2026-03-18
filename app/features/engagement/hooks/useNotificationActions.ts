import { nip19 } from "nostr-tools";
import { useCallback, useEffect, useState } from "react";

import { nostrAdapter } from "~/lib/nostr-adapter.client";

import type { NotificationEvent, NostrTag } from "../types";

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
}: UseNotificationActionsProps) {
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

  const handleReply = async () => {
    if (!replyContent.trim()) return;

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

      showToast("success", "Reply posted successfully!");
      setReplyContent("");
      setShowReplyInput(false);
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
    } finally {
      setIsReplying(false);
    }
  };

  const handleRepost = async () => {
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

      showToast("success", "Reposted successfully!");
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
    } finally {
      setIsReposting(false);
    }
  };

  const handleLike = async () => {
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

      showToast("success", "Liked!", 2000);
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
    }
  };

  const handleQuote = async () => {
    if (!quoteContent.trim()) return;

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

      showToast("success", "Quote posted successfully!");
      setQuoteContent("");
      setShowQuoteInput(false);
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
    } finally {
      setIsQuoting(false);
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
    fetchChildReplies,
  };
}
