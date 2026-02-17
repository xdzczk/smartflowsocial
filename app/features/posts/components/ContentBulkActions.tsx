import type { PostFetcher } from "../types";

const PROCESSING_TEXT = "Processing...";

interface ContentBulkActionsProps {
  type: "scheduled" | "draft" | "published";
  selectedCount: number;
  onBulkDelete: () => void;
  onBulkRepost?: () => void;
  onBulkScheduledRepost?: () => void;
  onBulkQuote?: () => void;
  onBulkEditReschedule?: () => void;
  bulkDeleteState: string;
  repostFetcher?: PostFetcher;
}

function itemLabel(count: number, word: string): string {
  return `${count} ${word}${count !== 1 ? "s" : ""}`;
}

function isRepostFetcherBusy(fetcher: PostFetcher | undefined): boolean {
  return fetcher?.state !== "idle";
}

interface ScheduledActionsProps {
  selectedCount: number;
  onBulkEditReschedule?: () => void;
  onBulkScheduledRepost?: () => void;
  onBulkQuote?: () => void;
  repostFetcher?: PostFetcher;
}

function ScheduledActions({
  selectedCount,
  onBulkEditReschedule,
  onBulkScheduledRepost,
  onBulkQuote,
  repostFetcher,
}: ScheduledActionsProps) {
  const busy = isRepostFetcherBusy(repostFetcher);
  const disabled = repostFetcher ? busy : undefined;

  return (
    <>
      {onBulkEditReschedule ? (
        <button
          type="button"
          onClick={onBulkEditReschedule}
          className="border-border bg-card text-foreground hover:border-border hover:bg-muted focus:ring-ring active:border-border inline-flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm leading-5 font-semibold focus:ring active:shadow-none disabled:opacity-50"
        >
          Edit / Reschedule {itemLabel(selectedCount, "item")}
        </button>
      ) : null}
      {onBulkScheduledRepost ? (
        <button
          type="button"
          onClick={onBulkScheduledRepost}
          disabled={disabled}
          className="border-border bg-card text-foreground hover:border-border hover:bg-muted focus:ring-ring active:border-border inline-flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm leading-5 font-semibold focus:ring active:shadow-none disabled:opacity-50"
        >
          {busy
            ? PROCESSING_TEXT
            : `Repost ${itemLabel(selectedCount, "item")}`}
        </button>
      ) : null}
      {onBulkQuote ? (
        <button
          type="button"
          onClick={onBulkQuote}
          disabled={disabled}
          className="bg-card border-success/30 text-success hover:border-success/50 hover:bg-success/10 focus:ring-ring/25 active:border-success/30 dark:text-success inline-flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm leading-5 font-semibold focus:ring active:shadow-none disabled:opacity-50"
        >
          {busy ? PROCESSING_TEXT : `Quote ${itemLabel(selectedCount, "item")}`}
        </button>
      ) : null}
    </>
  );
}

interface PublishedActionsProps {
  selectedCount: number;
  onBulkRepost?: () => void;
  onBulkScheduledRepost?: () => void;
  onBulkQuote?: () => void;
  repostFetcher?: PostFetcher;
}

function PublishedActions({
  selectedCount,
  onBulkRepost,
  onBulkScheduledRepost,
  onBulkQuote,
  repostFetcher,
}: PublishedActionsProps) {
  const busy = isRepostFetcherBusy(repostFetcher);
  const disabled = repostFetcher ? busy : undefined;

  return (
    <>
      <button
        type="button"
        onClick={onBulkRepost}
        disabled={disabled}
        className="border-primary/30 bg-card text-primary hover:border-primary/50 hover:bg-primary/10 focus:ring-ring/25 active:border-primary/30 inline-flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm leading-5 font-semibold focus:ring active:shadow-none disabled:opacity-50"
      >
        {busy ? PROCESSING_TEXT : `Recycle ${itemLabel(selectedCount, "Item")}`}
      </button>
      <button
        type="button"
        onClick={onBulkScheduledRepost}
        disabled={disabled}
        className="border-border bg-card text-foreground hover:border-border hover:bg-muted focus:ring-ring active:border-border inline-flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm leading-5 font-semibold focus:ring active:shadow-none disabled:opacity-50"
      >
        {busy ? PROCESSING_TEXT : `Repost ${itemLabel(selectedCount, "Item")}`}
      </button>
      <button
        type="button"
        onClick={onBulkQuote}
        disabled={disabled}
        className="bg-card border-success/30 text-success hover:border-success/50 hover:bg-success/10 focus:ring-ring/25 active:border-success/30 dark:text-success inline-flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm leading-5 font-semibold focus:ring active:shadow-none disabled:opacity-50"
      >
        {busy ? PROCESSING_TEXT : `Quote ${itemLabel(selectedCount, "Item")}`}
      </button>
    </>
  );
}

export function ContentBulkActions({
  type,
  selectedCount,
  onBulkDelete,
  onBulkRepost,
  onBulkScheduledRepost,
  onBulkQuote,
  onBulkEditReschedule,
  bulkDeleteState,
  repostFetcher,
}: ContentBulkActionsProps) {
  if (selectedCount === 0) return null;

  return (
    <div className="border-border bg-muted mb-4 flex items-center justify-between rounded-lg border p-4">
      <span className="text-foreground text-sm font-medium">
        {itemLabel(selectedCount, "item")} selected
      </span>
      <div className="flex gap-2">
        {type === "scheduled" ? (
          <ScheduledActions
            selectedCount={selectedCount}
            onBulkEditReschedule={onBulkEditReschedule}
            onBulkScheduledRepost={onBulkScheduledRepost}
            onBulkQuote={onBulkQuote}
            repostFetcher={repostFetcher}
          />
        ) : null}
        {type === "published" ? (
          <PublishedActions
            selectedCount={selectedCount}
            onBulkRepost={onBulkRepost}
            onBulkScheduledRepost={onBulkScheduledRepost}
            onBulkQuote={onBulkQuote}
            repostFetcher={repostFetcher}
          />
        ) : null}
        <button
          type="button"
          onClick={onBulkDelete}
          disabled={bulkDeleteState !== "idle"}
          className="border-destructive/30 bg-card text-destructive hover:border-destructive/50 hover:bg-destructive/10 focus:ring-ring/25 active:border-destructive/30 inline-flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm leading-5 font-semibold focus:ring active:shadow-none disabled:opacity-50"
        >
          {bulkDeleteState !== "idle"
            ? "Deleting..."
            : `Delete ${itemLabel(selectedCount, "item")}`}
        </button>
      </div>
    </div>
  );
}
