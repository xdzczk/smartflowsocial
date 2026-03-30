/**
 * Bulk actions for short-form drafts (shown only when selection is non-empty).
 */

import { useFetcher } from "@remix-run/react";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { draftsKeys } from "~/features/posts/hooks/useDraftsQuery";
import type { QueueType } from "~/features/posts/types";
import type { DraftsStatePost } from "~/lib/validation/drafts-post-conversion";

interface DraftsBulkActionsProps {
  selectedCount: number;
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
    <div className="border-border bg-muted mb-4 flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between">
      <span className="text-foreground text-sm font-medium">
        {selectedCount} draft{selectedCount !== 1 ? "s" : ""} selected
      </span>
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Select value={queueTarget} onValueChange={setQueueTarget}>
            <SelectTrigger
              className="h-9 w-[10.5rem]"
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
          <button
            type="button"
            onClick={() => handleAssignQueue()}
            disabled={
              !canBulkQueue ||
              assignFetcher.state !== "idle" ||
              isDeleting ||
              isResuming
            }
            className="border-border bg-card text-foreground hover:bg-muted inline-flex items-center justify-center rounded-lg border px-3 py-2 text-sm font-semibold disabled:opacity-50"
          >
            {assignFetcher.state !== "idle" ? "Updating…" : "Move to queue"}
          </button>
        </div>
        <button
          type="button"
          onClick={handleBulkDuplicate}
          disabled={
            !canBulkQueue ||
            dupFetcher.state !== "idle" ||
            isDeleting ||
            isResuming
          }
          className="border-border bg-card text-foreground hover:bg-muted inline-flex items-center justify-center rounded-lg border px-3 py-2 text-sm font-semibold disabled:opacity-50"
        >
          {dupFetcher.state !== "idle" ? "Duplicating…" : "Duplicate"}
        </button>
        <button
          type="button"
          onClick={onBulkReviewSchedule}
          disabled={isResuming}
          className="border-primary/30 bg-card text-primary hover:border-primary/50 hover:bg-primary/10 focus:ring-ring/25 active:border-primary/30 inline-flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm leading-5 font-semibold focus:ring active:shadow-none disabled:opacity-50"
        >
          Review &amp; schedule
        </button>
        <button
          type="button"
          onClick={onBulkDelete}
          disabled={isDeleting}
          className="border-destructive/30 bg-card text-destructive hover:border-destructive/50 hover:bg-destructive/10 focus:ring-ring/25 active:border-destructive/30 inline-flex items-center justify-center rounded-lg border px-3 py-2 text-sm leading-5 font-semibold focus:ring active:shadow-none disabled:opacity-50"
        >
          {isDeleting
            ? "Deleting..."
            : `Delete ${selectedCount} draft${selectedCount !== 1 ? "s" : ""}`}
        </button>
      </div>
    </div>
  );
}
