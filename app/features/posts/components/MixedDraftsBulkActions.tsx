/**
 * Bulk bar for mixed post + longform draft selection (All tab).
 * Delete uses mixed action; queue assign / duplicate require post-only selection.
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
import type { CombinedContent, QueueType } from "~/features/posts/types";
import { cn } from "~/lib/utils";

interface MixedDraftsBulkActionsProps {
  selectedDrafts: CombinedContent[];
  queueTypes: QueueType[];
  onBulkDelete: () => void;
  bulkDeleteState: string;
}

export function MixedDraftsBulkActions({
  selectedDrafts,
  queueTypes,
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
    <div
      className={cn(
        "border-border bg-muted/80 supports-backdrop-filter:bg-muted/60 z-10 mb-4 flex flex-col gap-3 rounded-xl border p-4 backdrop-blur-sm",
        "sm:flex-row sm:items-center sm:justify-between"
      )}
    >
      <span className="text-foreground text-sm font-medium">
        {count} draft{count !== 1 ? "s" : ""} selected
      </span>
      <div className="flex flex-wrap items-center gap-2">
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
          <button
            type="button"
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
            className="border-border bg-background text-foreground hover:bg-muted inline-flex items-center justify-center rounded-lg border px-3 py-2 text-sm font-semibold disabled:opacity-50"
          >
            {assignFetcher.state !== "idle" ? "Updating…" : "Move to queue"}
          </button>
        </div>
        <button
          type="button"
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
          className="border-border bg-background text-foreground hover:bg-muted inline-flex items-center justify-center rounded-lg border px-3 py-2 text-sm font-semibold disabled:opacity-50"
        >
          {dupFetcher.state !== "idle" ? "Duplicating…" : "Duplicate"}
        </button>
        <button
          type="button"
          onClick={onBulkDelete}
          disabled={bulkDeleteState !== "idle"}
          className="border-destructive/30 bg-background text-destructive hover:border-destructive/50 hover:bg-destructive/10 focus:ring-ring/25 active:border-destructive/30 inline-flex items-center justify-center rounded-lg border px-3 py-2 text-sm font-semibold focus:ring active:shadow-none disabled:opacity-50"
        >
          {bulkDeleteState !== "idle"
            ? "Deleting..."
            : `Delete ${count} draft${count !== 1 ? "s" : ""}`}
        </button>
      </div>
    </div>
  );
}
