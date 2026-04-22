import { type ReactNode, forwardRef } from "react";

import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";

import { PUBLISHING_BATCH_SELECTION_BAR_CLASS } from "./constants";

export interface PublishingBatchSelectionBarProps {
  selectedCount: number;
  onClearSelection: () => void;
  /** Primary actions (right zone); use flex-wrap for responsiveness. */
  children: ReactNode;
  className?: string;
}

/**
 * Contextual batch selection surface between filters and the list/table.
 * Renders nothing when `selectedCount === 0` (no reserved space).
 */
export const PublishingBatchSelectionBar = forwardRef<
  HTMLDivElement,
  PublishingBatchSelectionBarProps
>(function PublishingBatchSelectionBar(
  { selectedCount, onClearSelection, children, className },
  ref
) {
  if (selectedCount === 0) return null;

  const summary = `${selectedCount} selected`;

  return (
    <div
      ref={ref}
      className={cn(PUBLISHING_BATCH_SELECTION_BAR_CLASS, className)}
      role="region"
      aria-label="Bulk selection"
    >
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1">
        <span className="text-text text-sm font-medium tabular-nums">
          {summary}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-text-secondary hover:text-text h-8 px-2"
          onClick={onClearSelection}
        >
          Clear
        </Button>
      </div>
      <div className="flex min-w-0 flex-shrink-0 flex-wrap items-center justify-end gap-2 sm:pl-4">
        {children}
      </div>
    </div>
  );
});
