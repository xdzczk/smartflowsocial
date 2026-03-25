import { Link } from "@remix-run/react";
import { AtSign, MessageCircle, Quote } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import ZapButton from "~/components/dashboard/ZapButton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { useFormattedDate } from "~/lib/hooks/useFormattedDate";
import {
  INLINE_ICON_SIZE_CLASS,
  INLINE_ICON_STROKE,
} from "~/lib/icon-constants";
import { nostrAdapter } from "~/lib/nostr-adapter.client";

import type { Notification } from "../engagement.server";
import { useNotificationActions } from "../hooks/useNotificationActions";
import type { ReplyTemplate } from "../hooks/useReplyTemplates";
import { getTrustLevel, getTrustScoreBadgeColor } from "../trust-score";

import { ChildRepliesPanel } from "./ChildRepliesPanel";
import {
  NotificationActionButtons,
  type NotificationStats,
} from "./NotificationActionButtons";
import { UnifiedEngagementComposer } from "./NotificationInputPanels";

interface NotificationItemProps {
  notification: Notification;
  userTimezone?: string;
  userRelays?: string[];
  trustScores?: Record<string, number>;
  isHandled?: boolean;
  /** Mark this item as done. (eventId, repliedFromApp). */
  onMarkDone?: (
    eventId: string,
    repliedFromApp?: boolean,
    state?:
      | "UNHANDLED"
      | "DRAFTED"
      | "SCHEDULED"
      | "REPLIED"
      | "IGNORED"
      | "SNOOZED"
      | "HANDLED",
    snoozedUntil?: string | null
  ) => Promise<void>;
  /** Keyboard nav: flat list index for this item. */
  keyboardIndex?: number;
  /** Keyboard nav: whether this item is currently focused. */
  isKeyboardFocused?: boolean;
  /** Keyboard nav: register handlers for R/L/M/E. */
  registerKeyboardHandlers?: (
    index: number,
    handlers: {
      openReply: () => void;
      openQuote?: () => void;
      openRepost?: () => void;
      like: () => void;
      markDone: () => void;
      ignore?: () => void;
      snooze?: () => void;
      publishNow?: () => void;
      schedule?: () => void;
      expandThread: () => void;
    } | null
  ) => void;
  /** Reply templates for slash-command / Insert template */
  replyTemplates?: ReplyTemplate[];
  /** URL for "View on client" link (from preferred Nostr client setting). */
  viewEventUrl?: string;
  /** Label for "View on client" link (e.g. "View on Primal"). */
  viewEventLabel?: string;
  workflowState?:
    | "UNHANDLED"
    | "DRAFTED"
    | "SCHEDULED"
    | "REPLIED"
    | "IGNORED"
    | "SNOOZED"
    | "HANDLED";
  linkedActions?: Array<{
    kind: string;
    label?: string | null;
    scheduledFor?: string | null;
    postId?: string | null;
    draftId?: string | null;
  }>;
}

// Type badge configuration for each notification type
const MUTED_BG_CLASS = "bg-muted";
const MUTED_TEXT_CLASS = "text-muted-foreground";

const TYPE_BADGES = {
  reply: {
    label: "replied",
    bgClass: MUTED_BG_CLASS,
    textClass: MUTED_TEXT_CLASS,
    icon: (
      <MessageCircle
        className={INLINE_ICON_SIZE_CLASS}
        strokeWidth={INLINE_ICON_STROKE}
        aria-hidden
      />
    ),
  },
  mention: {
    label: "mentioned",
    bgClass: MUTED_BG_CLASS,
    textClass: MUTED_TEXT_CLASS,
    icon: (
      <AtSign
        className={INLINE_ICON_SIZE_CLASS}
        strokeWidth={INLINE_ICON_STROKE}
        aria-hidden
      />
    ),
  },
  quote: {
    label: "quoted",
    bgClass: MUTED_BG_CLASS,
    textClass: MUTED_TEXT_CLASS,
    icon: (
      <Quote
        className={INLINE_ICON_SIZE_CLASS}
        strokeWidth={INLINE_ICON_STROKE}
        aria-hidden
      />
    ),
  },
};

