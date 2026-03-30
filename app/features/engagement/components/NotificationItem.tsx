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
import { buildEngagementContentPreview } from "../utils/engagement-content-preview";

import { ChildRepliesPanel } from "./ChildRepliesPanel";
import {
  NotificationActionButtons,
  type NotificationStats,
} from "./NotificationActionButtons";
import {
  RepostEngagementTray,
  UnifiedEngagementComposer,
  type EngagementComposerMode,
} from "./NotificationInputPanels";

function isWorkflowDimmed(
  state?:
    | "UNHANDLED"
    | "DRAFTED"
    | "SCHEDULED"
    | "REPLIED"
    | "IGNORED"
    | "SNOOZED"
    | "HANDLED"
): boolean {
  return state === "HANDLED" || state === "IGNORED" || state === "REPLIED";
}

function workflowStatusLabel(
  state?:
    | "UNHANDLED"
    | "DRAFTED"
    | "SCHEDULED"
    | "REPLIED"
    | "IGNORED"
    | "SNOOZED"
    | "HANDLED"
): string {
  if (!state) return "Unhandled";
  const labels: Record<string, string> = {
    UNHANDLED: "Unhandled",
    DRAFTED: "Drafted",
    SCHEDULED: "Scheduled",
    REPLIED: "Replied",
    IGNORED: "Ignored",
    SNOOZED: "Snoozed",
    HANDLED: "Handled",
  };
  return labels[state] ?? state;
}

interface NotificationItemProps {
  notification: Notification;
  userTimezone?: string;
  userRelays?: string[];
  trustScores?: Record<string, number>;
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
  keyboardIndex?: number;
  isKeyboardFocused?: boolean;
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
  replyTemplates?: ReplyTemplate[];
  viewEventUrl?: string;
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
  isSelected?: boolean;
  onSelect?: () => void;
  contentVariant?: "default" | "mention";
  isFollowingAuthor?: boolean;
}

const MUTED_BG_CLASS = "bg-muted";
const MUTED_TEXT_CLASS = "text-muted-foreground";

const LINKED_CHIP =
  "border-border text-muted-foreground rounded border px-1.5 py-0.5 text-[10px] font-medium";

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

