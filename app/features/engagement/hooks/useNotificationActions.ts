import { useQueryClient } from "@tanstack/react-query";
import { nip19 } from "nostr-tools";
import { useCallback, useEffect, useState } from "react";

import { signingAttempts } from "~/features/auth/signing/signing-attempts.client";
import {
  durableIntent,
  ephemeralIntent,
  startRecoverableSign,
} from "~/features/auth/signing/use-recoverable-sign.client";
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

  // PR 4 — ephemeral intents expose their attemptId so callers can render
  // the SubtleSignPending / CompactSignStatus tier in-row. `null` when no
  // attempt is in flight or the most recent attempt has been cancelled
  // out of the store.
  const [likeAttemptId, setLikeAttemptId] = useState<string | null>(null);
  const [repostAttemptId, setRepostAttemptId] = useState<string | null>(null);

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
    const replySnapshot = replyContent;
    // Idempotency key collapses a resumed retry onto the same server-side
    // dedupe slot. Includes a wall-clock seed so multiple distinct reply
    // attempts to the same event (typo-fix, follow-up reply minutes
    // later) don't accidentally collide.
    const idempotencyKey = `reply:${notification.eventId}:${Date.now()}`;
    try {
      const result = await startRecoverableSign({
        intent: durableIntent("publish_reply", idempotencyKey, "Reply"),
        surface: `notifications:row:${notification.eventId}`,
        performSignAndSubmit: async (submissionId) => {
          const { signedEvent } = await nostrAdapter.signEvent(
            {
              kind: 1,
              content: replySnapshot,
              tags: [
                ["e", notification.eventId, DEFAULT_RELAY, "reply"],
                ["p", notification.pubkey],
              ],
              created_at: Math.floor(Date.now() / 1000),
            },
            { clearCacheOnError: false }
          );

          const response = await fetch(PUBLISH_API_ENDPOINT, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              relays: userRelays,
              event: signedEvent,
              attemptId: submissionId,
              recordAsReply: {
                replyToEventId: notification.eventId,
              },
            }),
          });

          if (!response.ok) {
            const message = `Failed to publish reply (${response.status})`;
            signingAttempts.markFailed(submissionId, message);
            throw new Error(message);
          }
          signingAttempts.markCompleted(submissionId);
        },
      });

      if (result.ok) {
        if (!suppressSuccessToast) {
          showToast("success", "Reply posted successfully!");
        }
        setReplyContent("");
        setShowReplyInput(false);
        return true;
      }

      // Recoverable failure (fatal / expired / cancelled). Surface a
      // toast so the user knows to try again — the recovery banner is
      // already showing for `awaiting_signer`/`expired`, so the toast
      // here is the secondary signal for the non-banner branches.
      const { handleAsyncError } = await import("~/lib/error-handler.client");
      handleAsyncError(
        new Error(
          result.lastError ?? `Failed to post reply (${result.reason})`
        ),
        { component: "useNotificationActions", action: "handleReply" },
        false
      );
      showToast(
        "error",
        result.lastError ?? "Failed to post reply. Please try again."
      );
      return false;
    } finally {
      setIsReplying(false);
    }
  };

  const handleRepost = async (): Promise<boolean> => {
    setIsReposting(true);
    setRepostAttemptId(null);
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

      let trackedAttemptId: string | null = null;

      const result = await startRecoverableSign({
        intent: ephemeralIntent("reaction", "Repost"),
        surface: `notifications:row:${notification.eventId}`,
        performSignAndSubmit: async (submissionId) => {
          if (trackedAttemptId !== submissionId) {
            trackedAttemptId = submissionId;
            setRepostAttemptId(submissionId);
          }
          const { signedEvent } = await nostrAdapter.signEvent(kind6EventData, {
            clearCacheOnError: false,
          });

          const response = await fetch(PUBLISH_API_ENDPOINT, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              relays: userRelays,
              event: signedEvent,
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

      if (result.ok) {
        if (!suppressSuccessToast) {
          showToast("success", "Reposted successfully!");
        }
        return true;
      }

      // For ephemeral intents, the per-row CompactSignStatus owns the
      // recovery affordance — only surface a toast for fatal/expired so
      // we don't double up while the in-row pill is still visible.
      if (result.reason === "fatal" || result.reason === "expired") {
        const { handleAsyncError } = await import("~/lib/error-handler.client");
        handleAsyncError(
          new Error(result.lastError ?? "Failed to repost"),
          { component: "useNotificationActions", action: "handleRepost" },
          false
        );
        showToast("error", result.lastError ?? "Failed to repost");
      }
      return false;
    } finally {
      setIsReposting(false);
    }
  };

  const handleLike = async (): Promise<boolean> => {
    setLikeAttemptId(null);
    const kind7EventData = {
      kind: 7,
      content: "+",
      tags: [
        ["e", notification.eventId],
        ["p", notification.pubkey],
      ],
      created_at: Math.floor(Date.now() / 1000),
    };

    let trackedAttemptId: string | null = null;

    const result = await startRecoverableSign({
      intent: ephemeralIntent("reaction", "Like"),
      surface: `notifications:row:${notification.eventId}`,
      performSignAndSubmit: async (submissionId) => {
        if (trackedAttemptId !== submissionId) {
          trackedAttemptId = submissionId;
          setLikeAttemptId(submissionId);
        }
        const { signedEvent } = await nostrAdapter.signEvent(kind7EventData, {
          clearCacheOnError: false,
        });

        const response = await fetch(PUBLISH_API_ENDPOINT, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            relays: userRelays,
            event: signedEvent,
          }),
        });

        if (!response.ok) {
          const message = `Failed to publish like (${response.status})`;
          signingAttempts.markFailed(submissionId, message);
          throw new Error(message);
        }
        signingAttempts.markCompleted(submissionId);
      },
    });

    if (result.ok) {
      if (!suppressSuccessToast) {
        showToast("success", "Liked!", 2000);
      }
      return true;
    }

    // Per the ephemeral tier: leave `awaiting_signer` recovery to the
    // in-row CompactSignStatus pill; only escalate to a toast on
    // fatal/expired so the user isn't double-notified.
    if (result.reason === "fatal" || result.reason === "expired") {
      const { handleAsyncError } = await import("~/lib/error-handler.client");
      handleAsyncError(
        new Error(result.lastError ?? "Failed to like"),
        { component: "useNotificationActions", action: "handleLike" },
        false
      );
      showToast("error", result.lastError ?? "Failed to like");
    }
    return false;
  };

  const handleQuote = async (): Promise<boolean> => {
    if (!quoteContent.trim()) return false;

    setIsQuoting(true);
    const quoteSnapshot = quoteContent;
    const idempotencyKey = `quote:${notification.eventId}:${Date.now()}`;
    try {
      const neventEncoded = nip19.neventEncode({
        id: notification.eventId,
        relays: [DEFAULT_RELAY],
        author: notification.pubkey,
      });
      const quotePostContent = [quoteSnapshot, `nostr:${neventEncoded}`]
        .filter(Boolean)
        .join("\n\n");

      const result = await startRecoverableSign({
        intent: durableIntent("publish_quote", idempotencyKey, "Quote"),
        surface: `notifications:row:${notification.eventId}`,
        performSignAndSubmit: async (submissionId) => {
          const { signedEvent } = await nostrAdapter.signEvent(
            {
              kind: 1,
              content: quotePostContent,
              tags: [
                ["e", notification.eventId, DEFAULT_RELAY, "mention"],
                ["p", notification.pubkey, "", "mention"],
              ],
              created_at: Math.floor(Date.now() / 1000),
            },
            { clearCacheOnError: false }
          );

          const response = await fetch(PUBLISH_API_ENDPOINT, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              relays: userRelays,
              event: signedEvent,
              attemptId: submissionId,
            }),
          });

          if (!response.ok) {
            const message = `Failed to publish quote (${response.status})`;
            signingAttempts.markFailed(submissionId, message);
            throw new Error(message);
          }
          signingAttempts.markCompleted(submissionId);
        },
      });

      if (result.ok) {
        if (!suppressSuccessToast) {
          showToast("success", "Quote posted successfully!");
        }
        setQuoteContent("");
        setShowQuoteInput(false);
        setShowReplyInput(false);
        return true;
      }

      const { handleAsyncError } = await import("~/lib/error-handler.client");
      handleAsyncError(
        new Error(
          result.lastError ?? `Failed to post quote (${result.reason})`
        ),
        { component: "useNotificationActions", action: "handleQuote" },
        false
      );
      showToast(
        "error",
        result.lastError ?? "Failed to post quote. Please try again."
      );
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
            const { signedEvent: se } = await nostrAdapter.signEvent(
              {
                kind: 1,
                content: params.content,
                tags: [
                  ["e", notification.eventId, relay, "reply"],
                  ["p", notification.pubkey],
                ],
                created_at: unix,
              },
              { clearCacheOnError: false }
            );
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
            const { signedEvent: se } = await nostrAdapter.signEvent(
              {
                kind: 1,
                content: quotePostContent,
                tags: [
                  ["e", notification.eventId, relay, "mention"],
                  ["p", notification.pubkey, "", "mention"],
                ],
                created_at: unix,
              },
              { clearCacheOnError: false }
            );
            signedEvent = se;
          } else {
            const { signedEvent: se } = await nostrAdapter.signEvent(
              {
                kind: 6,
                content: "",
                tags: [
                  ["e", notification.eventId, relay],
                  ["p", notification.pubkey],
                ],
                created_at: unix,
              },
              { clearCacheOnError: false }
            );
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

    // Ephemeral attempt ids (PR 4) — feed into useSigningAttemptById
    // + SubtleSignPending / CompactSignStatus to render in-row recovery.
    likeAttemptId,
    repostAttemptId,

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
