import { Button } from "~/components/ui/button";
import { PublishingBatchSelectionBar } from "~/features/posts/components/publishing-suite";

import type { PostFetcher } from "../types";

const PROCESSING_TEXT = "Processing...";

interface ContentBulkActionsProps {
  type: "scheduled" | "published";
  selectedCount: number;
  onClearSelection: () => void;
  onBulkDelete: () => void;
  onBulkRepost?: () => void;
  onBulkScheduledRepost?: () => void;
  onBulkQuote?: () => void;
  onBulkEditReschedule?: () => void;
  bulkDeleteState: string;
  repostFetcher?: PostFetcher;
}

function isRepostFetcherBusy(fetcher: PostFetcher | undefined): boolean {
  return fetcher?.state !== "idle";
}

interface ScheduledActionsProps {
  onBulkEditReschedule?: () => void;
  onBulkScheduledRepost?: () => void;
  onBulkQuote?: () => void;
  repostFetcher?: PostFetcher;
}

function ScheduledActions({
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
        <Button type="button" size="default" onClick={onBulkEditReschedule}>
          Edit / Reschedule
        </Button>
      ) : null}
      {onBulkScheduledRepost ? (
        <Button
          type="button"
          variant="outline"
          size="default"
          onClick={onBulkScheduledRepost}
          disabled={disabled}
        >
          {busy ? PROCESSING_TEXT : "Repost"}
        </Button>
      ) : null}
      {onBulkQuote ? (
        <Button
          type="button"
          variant="outline"
          size="default"
          onClick={onBulkQuote}
          disabled={disabled}
        >
          {busy ? PROCESSING_TEXT : "Quote"}
        </Button>
      ) : null}
    </>
  );
}

interface PublishedActionsProps {
  onBulkRepost?: () => void;
  onBulkScheduledRepost?: () => void;
  onBulkQuote?: () => void;
  repostFetcher?: PostFetcher;
}

function PublishedActions({
  onBulkRepost,
  onBulkScheduledRepost,
  onBulkQuote,
  repostFetcher,
}: PublishedActionsProps) {
  const busy = isRepostFetcherBusy(repostFetcher);
  const disabled = repostFetcher ? busy : undefined;

  return (
    <>
      <Button
        type="button"
        size="default"
        onClick={onBulkRepost}
        disabled={disabled}
      >
        {busy ? PROCESSING_TEXT : "Recycle"}
      </Button>
      <Button
        type="button"
        variant="outline"
        size="default"
        onClick={onBulkScheduledRepost}
        disabled={disabled}
      >
        {busy ? PROCESSING_TEXT : "Repost"}
      </Button>
      <Button
        type="button"
        variant="outline"
        size="default"
        onClick={onBulkQuote}
        disabled={disabled}
      >
        {busy ? PROCESSING_TEXT : "Quote"}
      </Button>
    </>
  );
}

export function ContentBulkActions({
  type,
  selectedCount,
  onClearSelection,
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
    <PublishingBatchSelectionBar
      selectedCount={selectedCount}
      onClearSelection={onClearSelection}
    >
      {type === "scheduled" ? (
        <ScheduledActions
          onBulkEditReschedule={onBulkEditReschedule}
          onBulkScheduledRepost={onBulkScheduledRepost}
          onBulkQuote={onBulkQuote}
          repostFetcher={repostFetcher}
        />
      ) : null}
      {type === "published" ? (
        <PublishedActions
          onBulkRepost={onBulkRepost}
          onBulkScheduledRepost={onBulkScheduledRepost}
          onBulkQuote={onBulkQuote}
          repostFetcher={repostFetcher}
        />
      ) : null}
      <Button
        type="button"
        variant="outline"
        size="default"
        onClick={onBulkDelete}
        disabled={bulkDeleteState !== "idle"}
        className="border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
      >
        {bulkDeleteState !== "idle" ? "Deleting..." : "Delete"}
      </Button>
    </PublishingBatchSelectionBar>
  );
}
