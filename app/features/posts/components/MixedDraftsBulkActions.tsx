/**
 * Bulk bar for mixed post + longform draft selection (All tab).
 * Delete uses mixed action; queue assign / duplicate require post-only selection.
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
import type { CombinedContent, QueueType } from "~/features/posts/types";

interface MixedDraftsBulkActionsProps {
  selectedDrafts: CombinedContent[];
  queueTypes: QueueType[];
  onClearSelection: () => void;
  onBulkDelete: () => void;
  bulkDeleteState: string;
}

export function MixedDraftsBulkActions({
  selectedDrafts,
  queueTypes,
  onClearSelection,
  onBulkDelete,
  bulkDeleteState,
}: MixedDraftsBulkActionsProps) {
  const count = selectedDrafts.length;
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

  if (count === 0) return null;

  const postOnlyIds = selectedDrafts
    .filter((c) => c.type === "post")
    .map((c) => c.id);
  const canPostOnlyBulk =
    postOnlyIds.length === count && postOnlyIds.length > 0;

  const handleAssignQueue = () => {
    if (!canPostOnlyBulk || postOnlyIds.length === 0) return;
    const fd = new FormData();
    fd.set("_action", "bulkAssignQueue");
    fd.set("postIds", JSON.stringify(postOnlyIds));
    fd.set("queueType", queueTarget);
    assignFetcher.submit(fd, { method: "post", action: "/dashboard/drafts" });
  };

  const handleBulkDuplicate = () => {
    if (!canPostOnlyBulk || postOnlyIds.length === 0) return;
    const fd = new FormData();
    fd.set("_action", "bulkDuplicateDrafts");
    fd.set("postIds", JSON.stringify(postOnlyIds));
    dupFetcher.submit(fd, { method: "post", action: "/dashboard/drafts" });
  };

  return (
    <PublishingBatchSelectionBar
      selectedCount={count}
      onClearSelection={onClearSelection}
    >
      <div className="flex flex-wrap items-center gap-2">
        <Select
          value={queueTarget}
          onValueChange={setQueueTarget}
          disabled={!canPostOnlyBulk}
        >
          <SelectTrigger
            className="border-border h-9 w-[10.5rem]"
            aria-label="Queue for bulk assign"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="unassigned">No queue</SelectItem>
            {queueTypes
              .filter((qt) => {
                const name = typeof qt === "string" ? qt : qt.name;
                return name !== "Unassigned";
              })
              .map((qt) => {
                const queueName = typeof qt === "string" ? qt : qt.name;
                const key =
                  typeof qt === "object" ? qt.id || queueName : queueName;
                return (
                  <SelectItem key={key} value={queueName}>
                    {queueName}
                  </SelectItem>
                );
              })}
          </SelectContent>
        </Select>
        <Button
          type="button"
          variant="outline"
          size="default"
          title={
            canPostOnlyBulk
              ? undefined
              : "Select only short-form post drafts to assign a queue"
          }
          onClick={() => handleAssignQueue()}
          disabled={
            !canPostOnlyBulk ||
            assignFetcher.state !== "idle" ||
            bulkDeleteState !== "idle"
          }
        >
          {assignFetcher.state !== "idle" ? "Updating…" : "Move to queue"}
        </Button>
      </div>
      <Button
        type="button"
        variant="outline"
        size="default"
        title={
          canPostOnlyBulk
            ? undefined
            : "Select only short-form post drafts to duplicate"
        }
        onClick={handleBulkDuplicate}
        disabled={
          !canPostOnlyBulk ||
          dupFetcher.state !== "idle" ||
          bulkDeleteState !== "idle"
        }
      >
        {dupFetcher.state !== "idle" ? "Duplicating…" : "Duplicate"}
      </Button>
      <Button
        type="button"
        variant="outline"
        size="default"
        onClick={onBulkDelete}
        disabled={bulkDeleteState !== "idle"}
        className="border-danger/40 text-danger hover:bg-danger/10 hover:text-danger"
      >
        {bulkDeleteState !== "idle" ? "Deleting..." : "Delete"}
      </Button>
    </PublishingBatchSelectionBar>
  );
}
