import { Link } from "@remix-run/react";

import { Button } from "~/components/ui/button";
import { PublishingBatchSelectionBar } from "~/features/posts/components/publishing-suite";

import type { LongFormListingType } from "../hooks/useLongFormListingState";

export interface LongFormBulkActionsBarProps {
  selectedCount: number;
  onClearSelection: () => void;
  onBulkDelete: () => void;
  deleteFetcherState: string;
  type: LongFormListingType;
}

export function LongFormBulkActionsBar({
  selectedCount,
  onClearSelection,
  onBulkDelete,
  deleteFetcherState,
  type,
}: LongFormBulkActionsBarProps) {
  if (selectedCount === 0) return null;

  return (
    <PublishingBatchSelectionBar
      selectedCount={selectedCount}
      onClearSelection={onClearSelection}
    >
      {type === "draft" ? (
        <Button type="button" variant="outline" size="default" asChild>
          <Link to="/dashboard/compose?type=article">Create New</Link>
        </Button>
      ) : null}
      <Button
        type="button"
        variant="outline"
        size="default"
        onClick={onBulkDelete}
        disabled={deleteFetcherState !== "idle"}
        className="border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
      >
        {deleteFetcherState !== "idle" ? "Deleting..." : "Delete"}
      </Button>
    </PublishingBatchSelectionBar>
  );
}
