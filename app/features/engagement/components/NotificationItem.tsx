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
import { QuoteInputPanel, ReplyInputPanel } from "./NotificationInputPanels";

interface NotificationItemProps {
  notification: Notification;
  userTimezone?: string;
  userRelays?: string[];
  trustScores?: Record<string, number>;
  isHandled?: boolean;
  /** Mark this item as done. (eventId, repliedFromApp). */
  onMarkDone?: (eventId: string, repliedFromApp?: boolean) => Promise<void>;
  /** Keyboard nav: flat list index for this item. */
  keyboardIndex?: number;
  /** Keyboard nav: whether this item is currently focused. */
  isKeyboardFocused?: boolean;
  /** Keyboard nav: register handlers for R/L/M/E. */
  registerKeyboardHandlers?: (
    index: number,
    handlers: {
      openReply: () => void;
      like: () => void;
      markDone: () => void;
      expandThread: () => void;
    } | null
  ) => void;
  /** Reply templates for slash-command / Insert template */
  replyTemplates?: ReplyTemplate[];
  /** URL for "View on client" link (from preferred Nostr client setting). */
  viewEventUrl?: string;
  /** Label for "View on client" link (e.g. "View on Primal"). */
  viewEventLabel?: string;
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
}: NotificationItemProps) {
  const { formatDate } = useFormattedDate();
  const [zapModalNpub, setZapModalNpub] = useState<string | null>(null);
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
    openReply: () => actions.setShowReplyInput(true),
    like: () => {
      void actions.handleLike();
    },
    markDone: () => {}, // Mark as done action removed in favor of Zap
    expandThread: () => actions.setShowChildReplies(!actions.showChildReplies),
  });
  useEffect(() => {
    handlersRef.current = {
      openReply: () => actions.setShowReplyInput(true),
      like: () => {
        void actions.handleLike();
      },
      markDone: () => {},
      expandThread: () =>
        actions.setShowChildReplies(!actions.showChildReplies),
    };
  }, [actions]);

  // Register keyboard handlers for this item (R, L, M, E)
  useEffect(() => {
    if (keyboardIndex < 0 || !registerKeyboardHandlers) return;
    registerKeyboardHandlers(keyboardIndex, {
      openReply: () => handlersRef.current.openReply(),
      like: () => handlersRef.current.like(),
      markDone: () => handlersRef.current.markDone(),
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
              actions.setShowQuoteInput(!actions.showQuoteInput)
            }
            onCopyNevent={() => {
              void actions.copyNevent();
            }}
            onToggleChildReplies={() =>
              actions.setShowChildReplies(!actions.showChildReplies)
            }
            zapNpub={zapNpub}
            onZapClick={zapNpub ? (npub) => setZapModalNpub(npub) : undefined}
            viewEventUrl={viewEventUrl}
            viewEventLabel={viewEventLabel}
          />

          {/* Reply Input */}
          {actions.showReplyInput ? (
            <ReplyInputPanel
              replyContent={actions.replyContent}
              isReplying={actions.isReplying}
              onContentChange={actions.setReplyContent}
              onSubmit={() => {
                void (async () => {
                  try {
                    await actions.handleReply();
                    if (onMarkDone && notification.eventId) {
                      await onMarkDone(notification.eventId, true);
                    }
                  } catch {
                    // handleReply shows its own toast
                  }
                })();
              }}
              onCancel={() => {
                actions.setShowReplyInput(false);
                actions.setReplyContent("");
              }}
              templates={replyTemplates}
              onInsertTemplate={(body) =>
                actions.setReplyContent(actions.replyContent + body)
              }
            />
          ) : null}

          {/* Quote Input */}
          {actions.showQuoteInput ? (
            <QuoteInputPanel
              quoteContent={actions.quoteContent}
              originalContent={notification.content}
              isQuoting={actions.isQuoting}
              onContentChange={actions.setQuoteContent}
              onSubmit={() => {
                void actions.handleQuote();
              }}
              onCancel={() => {
                actions.setShowQuoteInput(false);
                actions.setQuoteContent("");
              }}
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
