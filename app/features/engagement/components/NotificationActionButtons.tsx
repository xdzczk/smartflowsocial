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
  DropdownMenuSeparator,
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
}

const actionBtnClass =
  "text-muted-foreground hover:text-foreground h-8 gap-1 px-2 text-xs";

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
}: NotificationActionButtonsProps) {
  const eventViewUrl = viewEventUrl ?? `https://primal.net/e/${eventId}`;

  return (
    <div className="mb-1 space-y-1.5">
      <div className="flex flex-wrap items-center gap-1">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={actionBtnClass}
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
          className={actionBtnClass}
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
          className={actionBtnClass}
          disabled={isReposting}
          onClick={(e) => {
            e.stopPropagation();
            onRepost();
          }}
        >
          <Repeat
            className={INLINE_ICON_SIZE_CLASS}
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
            className={actionBtnClass}
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
              className="text-muted-foreground hover:text-foreground h-8 w-8"
              aria-label="More actions"
              onClick={(e) => e.stopPropagation()}
            >
              <MoreHorizontal className="h-4 w-4" aria-hidden />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
            <DropdownMenuItem
              onSelect={() => {
                onLike();
              }}
            >
              <Heart
                className="mr-2 h-3.5 w-3.5"
                strokeWidth={INLINE_ICON_STROKE}
                aria-hidden
              />
              Like
              {stats?.likes != null && stats.likes > 0
                ? ` (${stats.likes})`
                : ""}
            </DropdownMenuItem>
            {zapNpub && onZapClick ? (
              <DropdownMenuItem
                onSelect={() => {
                  onZapClick(zapNpub);
                }}
              >
                <Zap
                  className="mr-2 h-3.5 w-3.5"
                  strokeWidth={INLINE_ICON_STROKE}
                  aria-hidden
                />
                Zap
              </DropdownMenuItem>
            ) : null}
            {(stats?.zaps && stats.zaps > 0) ||
            (stats?.satszapped && stats.satszapped > 0) ? (
              <div className="text-muted-foreground px-2 py-1.5 text-xs">
                {stats.satszapped
                  ? `${Number(stats.satszapped).toLocaleString()} sats on note`
                  : `${stats.zaps ?? 0} zap${(stats.zaps ?? 0) === 1 ? "" : "s"}`}
              </div>
            ) : null}
            <DropdownMenuSeparator />
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

      <div className="flex flex-wrap items-center gap-2">
        {onSnooze ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className={`${actionBtnClass} h-7`}
            onClick={(e) => {
              e.stopPropagation();
              onSnooze();
            }}
          >
            Snooze
          </Button>
        ) : null}
        <Link
          to={eventViewUrl}
          target="_blank"
          rel="noreferrer"
          className="text-muted-foreground hover:text-foreground text-xs"
          onClick={(e) => e.stopPropagation()}
        >
          {viewEventLabel} →
        </Link>
      </div>
    </div>
  );
}
