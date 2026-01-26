import type { PostFetcher } from "../types";

const PROCESSING_TEXT = "Processing...";

interface ContentBulkActionsProps {
  type: "scheduled" | "draft" | "posted";
  selectedCount: number;
  onBulkDelete: () => void;
  onBulkRepost?: () => void;
  onBulkScheduledRepost?: () => void;
  onBulkQuote?: () => void;
  bulkDeleteState: string;
  repostFetcher?: PostFetcher;
}

export function ContentBulkActions({
  type,
  selectedCount,
  onBulkDelete,
  onBulkRepost,
  onBulkScheduledRepost,
  onBulkQuote,
  bulkDeleteState,
  repostFetcher,
}: ContentBulkActionsProps) {
  if (selectedCount === 0) return null;

  return (
    <div className="border-border bg-muted mb-4 flex items-center justify-between rounded-lg border p-4">
      <span className="text-foreground text-sm font-medium">
        {selectedCount} item{selectedCount !== 1 ? "s" : ""} selected
      </span>
      <div className="flex gap-2">
        {type === "posted" ? (
          <>
            <button
              onClick={onBulkRepost}
              disabled={
                repostFetcher ? repostFetcher.state !== "idle" : undefined
              }
              className="border-primary/30 bg-card text-primary hover:border-primary/50 hover:bg-primary/10 focus:ring-primary/25 active:border-primary/30 inline-flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm leading-5 font-semibold focus:ring active:shadow-none disabled:opacity-50"
            >
              {repostFetcher && repostFetcher.state !== "idle"
                ? PROCESSING_TEXT
                : `Recycle ${selectedCount} Item${selectedCount !== 1 ? "s" : ""}`}
            </button>
            <button
              onClick={onBulkScheduledRepost}
              disabled={
                repostFetcher ? repostFetcher.state !== "idle" : undefined
              }
              className="border-border bg-card text-foreground hover:border-border hover:bg-muted focus:ring-ring active:border-border inline-flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm leading-5 font-semibold focus:ring active:shadow-none disabled:opacity-50"
            >
              {repostFetcher && repostFetcher.state !== "idle"
                ? PROCESSING_TEXT
                : `Repost ${selectedCount} Item${selectedCount !== 1 ? "s" : ""}`}
            </button>
            <button
              onClick={onBulkQuote}
              disabled={
                repostFetcher ? repostFetcher.state !== "idle" : undefined
              }
              className="bg-card border-success/30 text-success hover:border-success/50 hover:bg-success/10 focus:ring-success/25 active:border-success/30 dark:text-success inline-flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm leading-5 font-semibold focus:ring active:shadow-none disabled:opacity-50"
            >
              {repostFetcher && repostFetcher.state !== "idle"
                ? PROCESSING_TEXT
                : `Quote ${selectedCount} Item${selectedCount !== 1 ? "s" : ""}`}
            </button>
          </>
        ) : null}
        <button
          onClick={onBulkDelete}
          disabled={bulkDeleteState !== "idle"}
          className="border-destructive/30 bg-card text-destructive hover:border-destructive/50 hover:bg-destructive/10 focus:ring-destructive/25 active:border-destructive/30 inline-flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm leading-5 font-semibold focus:ring active:shadow-none disabled:opacity-50"
        >
          {bulkDeleteState !== "idle"
            ? "Deleting..."
            : `Delete ${selectedCount} item${selectedCount !== 1 ? "s" : ""}`}
        </button>
      </div>
    </div>
  );
}
