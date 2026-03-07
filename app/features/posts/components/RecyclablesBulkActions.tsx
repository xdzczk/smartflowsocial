import type { useFetcher } from "@remix-run/react";
import { Repeat } from "lucide-react";

import {
  INLINE_ICON_SIZE_CLASS,
  INLINE_ICON_STROKE,
} from "~/lib/icon-constants";

const PROCESSING_TEXT = "Processing...";

interface RecyclablesBulkActionsProps {
  selectedCount: number;
  onBulkRecycle: () => void;
  recycleFetcher: ReturnType<typeof useFetcher>;
}

/**
 * Bulk actions bar for recyclables posts. Only recycle is available when multiple posts are selected.
 */
export function RecyclablesBulkActions({
  selectedCount,
  onBulkRecycle,
  recycleFetcher,
}: RecyclablesBulkActionsProps) {
  if (selectedCount === 0) return null;

  return (
    <div className="border-border bg-muted dark:border-border dark:bg-muted/50 mb-4 flex items-center justify-between rounded-lg border p-4">
      <span className="text-foreground dark:text-foreground text-sm font-medium">
        {selectedCount} post{selectedCount !== 1 ? "s" : ""} selected
      </span>
      <div className="flex gap-2">
        <button
          onClick={onBulkRecycle}
          disabled={recycleFetcher.state !== "idle"}
          className="dark:bg-card border-border text-foreground hover:border-border hover:text-foreground focus:ring-ring/25 active:border-border dark:border-border dark:text-foreground dark:hover:border-border dark:hover:text-foreground dark:focus:ring-ring/40 dark:active:border-border inline-flex items-center justify-center gap-2 rounded-lg border bg-white px-3 py-2 text-sm leading-5 font-semibold hover:shadow-sm focus:ring active:shadow-none disabled:opacity-50"
        >
          <Repeat
            className={INLINE_ICON_SIZE_CLASS}
            strokeWidth={INLINE_ICON_STROKE}
            aria-hidden
          />
          {recycleFetcher.state !== "idle"
            ? PROCESSING_TEXT
            : `Recycle ${selectedCount} Post${selectedCount !== 1 ? "s" : ""}`}
        </button>
      </div>
    </div>
  );
}
