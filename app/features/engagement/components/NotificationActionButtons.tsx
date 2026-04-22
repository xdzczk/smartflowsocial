import { Link } from "@remix-run/react";
import {
  ChevronDown,
  ChevronUp,
  Copy,
  Heart,
  MessageCircle,
  MoreHorizontal,
  Quote,
  Repeat,
  Zap,
} from "lucide-react";

import { Button } from "~/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import {
  INLINE_ICON_SIZE_CLASS,
  INLINE_ICON_STROKE,
} from "~/lib/icon-constants";

export interface NotificationStats {
  likes?: number;
  replies?: number;
  reposts?: number;
  zaps?: number;
  satszapped?: number;
}

interface NotificationActionButtonsProps {
  eventId: string;
  stats?: NotificationStats;
  isReposting: boolean;
  showChildReplies: boolean;
  onLike: () => void;
  onOpenReply: () => void;
  onRepost: () => void;
  onOpenQuote: () => void;
  onCopyNevent: () => void;
  onToggleChildReplies: () => void;
  onMarkHandled?: () => void;
  onIgnore?: () => void;
  onSnooze?: () => void;
  zapNpub?: string;
  onZapClick?: (npub: string) => void;
  viewEventUrl?: string;
  viewEventLabel?: string;
  /** Open tray / editing (distinct from completed-state styling). */
  replyTrayOpen?: boolean;
  quoteTrayOpen?: boolean;
  repostTrayOpen?: boolean;
  likeCompleted?: boolean;
  zapCompleted?: boolean;
  /** Scheduled repost exists (linked action) or just queued. */
  repostScheduledHighlight?: boolean;
  /** User just reposted now (ephemeral or persisted). */
  repostPostedHighlight?: boolean;
}

const primaryActionClass =
  "text-text-secondary hover:text-text h-8 gap-1 px-2 text-xs font-medium";

const secondaryAckClass =
  "text-text-secondary/80 hover:text-text h-7 gap-0.5 px-1.5 text-[11px] font-normal";

const utilityLinkClass =
  "text-text-secondary/75 hover:text-text/90 text-[11px] leading-none";

