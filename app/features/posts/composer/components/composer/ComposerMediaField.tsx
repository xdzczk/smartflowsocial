/**
 * Media section: compact add + strip; dashed affordance only on drag-over.
 */

import React, { useState } from "react";

import { AttachmentsStrip } from "~/features/posts/components/AttachmentsStrip";
import type { ComposerAttachment } from "~/features/posts/types";
import { cn } from "~/lib/utils";

export interface ComposerMediaFieldProps {
  attachments: ComposerAttachment[];
  onRemove: (localId: string) => void;
  onAdd: () => void;
  onFilesDropped?: (files: File[]) => void;
  onReorder?: (fromIndex: number, toIndex: number) => void;
  disabled?: boolean;
  dropZoneLabel?: string;
  emptyHint?: string;
  className?: string;
  /** Callout when Blossom uploads have no usable signer (no Settings signer and no NIP-07 `window.nostr`). */
  signerConnectionNote?: React.ReactNode;
  /** Tooltip on failed attachment tiles */
  attachmentFailedTitle?: string;
}

export function ComposerMediaField({
  attachments,
  onRemove,
  onAdd,
  onFilesDropped,
  onReorder,
  disabled = false,
  dropZoneLabel = "Drop zone for images and videos. Press Enter to add files.",
  emptyHint = "Drag, paste, or click to add media",
  className = "",
  signerConnectionNote,
  attachmentFailedTitle,
}: ComposerMediaFieldProps) {
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    const related = e.relatedTarget;
    if (related == null || !e.currentTarget.contains(related as Node)) {
      setIsDraggingOver(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(false);
    if (onFilesDropped) {
      const files = Array.from(e.dataTransfer.files);
      if (files.length > 0) onFilesDropped(files);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest("textarea") || target.closest("input")) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onAdd();
    }
  };

  const empty = attachments.length === 0;

  return (
    <div className={className}>
      <h3 className="text-foreground mb-2 text-xs font-semibold tracking-wide uppercase">
        Media
      </h3>
      {signerConnectionNote ? (
        <div className="mb-2" role="note">
          {signerConnectionNote}
        </div>
      ) : null}
      <div
        role="button"
        tabIndex={-1}
        aria-label={dropZoneLabel}
        className={cn(
          "relative rounded-lg transition-colors",
          empty && !isDraggingOver && "min-h-0",
          !empty && "bg-muted/15 -mx-1 rounded-md px-1 py-1.5 sm:px-1.5",
          isDraggingOver &&
            onFilesDropped &&
            "bg-primary/5 ring-primary/40 ring-dashed ring-2"
        )}
        onDragOver={onFilesDropped ? handleDragOver : undefined}
        onDragLeave={onFilesDropped ? handleDragLeave : undefined}
        onDrop={onFilesDropped ? handleDrop : undefined}
        onKeyDown={handleKeyDown}
      >
        {isDraggingOver && onFilesDropped ? (
          <div className="border-primary bg-primary/5 pointer-events-none absolute inset-0 z-10 flex min-h-[3.5rem] items-center justify-center rounded-md border-2 border-dashed">
            <span className="text-muted-foreground text-sm">
              Drop to add images or videos
            </span>
          </div>
        ) : null}
        <AttachmentsStrip
          variant="inline"
          attachments={attachments}
          onRemove={onRemove}
          onAdd={onAdd}
          onReorder={onReorder}
          disabled={disabled}
          failedStatusTitle={attachmentFailedTitle}
        />
        {empty && !isDraggingOver && emptyHint ? (
          <p className="text-muted-foreground mt-1.5 text-[11px] leading-snug sm:mt-2">
            {emptyHint}
          </p>
        ) : null}
      </div>
    </div>
  );
}
