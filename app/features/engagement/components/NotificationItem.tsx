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
  /** Clears global active row (e.g. cancel tray, success, toggle close). */
  onClearActive?: () => void;
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
  onClearActive,
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
    suppressSuccessToast: true,
  });

  const [rowSuccessLine, setRowSuccessLine] = useState<string | null>(null);
  const [likedOptimistic, setLikedOptimistic] = useState(false);
  const [repostedOptimistic, setRepostedOptimistic] = useState<
    "posted" | "scheduled" | null
  >(null);

  useEffect(() => {
    if (!rowSuccessLine) return;
    const t = window.setTimeout(() => setRowSuccessLine(null), 4500);
    return () => window.clearTimeout(t);
  }, [rowSuccessLine]);

  const isInteractionActive =
    isSelected && (actions.showReplyInput || showRepostPanel);

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

  const openComposer = (mode: EngagementComposerMode) => {
    if (
      isSelected &&
      actions.showReplyInput &&
      composerMode === mode &&
      !showRepostPanel
    ) {
      actions.setShowReplyInput(false);
      actions.setReplyContent("");
      actions.setQuoteContent("");
      onClearActive?.();
      return;
    }
    setShowRepostPanel(false);
    setComposerMode(mode);
    actions.setShowReplyInput(true);
    onSelect?.();
  };

  const openOrToggleRepostTray = () => {
    if (isSelected && showRepostPanel) {
      setShowRepostPanel(false);
      onClearActive?.();
      return;
    }
    actions.setShowReplyInput(false);
    setShowRepostPanel(true);
    onSelect?.();
  };

  const handlersRef = useRef({
    openReply: () => {
      openComposer("reply");
    },
    openQuote: () => {
      openComposer("quote");
    },
    openRepost: () => {
      openOrToggleRepostTray();
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
        openComposer("reply");
      },
      openQuote: () => {
        openComposer("quote");
      },
      openRepost: () => {
        openOrToggleRepostTray();
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
    // openComposer / openOrToggleRepostTray are stable enough; full deps would re-register every render
    // eslint-disable-next-line react-hooks/exhaustive-deps -- handlers mirror refs above
  }, [
    actions,
    composerMode,
    notification.eventId,
    onMarkDone,
    isSelected,
    actions.showReplyInput,
    showRepostPanel,
    onSelect,
    onClearActive,
  ]);

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

  const hasScheduledRepostLink = linkedActions.some(
    (a) => a.kind === "SCHEDULED_REPOST" || a.kind === "QUEUED_REPOST"
  );

  return (
    <div
      data-testid="engagement-item"
      className={`border-l-4 transition-colors ${
        contentVariant === "mention" ? "px-2.5 py-2 sm:px-3" : "p-2.5 sm:p-3"
      } ${
        isInteractionActive
          ? "border-primary bg-muted/50 ring-primary/10 ring-1 shadow-sm"
          : "hover:bg-muted/25 border-transparent"
      } ${dimmed ? "opacity-[0.88]" : ""} ${
        isKeyboardFocused ? "ring-primary/35 ring-2 ring-inset" : ""
      }`}
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
            isInteractionActive
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
            replyTrayOpen={Boolean(
              actions.showReplyInput && composerMode === "reply"
            )}
            quoteTrayOpen={Boolean(
              actions.showReplyInput && composerMode === "quote"
            )}
            repostTrayOpen={Boolean(showRepostPanel)}
            likeCompleted={likedOptimistic}
            repostScheduledHighlight={Boolean(
              !showRepostPanel &&
              repostedOptimistic !== "posted" &&
              (hasScheduledRepostLink || repostedOptimistic === "scheduled")
            )}
            repostPostedHighlight={Boolean(
              repostedOptimistic === "posted" && !showRepostPanel
            )}
            onLike={() => {
              void (async () => {
                const ok = await actions.handleLike();
                if (ok) setLikedOptimistic(true);
              })();
            }}
            onOpenReply={() => {
              openComposer("reply");
            }}
            onRepost={() => {
              openOrToggleRepostTray();
            }}
            onOpenQuote={() => {
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

          {rowSuccessLine ? (
            <p className="text-success mt-1.5 text-[11px] leading-snug">
              {rowSuccessLine}
            </p>
          ) : null}

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
                  const ok =
                    composerMode === "reply"
                      ? await actions.handleReply()
                      : await actions.handleQuote();
                  if (!ok) return;
                  if (onMarkDone && notification.eventId) {
                    await onMarkDone(notification.eventId, true, "REPLIED");
                  }
                  onClearActive?.();
                  setRowSuccessLine(
                    composerMode === "reply" ? "Reply posted" : "Quote posted"
                  );
                })();
              }}
              onSaveDraft={() => {
                void (async () => {
                  const actionType =
                    composerMode === "reply" ? "reply" : "quote";
                  const content =
                    composerMode === "reply"
                      ? actions.replyContent
                      : actions.quoteContent;
                  const ok = await actions.deferAction({
                    actionType,
                    mode: "draft",
                    content,
                  });
                  if (ok) setRowSuccessLine("Draft saved");
                })();
              }}
              onSchedule={(scheduledForIso) => {
                void (async () => {
                  const actionType =
                    composerMode === "reply" ? "reply" : "quote";
                  const content =
                    composerMode === "reply"
                      ? actions.replyContent
                      : actions.quoteContent;
                  const ok = await actions.deferAction({
                    actionType,
                    mode: "schedule",
                    content,
                    scheduledFor: scheduledForIso,
                  });
                  if (!ok) return;
                  actions.setShowReplyInput(false);
                  actions.setReplyContent("");
                  actions.setQuoteContent("");
                  onClearActive?.();
                  setRowSuccessLine(
                    composerMode === "reply"
                      ? "Reply scheduled"
                      : "Quote scheduled"
                  );
                })();
              }}
              onCancel={() => {
                actions.setShowReplyInput(false);
                actions.setReplyContent("");
                actions.setQuoteContent("");
                onClearActive?.();
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
                void (async () => {
                  const ok = await actions.handleRepost();
                  if (!ok) return;
                  setShowRepostPanel(false);
                  onClearActive?.();
                  setRepostedOptimistic("posted");
                  setRowSuccessLine("Reposted");
                })();
              }}
              onScheduleRepost={(scheduledForIso) => {
                void (async () => {
                  const ok = await actions.deferAction({
                    actionType: "repost",
                    mode: "schedule",
                    content: "",
                    scheduledFor: scheduledForIso,
                  });
                  if (!ok) return;
                  setShowRepostPanel(false);
                  onClearActive?.();
                  setRepostedOptimistic("scheduled");
                  setRowSuccessLine("Repost scheduled");
                })();
              }}
              onCancel={() => {
                setShowRepostPanel(false);
                onClearActive?.();
              }}
            />
          ) : null}

          {actions.showChildReplies ? (
            <ChildRepliesPanel
              isLoading={actions.isLoadingReplies}
              replies={actions.childReplies}
              metadata={actions.childMetadata}
            />
          ) : null}

          {actions.toast?.type === "error" ? (
            <div className="border-destructive/30 bg-destructive/10 text-destructive mt-2 rounded-md border px-2 py-1.5 text-xs">
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
