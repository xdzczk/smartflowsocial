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
  disabled = false,
  dropZoneLabel = "Drop zone for images and videos. Press Enter to add files.",
  emptyHint = "Drag files here or paste images",
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

  return (
    <div className={className}>
      <div
        role="button"
        tabIndex={-1}
        aria-label={dropZoneLabel}
        className="relative"
        onDragOver={onFilesDropped ? handleDragOver : undefined}
        onDragLeave={onFilesDropped ? handleDragLeave : undefined}
        onDrop={onFilesDropped ? handleDrop : undefined}
        onKeyDown={handleKeyDown}
      >
        {isDraggingOver ? (
          <div className="border-primary bg-primary/5 pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-lg border-2 border-dashed">
            <span className="text-muted-foreground text-sm">
              Drop to add images or videos
            </span>
          </div>
        ) : null}
        <AttachmentsStrip
          attachments={attachments}
          onRemove={onRemove}
          onAdd={onAdd}
          disabled={disabled}
        />
        {attachments.length === 0 && !isDraggingOver && emptyHint ? (
          <p className="text-muted-foreground mt-1 text-xs">{emptyHint}</p>
        ) : null}
      </div>
    </div>
  );
}