export function NotificationItem({
  notification,
  userTimezone: _userTimezone,
  userRelays = ["wss://relay.primal.net"],
  trustScores = {},
  isHandled = false,
  onMarkDone,
  keyboardIndex = -1,
  isKeyboardFocused = false,
  registerKeyboardHandlers,
  replyTemplates = [],
  viewEventUrl,
  viewEventLabel,
  workflowState,
  linkedActions = [],
}: NotificationItemProps) {
  const { formatDate } = useFormattedDate();
  const [zapModalNpub, setZapModalNpub] = useState<string | null>(null);
  const [composerMode, setComposerMode] = useState<
    "reply" | "quote" | "repost-note"
  >("reply");
  const [repostWithNoteContent, setRepostWithNoteContent] = useState("");
  const zapNpub = nostrAdapter.encodeNpub(notification.pubkey) ?? undefined;

  const actions = useNotificationActions({
    notification: {
      eventId: notification.eventId,
      pubkey: notification.pubkey,
      content: notification.content,
    },
    userRelays,
  });

  const displayName =
    notification.authorName ??
    notification.pubkey.substring(0, 8) + "..." + notification.pubkey.slice(-4);

  // Get trust score for this user
  const trustScore = trustScores[notification.pubkey];
  const trustInfo = trustScore !== undefined ? getTrustLevel(trustScore) : null;
  const trustBadgeColor =
    trustScore !== undefined ? getTrustScoreBadgeColor(trustScore) : null;

  // Get type-specific badge configuration
  const typeBadge = TYPE_BADGES[notification.type as keyof typeof TYPE_BADGES];

  // Get stats (available on all notification types)
  const stats: NotificationStats | undefined = notification.stats;

  // Keep handlers in a ref so we can register once and always call latest. Update in effect to avoid ref mutation during render.
  const handlersRef = useRef({
    openReply: () => {
      setComposerMode("reply");
      actions.setShowReplyInput(true);
    },
    openQuote: () => {
      setComposerMode("quote");
      actions.setShowReplyInput(true);
    },
    openRepost: () => {
      setComposerMode("repost-note");
      actions.setShowReplyInput(true);
    },
    like: () => {
      void actions.handleLike();
    },
    markDone: () => {
      if (onMarkDone && notification.eventId) {
        void onMarkDone(notification.eventId, false, "HANDLED");
      }
    },
    ignore: () => {
      if (onMarkDone && notification.eventId) {
        void onMarkDone(notification.eventId, false, "IGNORED");
      }
    },
    snooze: () => {
      if (onMarkDone && notification.eventId) {
        const nextDay = new Date(Date.now() + 24 * 60 * 60 * 1000);
        void onMarkDone(
          notification.eventId,
          false,
          "SNOOZED",
          nextDay.toISOString()
        );
      }
    },
    publishNow: () => {
      void (async () => {
        if (composerMode === "reply") await actions.handleReply();
        else {
          const nextContent =
            composerMode === "quote"
              ? actions.quoteContent
              : repostWithNoteContent;
          actions.setQuoteContent(nextContent);
          await actions.handleQuote();
        }
      })();
    },
    schedule: () => {
      const actionType =
        composerMode === "reply"
          ? "reply"
          : composerMode === "quote"
            ? "quote"
            : "repost";
      const content =
        composerMode === "reply"
          ? actions.replyContent
          : composerMode === "quote"
            ? actions.quoteContent
            : repostWithNoteContent;
      void actions.deferAction({
        actionType,
        mode: "schedule",
        content,
        scheduledFor: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      });
    },
    expandThread: () => actions.setShowChildReplies(!actions.showChildReplies),
  });
  useEffect(() => {
    handlersRef.current = {
      openReply: () => {
        setComposerMode("reply");
        actions.setShowReplyInput(true);
      },
      openQuote: () => {
        setComposerMode("quote");
        actions.setShowReplyInput(true);
      },
      openRepost: () => {
        setComposerMode("repost-note");
        actions.setShowReplyInput(true);
      },
      like: () => {
        void actions.handleLike();
      },
      markDone: () => {
        if (onMarkDone && notification.eventId) {
          void onMarkDone(notification.eventId, false, "HANDLED");
        }
      },
      ignore: () => {
        if (onMarkDone && notification.eventId) {
          void onMarkDone(notification.eventId, false, "IGNORED");
        }
      },
      snooze: () => {
        if (onMarkDone && notification.eventId) {
          const nextDay = new Date(Date.now() + 24 * 60 * 60 * 1000);
          void onMarkDone(
            notification.eventId,
            false,
            "SNOOZED",
            nextDay.toISOString()
          );
        }
      },
      publishNow: () => {
        void (async () => {
          if (composerMode === "reply") await actions.handleReply();
          else {
            const nextContent =
              composerMode === "quote"
                ? actions.quoteContent
                : repostWithNoteContent;
            actions.setQuoteContent(nextContent);
            await actions.handleQuote();
          }
        })();
      },
      schedule: () => {
        const actionType =
          composerMode === "reply"
            ? "reply"
            : composerMode === "quote"
              ? "quote"
              : "repost";
        const content =
          composerMode === "reply"
            ? actions.replyContent
            : composerMode === "quote"
              ? actions.quoteContent
              : repostWithNoteContent;
        void actions.deferAction({
          actionType,
          mode: "schedule",
          content,
          scheduledFor: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        });
      },
      expandThread: () =>
        actions.setShowChildReplies(!actions.showChildReplies),
    };
  }, [
    actions,
    composerMode,
    notification.eventId,
    onMarkDone,
    repostWithNoteContent,
  ]);

  // Register keyboard handlers for this item (R, L, M, E)
  useEffect(() => {
    if (keyboardIndex < 0 || !registerKeyboardHandlers) return;
    registerKeyboardHandlers(keyboardIndex, {
      openReply: () => handlersRef.current.openReply(),
      openQuote: () => handlersRef.current.openQuote(),
      openRepost: () => handlersRef.current.openRepost(),
      like: () => handlersRef.current.like(),
      markDone: () => handlersRef.current.markDone(),
      ignore: () => handlersRef.current.ignore(),
      snooze: () => handlersRef.current.snooze(),
      publishNow: () => handlersRef.current.publishNow(),
      schedule: () => handlersRef.current.schedule(),
      expandThread: () => handlersRef.current.expandThread(),
    });
    return () => registerKeyboardHandlers(keyboardIndex, null);
  }, [keyboardIndex, registerKeyboardHandlers]);

  return (
    <div
      className={`p-3 transition-colors ${isHandled ? "hover:bg-muted/50 opacity-90" : "hover:bg-muted border-primary/30 bg-primary/5 border-l-2"} ${isKeyboardFocused ? "ring-primary ring-2 ring-inset" : ""}`}
    >
      <div className="flex gap-2">
        {/* Author Avatar */}
        <div className="flex-shrink-0">
          {notification.authorPicture ? (
            <img
              src={notification.authorPicture}
              alt={displayName}
              className="h-11 w-11 rounded-full"
            />
          ) : (
            <div className="bg-muted h-11 w-11 rounded-full" />
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden">
          {/* Header */}
          <div className="mb-1 flex flex-wrap items-center gap-1.5">
            <span className="text-foreground text-sm font-semibold">
              {displayName}
            </span>
            {notification.authorNip05 ? (
              <span className="text-muted-foreground text-xs">
                @{notification.authorNip05.split("@")[0]}
              </span>
            ) : null}
            {trustInfo && trustBadgeColor && trustScore !== undefined ? (
              <span
                className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${trustBadgeColor}`}
                title={`Trust Score: ${trustScore} - ${trustInfo.description}`}
              >
                {trustInfo.level}
              </span>
            ) : null}
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-sm font-medium ${typeBadge.bgClass} ${typeBadge.textClass}`}
            >
              {typeBadge.icon}
              {typeBadge.label}
            </span>
            <span className="text-muted-foreground text-xs">
              {formatDate(notification.createdAt, {
                isUnixTimestamp: true,
              })}
            </span>
          </div>

          {/* Notification Content */}
          <p className="text-foreground mb-2 text-sm break-words whitespace-pre-wrap">
            {notification.content}
          </p>
          <div className="mb-2 flex flex-wrap items-center gap-1.5">
            <span className="bg-muted text-muted-foreground rounded-full px-2 py-0.5 text-xs font-medium">
              {workflowState ?? (isHandled ? "HANDLED" : "UNHANDLED")}
            </span>
            {linkedActions.map((action) => {
              const text =
                action.label ??
                action.kind
                  .toLowerCase()
                  .replaceAll("_", " ")
                  .replace(/^./, (c) => c.toUpperCase());
              const href = action.draftId
                ? `/dashboard/drafts?draftId=${encodeURIComponent(action.draftId)}`
                : action.postId
                  ? `/dashboard/scheduled?postId=${encodeURIComponent(action.postId)}`
                  : null;
              return href ? (
                <Link
                  key={`${action.kind}-${action.postId ?? "nopost"}-${action.draftId ?? "nodraft"}-${action.scheduledFor ?? "noschedule"}-${action.label ?? "nolabel"}`}
                  to={href}
                  className="bg-primary/10 text-primary rounded-full px-2 py-0.5 text-xs font-medium hover:underline"
                  title={action.scheduledFor ?? undefined}
                >
                  {text}
                </Link>
              ) : (
                <span
                  key={`${action.kind}-${action.postId ?? "nopost"}-${action.draftId ?? "nodraft"}-${action.scheduledFor ?? "noschedule"}-${action.label ?? "nolabel"}-static`}
                  className="bg-primary/10 text-primary rounded-full px-2 py-0.5 text-xs font-medium"
                  title={action.scheduledFor ?? undefined}
                >
                  {text}
                </span>
              );
            })}
          </div>

          {/* Action Buttons */}
          <NotificationActionButtons
            eventId={notification.eventId}
            stats={stats}
            isReposting={actions.isReposting}
            showChildReplies={actions.showChildReplies}
            onLike={() => {
              void actions.handleLike();
            }}
            onToggleReply={() =>
              actions.setShowReplyInput(!actions.showReplyInput)
            }
            onRepost={() => {
              void actions.handleRepost();
            }}
            onToggleQuote={() =>
              actions.setShowReplyInput(!actions.showReplyInput)
            }
            onCopyNevent={() => {
              void actions.copyNevent();
            }}
            onToggleChildReplies={() =>
              actions.setShowChildReplies(!actions.showChildReplies)
            }
            onMarkHandled={() => {
              if (onMarkDone && notification.eventId) {
                void onMarkDone(notification.eventId, false, "HANDLED");
              }
            }}
            onIgnore={() => {
              if (onMarkDone && notification.eventId) {
                void onMarkDone(notification.eventId, false, "IGNORED");
              }
            }}
            onSnooze={() => {
              if (onMarkDone && notification.eventId) {
                const nextDay = new Date(Date.now() + 24 * 60 * 60 * 1000);
                void onMarkDone(
                  notification.eventId,
                  false,
                  "SNOOZED",
                  nextDay.toISOString()
                );
              }
            }}
            zapNpub={zapNpub}
            onZapClick={zapNpub ? (npub) => setZapModalNpub(npub) : undefined}
            viewEventUrl={viewEventUrl}
            viewEventLabel={viewEventLabel}
          />

          {/* Unified Composer */}
          {actions.showReplyInput ? (
            <UnifiedEngagementComposer
              mode={composerMode}
              onModeChange={setComposerMode}
              value={
                composerMode === "reply"
                  ? actions.replyContent
                  : composerMode === "quote"
                    ? actions.quoteContent
                    : repostWithNoteContent
              }
              onValueChange={(value) => {
                if (composerMode === "reply") actions.setReplyContent(value);
                else if (composerMode === "quote")
                  actions.setQuoteContent(value);
                else setRepostWithNoteContent(value);
              }}
              isSubmitting={
                actions.isReplying || actions.isQuoting || actions.isReposting
              }
              onSubmitNow={() => {
                void (async () => {
                  if (composerMode === "reply") {
                    await actions.handleReply();
                  } else {
                    const nextContent =
                      composerMode === "quote"
                        ? actions.quoteContent
                        : repostWithNoteContent;
                    actions.setQuoteContent(nextContent);
                    await actions.handleQuote();
                  }
                  if (onMarkDone && notification.eventId) {
                    await onMarkDone(notification.eventId, true, "REPLIED");
                  }
                })();
              }}
              onSchedule={() => {
                const actionType =
                  composerMode === "reply"
                    ? "reply"
                    : composerMode === "quote"
                      ? "quote"
                      : "repost";
                const content =
                  composerMode === "reply"
                    ? actions.replyContent
                    : composerMode === "quote"
                      ? actions.quoteContent
                      : repostWithNoteContent;
                void actions.deferAction({
                  actionType,
                  mode: "schedule",
                  content,
                  scheduledFor: new Date(
                    Date.now() + 60 * 60 * 1000
                  ).toISOString(),
                });
              }}
              onSaveDraft={() => {
                const actionType =
                  composerMode === "reply"
                    ? "reply"
                    : composerMode === "quote"
                      ? "quote"
                      : "repost";
                const content =
                  composerMode === "reply"
                    ? actions.replyContent
                    : composerMode === "quote"
                      ? actions.quoteContent
                      : repostWithNoteContent;
                void actions.deferAction({
                  actionType,
                  mode: "draft",
                  content,
                });
              }}
              onAddToQueue={() => {
                const actionType =
                  composerMode === "reply"
                    ? "reply"
                    : composerMode === "quote"
                      ? "quote"
                      : "repost";
                const content =
                  composerMode === "reply"
                    ? actions.replyContent
                    : composerMode === "quote"
                      ? actions.quoteContent
                      : repostWithNoteContent;
                void actions.deferAction({
                  actionType,
                  mode: "queue",
                  content,
                });
              }}
              onCancel={() => {
                actions.setShowReplyInput(false);
                actions.setReplyContent("");
                actions.setQuoteContent("");
                setRepostWithNoteContent("");
              }}
              templates={replyTemplates}
            />
          ) : null}

          {/* Child Replies */}
          {actions.showChildReplies ? (
            <ChildRepliesPanel
              isLoading={actions.isLoadingReplies}
              replies={actions.childReplies}
              metadata={actions.childMetadata}
            />
          ) : null}

          {/* Toast Notification */}
          {actions.toast ? (
            <div
              className={`mt-2 rounded-lg px-3 py-2 text-xs ${actions.toast.type === "success" ? "bg-success/20 text-success dark:text-success" : "bg-destructive/20 text-destructive"}`}
            >
              {actions.toast.message}
            </div>
          ) : null}
        </div>
      </div>

      {/* Zap modal - single target so nostr-zap script works */}
      <Dialog
        open={!!zapModalNpub}
        onOpenChange={(open) => !open && setZapModalNpub(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Zap reply author</DialogTitle>
          </DialogHeader>
          {zapModalNpub ? <ZapButton npub={zapModalNpub} /> : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
