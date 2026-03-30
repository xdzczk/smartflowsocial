/**
 * Bulk actions for short-form drafts (shown only when selection is non-empty).
 */

import { useFetcher } from "@remix-run/react";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { Button } from "~/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { PublishingBatchSelectionBar } from "~/features/posts/components/publishing-suite";
import { draftsKeys } from "~/features/posts/hooks/useDraftsQuery";
import type { QueueType } from "~/features/posts/types";
import type { DraftsStatePost } from "~/lib/validation/drafts-post-conversion";

interface DraftsBulkActionsProps {
  selectedCount: number;
  onClearSelection: () => void;
  queueTypes: QueueType[];
  selectedPostIds: string[];
  filteredPosts: DraftsStatePost[];
  onBulkReviewSchedule: () => void;
  onBulkDelete: () => void;
  isDeleting: boolean;
  isResuming: boolean;
}

export function DraftsBulkActions({
  selectedCount,
  onClearSelection,
  queueTypes,
  selectedPostIds,
  filteredPosts,
  onBulkReviewSchedule,
  onBulkDelete,
  isDeleting,
  isResuming,
}: DraftsBulkActionsProps) {
  const [queueTarget, setQueueTarget] = useState("unassigned");
  const assignFetcher = useFetcher<{ success?: boolean; error?: string }>();
  const dupFetcher = useFetcher<{
    success?: boolean;
    newPostIds?: string[];
    error?: string;
  }>();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (
      assignFetcher.state === "idle" &&
      assignFetcher.data &&
      "success" in assignFetcher.data &&
      assignFetcher.data.success
    ) {
      void queryClient.invalidateQueries({ queryKey: draftsKeys.all });
    }
  }, [assignFetcher.state, assignFetcher.data, queryClient]);

  useEffect(() => {
    if (
      dupFetcher.state === "idle" &&
      dupFetcher.data &&
      "success" in dupFetcher.data &&
      dupFetcher.data.success
    ) {
      void queryClient.invalidateQueries({ queryKey: draftsKeys.all });
    }
  }, [dupFetcher.state, dupFetcher.data, queryClient]);

  if (selectedCount === 0) return null;

  const bulkPostIds = selectedPostIds.filter((id) =>
    filteredPosts.some((p) => p.id === id)
  );
  const canBulkQueue =
    bulkPostIds.length === selectedCount && selectedCount > 0;

  const handleAssignQueue = () => {
    if (!canBulkQueue || bulkPostIds.length === 0) return;
    const fd = new FormData();
    fd.set("_action", "bulkAssignQueue");
    fd.set("postIds", JSON.stringify(bulkPostIds));
    fd.set("queueType", queueTarget);
    assignFetcher.submit(fd, { method: "post", action: "/dashboard/drafts" });
  };

  const handleBulkDuplicate = () => {
    if (!canBulkQueue || bulkPostIds.length === 0) return;
    const fd = new FormData();
    fd.set("_action", "bulkDuplicateDrafts");
    fd.set("postIds", JSON.stringify(bulkPostIds));
    dupFetcher.submit(fd, { method: "post", action: "/dashboard/drafts" });
  };

  return (
    <PublishingBatchSelectionBar
      selectedCount={selectedCount}
      onClearSelection={onClearSelection}
    >
      <div className="flex flex-wrap items-center gap-2">
        <Select value={queueTarget} onValueChange={setQueueTarget}>
          <SelectTrigger
            className="border-border h-9 w-[10.5rem]"
            aria-label="Queue for bulk assign"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="unassigned">No queue</SelectItem>
            {queueTypes
              .filter((qt) => qt.name !== "Unassigned")
              .map((qt) => (
                <SelectItem key={qt.id} value={qt.name}>
                  {qt.name}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
        <Button
          type="button"
          variant="outline"
          size="default"
          onClick={() => handleAssignQueue()}
          disabled={
            !canBulkQueue ||
            assignFetcher.state !== "idle" ||
            isDeleting ||
            isResuming
          }
        >
          {assignFetcher.state !== "idle" ? "Updating…" : "Move to queue"}
        </Button>
      </div>
      <Button
        type="button"
        variant="outline"
        size="default"
        onClick={handleBulkDuplicate}
        disabled={
          !canBulkQueue ||
          dupFetcher.state !== "idle" ||
          isDeleting ||
          isResuming
        }
      >
        {dupFetcher.state !== "idle" ? "Duplicating…" : "Duplicate"}
      </Button>
      <Button
        type="button"
        variant="outline"
        size="default"
        onClick={onBulkReviewSchedule}
        disabled={isResuming}
      >
        Review &amp; schedule
      </Button>
      <Button
        type="button"
        variant="outline"
        size="default"
        onClick={onBulkDelete}
        disabled={isDeleting}
        className="border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
      >
        {isDeleting ? "Deleting..." : "Delete"}
      </Button>
    </PublishingBatchSelectionBar>
  );
}