export function NotificationActionButtons({
  eventId,
  stats,
  isReposting,
  showChildReplies,
  onLike,
  onOpenReply,
  onRepost,
  onOpenQuote,
  onCopyNevent,
  onToggleChildReplies,
  onMarkHandled,
  onIgnore,
  onSnooze,
  zapNpub,
  onZapClick,
  viewEventUrl,
  viewEventLabel = "View on Primal",
  replyTrayOpen = false,
  quoteTrayOpen = false,
  repostTrayOpen = false,
  likeCompleted = false,
  zapCompleted = false,
  repostScheduledHighlight = false,
  repostPostedHighlight = false,
}: NotificationActionButtonsProps) {
  const eventViewUrl = viewEventUrl ?? `https://primal.net/e/${eventId}`;

  const trayOpenClass =
    "bg-brand/10 text-brand border-brand/25 border shadow-1";

  return (
    <div className="mt-0.5 space-y-1">
      <div className="flex flex-wrap items-center gap-0.5">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={`${primaryActionClass} ${replyTrayOpen ? trayOpenClass : ""}`}
          onClick={(e) => {
            e.stopPropagation();
            onOpenReply();
          }}
        >
          <MessageCircle
            className={INLINE_ICON_SIZE_CLASS}
            strokeWidth={INLINE_ICON_STROKE}
            aria-hidden
          />
          Reply
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={`${primaryActionClass} ${quoteTrayOpen ? trayOpenClass : ""}`}
          onClick={(e) => {
            e.stopPropagation();
            onOpenQuote();
          }}
        >
          <Quote
            className={INLINE_ICON_SIZE_CLASS}
            strokeWidth={INLINE_ICON_STROKE}
            aria-hidden
          />
          Quote
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={`${primaryActionClass} ${
            repostTrayOpen
              ? trayOpenClass
              : repostPostedHighlight
                ? "text-brand border-brand/30 bg-brand/5 border"
                : repostScheduledHighlight
                  ? "text-brand/85 border-brand/35 border border-dashed"
                  : ""
          }`}
          disabled={isReposting}
          onClick={(e) => {
            e.stopPropagation();
            onRepost();
          }}
        >
          <Repeat
            className={`${INLINE_ICON_SIZE_CLASS} ${
              repostPostedHighlight && !repostTrayOpen ? "fill-primary/35" : ""
            }`}
            strokeWidth={INLINE_ICON_STROKE}
            aria-hidden
          />
          {isReposting ? "…" : "Repost"}
        </Button>
        {onMarkHandled ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className={primaryActionClass}
            onClick={(e) => {
              e.stopPropagation();
              onMarkHandled();
            }}
          >
            Handled
          </Button>
        ) : null}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="text-text-secondary hover:text-text h-8 w-8 shrink-0"
              aria-label="More actions"
              onClick={(e) => e.stopPropagation()}
            >
              <MoreHorizontal className="h-4 w-4" aria-hidden />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
            <DropdownMenuItem
              onSelect={() => {
                onCopyNevent();
              }}
            >
              <Copy
                className="mr-2 h-3.5 w-3.5"
                strokeWidth={INLINE_ICON_STROKE}
                aria-hidden
              />
              Copy NEvent
            </DropdownMenuItem>
            {onIgnore ? (
              <DropdownMenuItem
                onSelect={() => {
                  onIgnore();
                }}
              >
                Ignore
              </DropdownMenuItem>
            ) : null}
            {stats?.replies ? (
              <DropdownMenuItem
                onSelect={() => {
                  onToggleChildReplies();
                }}
              >
                {showChildReplies ? (
                  <ChevronUp
                    className="mr-2 h-3.5 w-3.5"
                    strokeWidth={INLINE_ICON_STROKE}
                    aria-hidden
                  />
                ) : (
                  <ChevronDown
                    className="mr-2 h-3.5 w-3.5"
                    strokeWidth={INLINE_ICON_STROKE}
                    aria-hidden
                  />
                )}
                {showChildReplies ? "Hide" : "View"} replies ({stats.replies})
              </DropdownMenuItem>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="flex flex-wrap items-center gap-1 pl-0.5">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={`${secondaryAckClass} ${
            likeCompleted ? "text-brand bg-brand/8 border-brand/20 border" : ""
          }`}
          aria-label="Like"
          onClick={(e) => {
            e.stopPropagation();
            onLike();
          }}
        >
          <Heart
            className={`h-3.5 w-3.5 ${likeCompleted ? "fill-primary/45" : ""}`}
            strokeWidth={INLINE_ICON_STROKE}
            aria-hidden
          />
          Like
          {stats?.likes != null && stats.likes > 0 ? (
            <span className="text-text-secondary/70 tabular-nums">
              {stats.likes}
            </span>
          ) : null}
        </Button>
        {zapNpub && onZapClick ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className={`${secondaryAckClass} ${
              zapCompleted ? "text-brand bg-brand/8 border-brand/20 border" : ""
            }`}
            aria-label="Zap"
            onClick={(e) => {
              e.stopPropagation();
              onZapClick(zapNpub);
            }}
          >
            <Zap
              className={`h-3.5 w-3.5 ${zapCompleted ? "fill-primary/45" : ""}`}
              strokeWidth={INLINE_ICON_STROKE}
              aria-hidden
            />
            Zap
          </Button>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 pl-0.5">
        {onSnooze ? (
          <button
            type="button"
            className={`${utilityLinkClass} hover:underline`}
            onClick={(e) => {
              e.stopPropagation();
              onSnooze();
            }}
          >
            Snooze →
          </button>
        ) : null}
        <Link
          to={eventViewUrl}
          target="_blank"
          rel="noreferrer"
          className={`${utilityLinkClass} inline-flex items-center gap-0.5 hover:underline`}
          onClick={(e) => e.stopPropagation()}
        >
          {viewEventLabel} →
        </Link>
      </div>
    </div>
  );
}
