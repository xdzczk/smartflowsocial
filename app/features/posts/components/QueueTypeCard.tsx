import type { FetcherWithComponents } from "@remix-run/react";
import { Edit, Trash2 } from "lucide-react";

import { Button } from "~/components/ui/button";
import { INLINE_ICON_SIZE_CLASS } from "~/lib/icon-constants";

import { getQueueAccentHex } from "../queue-colors";
import type { QueueType } from "../types";

import {
  getQueueMetadataChips,
  getQueuePrimaryScheduleLine,
} from "./queue-type-summary";

interface QueueTypeCardProps {
  queueType: QueueType & {
    hashTagPreset?: { id: string; name: string } | null;
  };
  globalScheduleIntervalHours: number[];
  onEdit: (queueType: QueueType) => void;
  isDeletingQueueType: boolean;
  deleteFetcher: FetcherWithComponents<{ success?: boolean; error?: string }>;
  onDeleteRequest?: (queueType: QueueType) => void;
}

export function QueueTypeCard({
  queueType,
  globalScheduleIntervalHours,
  onEdit,
  isDeletingQueueType,
  deleteFetcher,
  onDeleteRequest,
}: QueueTypeCardProps) {
  const handleDeleteClick = () => {
    if (onDeleteRequest) {
      onDeleteRequest(queueType);
      return;
    }
    const formData = new FormData();
    formData.set("_action", "delete_queue_type");
    formData.set("id", queueType.id);
    deleteFetcher.submit(formData, { method: "post" });
  };

  const primaryLine = getQueuePrimaryScheduleLine(
    queueType,
    globalScheduleIntervalHours
  );
  const chips = getQueueMetadataChips(queueType);

  return (
    <div className="border-border/80 hover:bg-surface-hover/40 stack-tight motion-fast rounded-lg border px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <div
          className="mt-1.5 h-3 w-3 shrink-0 rounded-full"
          style={{
            backgroundColor:
              queueType.colorToken != null && queueType.colorToken !== ""
                ? getQueueAccentHex(queueType.colorToken)
                : (queueType.color ?? "#6B7280"),
          }}
          aria-hidden
        />
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <h4 className="text-sm font-medium tracking-tight">
              {queueType.name}
            </h4>
          </div>
          <p className="text-text/90 text-sm leading-snug font-medium">
            {primaryLine}
          </p>
          {queueType.description ? (
            <p className="text-text-secondary line-clamp-2 text-xs leading-relaxed">
              {queueType.description}
            </p>
          ) : null}
          {chips.length > 0 ? (
            <div className="flex flex-wrap gap-1.5 pt-0.5">
              {chips.map((c) => (
                <span
                  key={c.key}
                  className="bg-surface-hover text-text-secondary inline-flex max-w-full truncate rounded-md px-2 py-0.5 text-[11px] leading-tight"
                >
                  {c.label}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      </div>
      <div className="flex shrink-0 items-center justify-end gap-1 sm:self-center">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-9 w-9"
          onClick={() => onEdit(queueType)}
          aria-label={`Edit ${queueType.name}`}
        >
          <Edit className={INLINE_ICON_SIZE_CLASS} />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="text-danger hover:bg-danger/10 hover:text-danger h-9 w-9"
          onClick={handleDeleteClick}
          disabled={isDeletingQueueType}
          aria-label={`Delete ${queueType.name}`}
        >
          <Trash2 className={INLINE_ICON_SIZE_CLASS} />
        </Button>
      </div>
    </div>
  );
}
