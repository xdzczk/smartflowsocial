import { Link } from "@remix-run/react";

import type { LongFormListingType } from "../hooks/useLongFormListingState";

export interface LongFormBulkActionsBarProps {
  selectedCount: number;
  onBulkDelete: () => void;
  onCreateNew?: () => void;
  deleteFetcherState: string;
  type: LongFormListingType;
}

export function LongFormBulkActionsBar({
  selectedCount,
  onBulkDelete,
  deleteFetcherState,
  type,
}: LongFormBulkActionsBarProps) {
  if (selectedCount === 0) return null;

  return (
    <div className="border-border bg-muted dark:border-border dark:bg-muted/50 mb-4 flex items-center justify-between rounded-lg border p-4">
      <span className="text-foreground dark:text-foreground text-sm font-medium">
        {selectedCount} post{selectedCount !== 1 ? "s" : ""} selected
      </span>
      <div className="flex gap-2">
        {type === "draft" ? (
          <Link
            to="/dashboard/compose/article"
            className="dark:bg-card border-border text-foreground hover:border-border hover:text-foreground focus:ring-ring/25 active:border-border dark:border-border dark:text-foreground dark:hover:border-border dark:hover:text-foreground dark:focus:ring-ring/40 dark:active:border-border inline-flex items-center justify-center gap-2 rounded-lg border bg-white px-3 py-2 text-sm leading-5 font-semibold hover:shadow-sm focus:ring active:shadow-none"
          >
            Create New
          </Link>
        ) : null}
        <button
          type="button"
          onClick={onBulkDelete}
          disabled={deleteFetcherState !== "idle"}
          className="dark:bg-card border-destructive text-destructive hover:border-destructive hover:text-destructive focus:ring-ring/25 active:border-destructive dark:border-destructive dark:text-destructive dark:hover:border-destructive dark:hover:text-destructive dark:focus:ring-ring/40 dark:active:border-destructive inline-flex items-center justify-center gap-2 rounded-lg border bg-white px-3 py-2 text-sm leading-5 font-semibold hover:shadow-sm focus:ring active:shadow-none disabled:opacity-50"
        >
          {deleteFetcherState !== "idle"
            ? "Deleting..."
            : `Delete ${selectedCount} post${selectedCount !== 1 ? "s" : ""}`}
        </button>
      </div>
    </div>
  );
}
