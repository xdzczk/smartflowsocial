import { Link } from "@remix-run/react";
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
        <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
          <path
            fillRule="evenodd"
            d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z"
            clipRule="evenodd"
          />
        </svg>
        Like {stats?.likes ? `(${stats.likes})` : ""}
      </button>

      {/* Reply Button */}
      <button
        onClick={onToggleReply}
        className="text-muted-foreground hover:bg-primary/10 hover:text-primary inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium transition-colors"
      >
        <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
          <path d="M2 5a2 2 0 012-2h7a2 2 0 012 2v4a2 2 0 01-2 2H9l-3 3v-3H4a2 2 0 01-2-2V5z" />
          <path d="M15 7v2a4 4 0 01-4 4H9.828l-1.766 1.767c.28.149.599.233.938.233h2l3 3v-3h2a2 2 0 002-2V9a2 2 0 00-2-2h-1z" />
        </svg>
        Reply {stats?.replies ? `(${stats.replies})` : ""}
      </button>

      {/* Repost Button */}
      <button
        onClick={onRepost}
        disabled={isReposting}
        className="text-muted-foreground inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium transition-colors hover:bg-green-500/10 hover:text-green-600 disabled:opacity-50 dark:hover:text-green-400"
      >
        <svg
          className="h-4 w-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
          />
        </svg>
        {isReposting
          ? "Reposting..."
          : `Repost ${stats?.reposts ? `(${stats.reposts})` : ""}`}
      </button>

      {/* Quote Button */}
      <button
        onClick={onToggleQuote}
        className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-gray-600 transition-colors hover:bg-green-50 hover:text-green-600 dark:text-gray-400 dark:hover:bg-green-900/20 dark:hover:text-green-400"
      >
        <svg
          className="h-4 w-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z"
          />
        </svg>
        Quote
      </button>

      {/* Copy NEvent Button */}
      <button
        onClick={onCopyNevent}
        className="text-muted-foreground hover:bg-accent/10 hover:text-foreground inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium transition-colors"
      >
        <svg
          className="h-4 w-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
          />
        </svg>
        Copy NEvent
      </button>

      {/* View Replies Button */}
      {stats?.replies ? (
        <button
          onClick={onToggleChildReplies}
          className="text-muted-foreground hover:bg-accent/10 hover:text-accent-foreground inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium transition-colors"
        >
          <svg
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d={showChildReplies ? "M19 9l-7 7-7-7" : "M9 5l7 7-7 7"}
            />
          </svg>
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
