/**
 * Attachments strip for unified composer.
 * Shows thumbnails (image/video), filename for others; remove, reorder, optional alt.
 * Upload state: queued → uploading → done → failed (retry).
 */

import { ChevronDown, ChevronUp, Plus, X } from "lucide-react";

import { Button } from "~/components/ui/button";
import { INLINE_ICON_STROKE } from "~/lib/icon-constants";

import type { ComposerAttachment } from "../types";

interface AttachmentsStripProps {
  attachments: ComposerAttachment[];
  onRemove: (localId: string) => void;
  onAdd: () => void;
  disabled?: boolean;
  /** Optional: reorder (fromIndex, toIndex) - for drag reorder */
  onReorder?: (fromIndex: number, toIndex: number) => void;
}

export function AttachmentsStrip({
  attachments,
  onRemove,
  onAdd,
  disabled = false,
  onReorder,
}: AttachmentsStripProps) {
  return (
    <div className="border-border mt-2 flex flex-wrap items-center gap-2 rounded-md border p-2">
      {attachments.map((att, index) => (
        <div
          key={att.localId}
          className="border-border bg-muted/50 relative flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded border"
        >
          {att.status === "done" && att.url ? (
            <>
              {att.mime?.startsWith("image/") ? (
                <img
                  src={att.url}
                  alt={att.alt ?? ""}
                  className="h-full w-full object-cover"
                />
              ) : att.mime?.startsWith("video/") ? (
                <video
                  src={att.url}
                  className="h-full w-full object-cover"
                  muted
                  preload="metadata"
                />
              ) : (
                <span className="text-muted-foreground truncate px-1 text-xs">
                  {att.url.split("/").pop() ?? "File"}
                </span>
              )}
            </>
          ) : null}
          {att.status === "queued" || att.status === "uploading" ? (
            <span className="text-muted-foreground text-xs">
              {att.status === "uploading" ? "Uploading…" : "Queued"}
            </span>
          ) : null}
          {att.status === "failed" ? (
            <span className="text-destructive text-xs">Failed</span>
          ) : null}
          {onReorder && attachments.length > 1 ? (
            <div className="bg-background/80 absolute bottom-0 left-0 flex flex-col gap-0 p-0.5">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-5 w-5"
                aria-label="Move earlier"
                disabled={disabled || index === 0}
                onClick={() => onReorder(index, index - 1)}
              >
                <ChevronUp
                  className="h-3 w-3"
                  strokeWidth={INLINE_ICON_STROKE}
                />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-5 w-5"
                aria-label="Move later"
                disabled={disabled || index === attachments.length - 1}
                onClick={() => onReorder(index, index + 1)}
              >
                <ChevronDown
                  className="h-3 w-3"
                  strokeWidth={INLINE_ICON_STROKE}
                />
              </Button>
            </div>
          ) : null}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute top-0 right-0 h-6 w-6 rounded-full opacity-90"
            aria-label="Remove attachment"
            onClick={() => onRemove(att.localId)}
            disabled={disabled}
          >
            <span className="sr-only">Remove</span>
            <X
              className="h-3.5 w-3.5"
              strokeWidth={INLINE_ICON_STROKE}
              aria-hidden
            />
          </Button>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={onAdd}
        disabled={disabled}
        className="h-16 w-16 shrink-0"
        aria-label="Add attachment"
      >
        <Plus
          className="h-6 w-6"
          strokeWidth={INLINE_ICON_STROKE}
          aria-hidden
        />
      </Button>
    </div>
  );
}
