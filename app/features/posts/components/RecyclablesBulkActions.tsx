import type { useFetcher } from "@remix-run/react";

const PROCESSING_TEXT = "Processing...";

interface RecyclablesBulkActionsProps {
  selectedCount: number;
  onBulkRepost: () => void;
  onBulkScheduledRepost: () => void;
  onBulkQuote: () => void;
  onBulkDelete: () => void;
  repostFetcher: ReturnType<typeof useFetcher>;
  bulkDeleteFetcher: ReturnType<typeof useFetcher>;
}

/**
 * Bulk actions bar for recyclables posts
 */
export function RecyclablesBulkActions({
  selectedCount,
  onBulkRepost,
  onBulkScheduledRepost,
  onBulkQuote,
  onBulkDelete,
  repostFetcher,
  bulkDeleteFetcher,
}: RecyclablesBulkActionsProps) {
  if (selectedCount === 0) return null;

  return (
    <div className="border-border bg-muted dark:border-border dark:bg-muted/50 mb-4 flex items-center justify-between rounded-lg border p-4">
      <span className="text-foreground dark:text-foreground text-sm font-medium">
        {selectedCount} post{selectedCount !== 1 ? "s" : ""} selected
      </span>
      <div className="flex gap-2">
        <button
          onClick={onBulkRepost}
          disabled={repostFetcher.state !== "idle"}
          className="dark:bg-card border-border text-foreground hover:border-border hover:text-foreground focus:ring-ring/25 active:border-border dark:border-border dark:text-foreground dark:hover:border-border dark:hover:text-foreground dark:focus:ring-ring/40 dark:active:border-border inline-flex items-center justify-center gap-2 rounded-lg border bg-white px-3 py-2 text-sm leading-5 font-semibold hover:shadow-sm focus:ring active:shadow-none disabled:opacity-50"
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
          {repostFetcher.state !== "idle"
            ? PROCESSING_TEXT
            : `Recycle ${selectedCount} Post${selectedCount !== 1 ? "s" : ""}`}
        </button>
        <button
          onClick={onBulkScheduledRepost}
          disabled={repostFetcher.state !== "idle"}
          className="dark:bg-card border-border text-foreground hover:border-border hover:bg-muted focus:ring-ring active:border-border inline-flex items-center justify-center gap-2 rounded-lg border bg-white px-3 py-2 text-sm leading-5 font-semibold hover:shadow-sm focus:ring active:shadow-none disabled:opacity-50"
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
              d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
            />
          </svg>
          {repostFetcher.state !== "idle"
            ? PROCESSING_TEXT
            : `Repost ${selectedCount} Post${selectedCount !== 1 ? "s" : ""}`}
        </button>
        <button
          onClick={onBulkQuote}
          disabled={repostFetcher.state !== "idle"}
          className="dark:bg-card border-success text-success hover:border-success hover:text-success focus:ring-ring/25 active:border-success dark:border-success dark:text-success dark:hover:border-success dark:hover:text-success dark:focus:ring-ring/40 dark:active:border-success inline-flex items-center justify-center gap-2 rounded-lg border bg-white px-3 py-2 text-sm leading-5 font-semibold hover:shadow-sm focus:ring active:shadow-none disabled:opacity-50"
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
          {repostFetcher.state !== "idle"
            ? PROCESSING_TEXT
            : `Quote ${selectedCount} Post${selectedCount !== 1 ? "s" : ""}`}
        </button>
        <button
          onClick={onBulkDelete}
          disabled={bulkDeleteFetcher.state !== "idle"}
          className="dark:bg-card border-destructive text-destructive hover:border-destructive hover:text-destructive focus:ring-ring/25 active:border-destructive dark:border-destructive dark:text-destructive dark:hover:border-destructive dark:hover:text-destructive dark:focus:ring-ring/40 dark:active:border-destructive inline-flex items-center justify-center gap-2 rounded-lg border bg-white px-3 py-2 text-sm leading-5 font-semibold hover:shadow-sm focus:ring active:shadow-none disabled:opacity-50"
        >
          {bulkDeleteFetcher.state !== "idle"
            ? "Deleting..."
            : `Delete ${selectedCount} post${selectedCount !== 1 ? "s" : ""}`}
        </button>
      </div>
    </div>
  );
}
