import type { useFetcher } from "@remix-run/react";
import { Repeat } from "lucide-react";

import { Button } from "~/components/ui/button";
import { PublishingBatchSelectionBar } from "~/features/posts/components/publishing-suite";
import {
  INLINE_ICON_SIZE_CLASS,
  INLINE_ICON_STROKE,
} from "~/lib/icon-constants";

const PROCESSING_TEXT = "Processing...";

interface RecyclablesBulkActionsProps {
  selectedCount: number;
  onClearSelection: () => void;
  onBulkRecycle: () => void;
  recycleFetcher: ReturnType<typeof useFetcher>;
}

/**
 * Bulk actions bar for recyclables posts. Only recycle is available when multiple posts are selected.
 */
export function RecyclablesBulkActions({
  selectedCount,
  onClearSelection,
  onBulkRecycle,
  recycleFetcher,
}: RecyclablesBulkActionsProps) {
  if (selectedCount === 0) return null;

  return (
    <PublishingBatchSelectionBar
      selectedCount={selectedCount}
      onClearSelection={onClearSelection}
    >
      <Button
        type="button"
        size="default"
        onClick={onBulkRecycle}
        disabled={recycleFetcher.state !== "idle"}
      >
        <Repeat
          className={INLINE_ICON_SIZE_CLASS}
          strokeWidth={INLINE_ICON_STROKE}
          aria-hidden
        />
        {recycleFetcher.state !== "idle" ? PROCESSING_TEXT : "Recycle"}
      </Button>
    </PublishingBatchSelectionBar>
  );
}
