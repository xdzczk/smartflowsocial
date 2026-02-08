import { Link } from "@remix-run/react";
import {
  ChevronDown,
  ChevronUp,
  Copy,
  Heart,
  MessageCircle,
  Quote,
  Repeat,
} from "lucide-react";

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
  onToggleReply: () => void;
  onRepost: () => void;
  onToggleQuote: () => void;
  onCopyNevent: () => void;
  onToggleChildReplies: () => void;
}

export function NotificationActionButtons({
  eventId,
  stats,
  isReposting,
  showChildReplies,
  onLike,
  onToggleReply,
  onRepost,
  onToggleQuote,
  onCopyNevent,
  onToggleChildReplies,
}: NotificationActionButtonsProps) {
  return (
    <div className="mb-2 flex flex-wrap items-center gap-2">
      {/* Like Button */}
      <button
        onClick={onLike}
        className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium transition-colors"
      >
        <Heart
          className={INLINE_ICON_SIZE_CLASS}
          strokeWidth={INLINE_ICON_STROKE}
          aria-hidden
        />
        Like {stats?.likes ? `(${stats.likes})` : ""}
      </button>

      {/* Reply Button */}
      <button
        onClick={onToggleReply}
        className="text-muted-foreground hover:bg-muted hover:text-foreground inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium transition-colors"
      >
        <MessageCircle
          className={INLINE_ICON_SIZE_CLASS}
          strokeWidth={INLINE_ICON_STROKE}
          aria-hidden
        />
        Reply {stats?.replies ? `(${stats.replies})` : ""}
      </button>

      {/* Repost Button */}
      <button
        onClick={onRepost}
        disabled={isReposting}
        className="text-muted-foreground hover:bg-success/10 hover:text-success dark:hover:text-success inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium transition-colors disabled:opacity-50"
      >
        <Repeat
          className={INLINE_ICON_SIZE_CLASS}
          strokeWidth={INLINE_ICON_STROKE}
          aria-hidden
        />
        {isReposting
          ? "Reposting..."
          : `Repost ${stats?.reposts ? `(${stats.reposts})` : ""}`}
      </button>

      {/* Quote Button */}
      <button
        onClick={onToggleQuote}
        className="dark:text-muted-foreground text-foreground hover:bg-success/10 hover:text-success dark:hover:bg-success/20 dark:hover:text-success inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium transition-colors"
      >
        <Quote
          className={INLINE_ICON_SIZE_CLASS}
          strokeWidth={INLINE_ICON_STROKE}
          aria-hidden
        />
        Quote
      </button>

      {/* Copy NEvent Button */}
      <button
        onClick={onCopyNevent}
        className="text-muted-foreground hover:bg-muted hover:text-foreground inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium transition-colors"
      >
        <Copy
          className={INLINE_ICON_SIZE_CLASS}
          strokeWidth={INLINE_ICON_STROKE}
          aria-hidden
        />
        Copy NEvent
      </button>

      {/* View Replies Button */}
      {stats?.replies ? (
        <button
          onClick={onToggleChildReplies}
          className="text-muted-foreground hover:bg-muted hover:text-foreground inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium transition-colors"
        >
          {showChildReplies ? (
            <ChevronUp
              className={INLINE_ICON_SIZE_CLASS}
              strokeWidth={INLINE_ICON_STROKE}
              aria-hidden
            />
          ) : (
            <ChevronDown
              className={INLINE_ICON_SIZE_CLASS}
              strokeWidth={INLINE_ICON_STROKE}
              aria-hidden
            />
          )}
          {showChildReplies ? "Hide" : "View"} Replies ({stats.replies})
        </button>
      ) : null}

      {/* View on Primal Link */}
      <Link
        to={`https://primal.net/e/${eventId}`}
        target="_blank"
        rel="noreferrer"
        className="text-primary ml-auto text-xs hover:underline"
      >
        View on Primal →
      </Link>
    </div>
  );
}
