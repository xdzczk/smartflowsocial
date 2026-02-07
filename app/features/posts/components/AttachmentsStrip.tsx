/**
 * Attachments strip for unified composer.
 * Shows thumbnails (image/video), filename for others; remove, reorder, optional alt.
 * Upload state: queued → uploading → done → failed (retry).
 */

import { Button } from "~/components/ui/button";

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
}: AttachmentsStripProps) {
  return (
    <div className="border-border mt-2 flex flex-wrap items-center gap-2 rounded-md border p-2">
      {attachments.map((att) => (
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
            <svg
              className="h-3.5 w-3.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
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
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-6 w-6"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 4v16m8-8H4"
          />
        </svg>
      </Button>
    </div>
  );
}
