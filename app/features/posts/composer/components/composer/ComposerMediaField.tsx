/**
 * Presentational media field: drop zone + AttachmentsStrip + hint.
 */

import React, { useState } from "react";

import { AttachmentsStrip } from "~/features/posts/components/AttachmentsStrip";
import type { ComposerAttachment } from "~/features/posts/types";

export interface ComposerMediaFieldProps {
  attachments: ComposerAttachment[];
  onRemove: (localId: string) => void;
  onAdd: () => void;
  onFilesDropped?: (files: File[]) => void;
  /** Reorder thumbnails (updates signing order when wired to content tokens) */
  onReorder?: (fromIndex: number, toIndex: number) => void;
  disabled?: boolean;
  /** Accessible label for the drop zone */
  dropZoneLabel?: string;
  /** Hint when no attachments */
  emptyHint?: string;
  className?: string;
}

export function ComposerMediaField({
  attachments,
  onRemove,
  onAdd,
  onFilesDropped,
  onReorder,
  disabled = false,
  dropZoneLabel = "Drop zone for images and videos. Press Enter to add files.",
  emptyHint = "Drag, paste from clipboard, or + to add",
  className = "",
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
      <h3 className="text-foreground mb-1 text-xs font-semibold tracking-wide uppercase">
        Media
      </h3>
      <div
        role="button"
        tabIndex={-1}
        aria-label={dropZoneLabel}
        className={`border-border bg-muted/5 relative rounded-lg p-2.5 ${
          empty
            ? "min-h-[4rem] border-2 border-dashed"
            : "min-h-0 border border-solid"
        }`}
        onDragOver={onFilesDropped ? handleDragOver : undefined}
        onDragLeave={onFilesDropped ? handleDragLeave : undefined}
        onDrop={onFilesDropped ? handleDrop : undefined}
        onKeyDown={handleKeyDown}
      >
        {isDraggingOver ? (
          <div className="border-primary bg-primary/5 pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-md border-2 border-dashed">
            <span className="text-muted-foreground text-sm">
              Drop to add images or videos
            </span>
          </div>
        ) : null}
        <AttachmentsStrip
          attachments={attachments}
          onRemove={onRemove}
          onAdd={onAdd}
          onReorder={onReorder}
          disabled={disabled}
        />
        {empty && !isDraggingOver && emptyHint ? (
          <p className="text-muted-foreground mt-1 text-center text-[11px] sm:text-left">
            {emptyHint}
          </p>
        ) : null}
      </div>
    </div>
  );
}