// Row bundles avatar, actions, and tray; complexity is mostly declarative layout.
// eslint-disable-next-line sonarjs/cognitive-complexity -- keep single component for keyboard + selection wiring
export function NotificationItem({
  notification,
  userTimezone,
  userRelays = ["wss://relay.primal.net"],
  trustScores = {},
  onMarkDone,
  keyboardIndex = -1,
  isKeyboardFocused = false,
  registerKeyboardHandlers,
  replyTemplates = [],
  viewEventUrl,
  viewEventLabel,
  workflowState,
  linkedActions = [],
  isSelected = false,
  onSelect,
  contentVariant = "default",
  isFollowingAuthor = false,
}: NotificationItemProps) {
  const { formatDate } = useFormattedDate();
  const [zapModalNpub, setZapModalNpub] = useState<string | null>(null);
  const [showRepostPanel, setShowRepostPanel] = useState(false);
  const [composerMode, setComposerMode] =
    useState<EngagementComposerMode>("reply");
  const trayRef = useRef<HTMLDivElement>(null);
  const zapNpub = nostrAdapter.encodeNpub(notification.pubkey);

  const actions = useNotificationActions({
    notification: {
      eventId: notification.eventId,
      pubkey: notification.pubkey,
      content: notification.content,
    },
    userRelays,
  });

  useEffect(() => {
    if (!isSelected) {
      actions.setShowReplyInput(false);
      actions.setReplyContent("");
      actions.setQuoteContent("");
      setShowRepostPanel(false);
    }
    // actions identity changes each render; collapsing tray only depends on selection
    // eslint-disable-next-line react-hooks/exhaustive-deps -- see above
  }, [isSelected]);

  useEffect(() => {
    if (isKeyboardFocused && onSelect) {
      onSelect();
    }
  }, [isKeyboardFocused, onSelect]);

  useEffect(() => {
    if ((actions.showReplyInput || showRepostPanel) && trayRef.current) {
      trayRef.current.scrollIntoView({
        block: "nearest",
        behavior: "smooth",
      });
    }
  }, [actions.showReplyInput, showRepostPanel]);

  const displayName =
    notification.authorName ??
    notification.pubkey.substring(0, 8) + "..." + notification.pubkey.slice(-4);

  const trustScore = trustScores[notification.pubkey];
  const trustInfo = trustScore !== undefined ? getTrustLevel(trustScore) : null;
  const trustBadgeColor =
    trustScore !== undefined ? getTrustScoreBadgeColor(trustScore) : null;

  const typeBadge =
    notification.type in TYPE_BADGES
      ? TYPE_BADGES[notification.type as keyof typeof TYPE_BADGES]
      : TYPE_BADGES.reply;

  const stats: NotificationStats | undefined = notification.stats;

  const preview = buildEngagementContentPreview(
    notification.content,
    contentVariant
  );

  const dimmed = isWorkflowDimmed(workflowState);

  const handlersRef = useRef({
    openReply: () => {
      setShowRepostPanel(false);
      setComposerMode("reply");
      actions.setShowReplyInput(true);
    },
    openQuote: () => {
      setShowRepostPanel(false);
      setComposerMode("quote");
      actions.setShowReplyInput(true);
    },
    openRepost: () => {
      actions.setShowReplyInput(false);
      setShowRepostPanel(true);
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
          await actions.handleQuote();
        }
      })();
    },
    schedule: () => {
      const actionType = composerMode === "reply" ? "reply" : "quote";
      const content =
        composerMode === "reply" ? actions.replyContent : actions.quoteContent;
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
        setShowRepostPanel(false);
        setComposerMode("reply");
        actions.setShowReplyInput(true);
      },
      openQuote: () => {
        setShowRepostPanel(false);
        setComposerMode("quote");
        actions.setShowReplyInput(true);
      },
      openRepost: () => {
        actions.setShowReplyInput(false);
        setShowRepostPanel(true);
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
            await actions.handleQuote();
          }
        })();
      },
      schedule: () => {
        const actionType = composerMode === "reply" ? "reply" : "quote";
        const content =
          composerMode === "reply"
            ? actions.replyContent
            : actions.quoteContent;
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
  }, [actions, composerMode, notification.eventId, onMarkDone]);

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

  const openComposer = (mode: EngagementComposerMode) => {
    setShowRepostPanel(false);
    setComposerMode(mode);
    actions.setShowReplyInput(true);
  };

  const openRepostPanel = () => {
    actions.setShowReplyInput(false);
    setShowRepostPanel(true);
  };

  return (
    // eslint-disable-next-line jsx-a11y/no-static-element-interactions, jsx-a11y/click-events-have-key-events -- Selection shell only; real actions use nested buttons/links
    <div
      data-testid="engagement-item"
      className={`border-l-4 transition-colors ${
        contentVariant === "mention" ? "px-2.5 py-2 sm:px-3" : "p-2.5 sm:p-3"
      } ${
        isSelected
          ? "border-primary bg-muted/50 ring-primary/10 ring-1 shadow-sm"
          : "hover:bg-muted/25 border-transparent"
      } ${dimmed ? "opacity-[0.88]" : ""} ${
        isKeyboardFocused ? "ring-primary/35 ring-2 ring-inset" : ""
      }`}
      onClick={(e) => {
        const t = e.target as HTMLElement;
        if (
          t.closest("button") ||
          t.closest("a") ||
          t.closest("[role='menuitem']") ||
          t.closest("textarea") ||
          t.closest("input") ||
          t.closest("[data-state]")
        ) {
          return;
        }
        onSelect?.();
      }}
    >
      <div className="flex gap-2">
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

        <div
          className={`min-w-0 flex-1 ${
            isSelected
              ? "border-border/60 bg-muted/25 border-l-primary/35 -mr-px rounded-r-md border-l-2 pl-2.5"
              : ""
          }`}
        >
          <div className="mb-0.5 flex flex-wrap items-center gap-1.5">
            <span className="text-foreground text-sm font-semibold tracking-tight">
              {displayName}
            </span>
            {notification.authorNip05 ? (
              <span className="text-muted-foreground/90 text-[11px]">
                @{notification.authorNip05.split("@")[0]}
              </span>
            ) : null}
            {isFollowingAuthor && contentVariant === "mention" ? (
              <span className="text-foreground/85 text-[11px] font-medium">
                Following
              </span>
            ) : null}
            {trustInfo && trustBadgeColor && trustScore !== undefined ? (
              <span
                className={`inline-flex h-5 items-center gap-0.5 rounded-md border px-1.5 text-[10px] font-medium ${trustBadgeColor}`}
                title={`Trust Score: ${trustScore} - ${trustInfo.description}`}
              >
                {trustInfo.level}
              </span>
            ) : null}
            <span
              className={`inline-flex h-5 items-center gap-1 rounded-md px-1.5 text-[10px] font-medium ${typeBadge.bgClass} ${typeBadge.textClass}`}
            >
              {typeBadge.icon}
              {typeBadge.label}
            </span>
            <span className="text-muted-foreground/80 text-[10px] tabular-nums">
              {formatDate(notification.createdAt, {
                isUnixTimestamp: true,
              })}
            </span>
          </div>

          <p
            className={`mb-1 text-sm leading-snug break-words whitespace-pre-wrap ${
              contentVariant === "mention"
                ? "text-foreground/88"
                : "text-foreground"
            } ${preview.noisy ? "line-clamp-3" : "line-clamp-4"}`}
            title={notification.content}
          >
            {preview.text}
          </p>

          <div className="mb-1 flex flex-wrap items-center gap-1.5">
            <span className="text-muted-foreground/90 text-[10px] font-medium">
              {workflowStatusLabel(workflowState)}
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
                  className={`${LINKED_CHIP} hover:text-foreground hover:underline`}
                  title={action.scheduledFor ?? undefined}
                  onClick={(e) => e.stopPropagation()}
                >
                  {text}
                </Link>
              ) : (
                <span
                  key={`${action.kind}-${action.postId ?? "nopost"}-${action.draftId ?? "nodraft"}-${action.scheduledFor ?? "noschedule"}-${action.label ?? "nolabel"}-static`}
                  className={LINKED_CHIP}
                  title={action.scheduledFor ?? undefined}
                >
                  {text}
                </span>
              );
            })}
          </div>

          <NotificationActionButtons
            eventId={notification.eventId}
            stats={stats}
            isReposting={actions.isReposting}
            showChildReplies={actions.showChildReplies}
            onLike={() => {
              void actions.handleLike();
            }}
            onOpenReply={() => {
              onSelect?.();
              openComposer("reply");
            }}
            onRepost={() => {
              onSelect?.();
              openRepostPanel();
            }}
            onOpenQuote={() => {
              onSelect?.();
              openComposer("quote");
            }}
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
            zapNpub={zapNpub ?? undefined}
            onZapClick={zapNpub ? (npub) => setZapModalNpub(npub) : undefined}
            viewEventUrl={viewEventUrl}
            viewEventLabel={viewEventLabel}
          />

          {actions.showReplyInput ? (
            <UnifiedEngagementComposer
              mode={composerMode}
              onModeChange={setComposerMode}
              value={
                composerMode === "reply"
                  ? actions.replyContent
                  : actions.quoteContent
              }
              onValueChange={(value) => {
                if (composerMode === "reply") actions.setReplyContent(value);
                else actions.setQuoteContent(value);
              }}
              isSubmitting={actions.isReplying || actions.isQuoting}
              userTimezone={userTimezone}
              trayRef={trayRef}
              onPostNow={() => {
                void (async () => {
                  if (composerMode === "reply") {
                    await actions.handleReply();
                  } else {
                    await actions.handleQuote();
                  }
                  if (onMarkDone && notification.eventId) {
                    await onMarkDone(notification.eventId, true, "REPLIED");
                  }
                })();
              }}
              onSaveDraft={() => {
                const actionType = composerMode === "reply" ? "reply" : "quote";
                const content =
                  composerMode === "reply"
                    ? actions.replyContent
                    : actions.quoteContent;
                void actions.deferAction({
                  actionType,
                  mode: "draft",
                  content,
                });
              }}
              onSchedule={(scheduledForIso) => {
                const actionType = composerMode === "reply" ? "reply" : "quote";
                const content =
                  composerMode === "reply"
                    ? actions.replyContent
                    : actions.quoteContent;
                void actions.deferAction({
                  actionType,
                  mode: "schedule",
                  content,
                  scheduledFor: scheduledForIso,
                });
              }}
              onCancel={() => {
                actions.setShowReplyInput(false);
                actions.setReplyContent("");
                actions.setQuoteContent("");
              }}
              templates={replyTemplates}
            />
          ) : null}

          {showRepostPanel ? (
            <RepostEngagementTray
              userTimezone={userTimezone}
              isSubmitting={actions.isReposting}
              trayRef={trayRef}
              onRepostNow={() => {
                void actions.handleRepost();
                setShowRepostPanel(false);
              }}
              onScheduleRepost={(scheduledForIso) => {
                void actions.deferAction({
                  actionType: "repost",
                  mode: "schedule",
                  content: "",
                  scheduledFor: scheduledForIso,
                });
                setShowRepostPanel(false);
              }}
              onCancel={() => setShowRepostPanel(false)}
            />
          ) : null}

          {actions.showChildReplies ? (
            <ChildRepliesPanel
              isLoading={actions.isLoadingReplies}
              replies={actions.childReplies}
              metadata={actions.childMetadata}
            />
          ) : null}

          {actions.toast ? (
            <div
              className={`mt-2 rounded-md border px-2 py-1.5 text-xs ${
                actions.toast.type === "success"
                  ? "border-success/30 bg-success/10 text-success"
                  : "border-destructive/30 bg-destructive/10 text-destructive"
              }`}
            >
              {actions.toast.message}
            </div>
          ) : null}
        </div>
      </div>

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
