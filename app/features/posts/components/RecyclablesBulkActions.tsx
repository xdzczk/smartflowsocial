import type { useFetcher } from "@remix-run/react";
import { Quote, Repeat, Share2 } from "lucide-react";

import {
  INLINE_ICON_SIZE_CLASS,
  INLINE_ICON_STROKE,
} from "~/lib/icon-constants";

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
          <Repeat
            className={INLINE_ICON_SIZE_CLASS}
            strokeWidth={INLINE_ICON_STROKE}
            aria-hidden
          />
          {repostFetcher.state !== "idle"
            ? PROCESSING_TEXT
            : `Recycle ${selectedCount} Post${selectedCount !== 1 ? "s" : ""}`}
        </button>
        <button
          onClick={onBulkScheduledRepost}
          disabled={repostFetcher.state !== "idle"}
          className="dark:bg-card border-border text-foreground hover:border-border hover:bg-muted focus:ring-ring active:border-border inline-flex items-center justify-center gap-2 rounded-lg border bg-white px-3 py-2 text-sm leading-5 font-semibold hover:shadow-sm focus:ring active:shadow-none disabled:opacity-50"
        >
          <Share2
            className={INLINE_ICON_SIZE_CLASS}
            strokeWidth={INLINE_ICON_STROKE}
            aria-hidden
          />
          {repostFetcher.state !== "idle"
            ? PROCESSING_TEXT
            : `Repost ${selectedCount} Post${selectedCount !== 1 ? "s" : ""}`}
        </button>
        <button
          onClick={onBulkQuote}
          disabled={repostFetcher.state !== "idle"}
          className="dark:bg-card border-success text-success hover:border-success hover:text-success focus:ring-ring/25 active:border-success dark:border-success dark:text-success dark:hover:border-success dark:hover:text-success dark:focus:ring-ring/40 dark:active:border-success inline-flex items-center justify-center gap-2 rounded-lg border bg-white px-3 py-2 text-sm leading-5 font-semibold hover:shadow-sm focus:ring active:shadow-none disabled:opacity-50"
        >
          <Quote
            className={INLINE_ICON_SIZE_CLASS}
            strokeWidth={INLINE_ICON_STROKE}
            aria-hidden
          />
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
