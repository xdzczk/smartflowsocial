/**
 * Media section: compact add + strip; dashed affordance only on drag-over.
 */

import React, { useState } from "react";

import { AttachmentsStrip } from "~/features/posts/components/AttachmentsStrip";
import type { ComposerAttachment } from "~/features/posts/types";
import { cn } from "~/lib/utils";

import { ComposerCanvasSectionLabel } from "./composer-canvas-primitives";

export interface ComposerMediaFieldProps {
  attachments: ComposerAttachment[];
  onRemove: (localId: string) => void;
  onRetry?: (localId: string) => void;
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
  /** Lighter, shorter affordance (campaign source post embed). */
  compact?: boolean;
}

export function ComposerMediaField({
  attachments,
  onRemove,
  onRetry,
  onAdd,
  onFilesDropped,
  onReorder,
  disabled = false,
  dropZoneLabel = "Drop zone for images and videos. Press Enter to add files.",
  emptyHint = "Drag, paste, or click to add media",
  className = "",
  signerConnectionNote,
  attachmentFailedTitle,
  compact = false,
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
    if (disabled) return;
    const target = e.target as HTMLElement;
    if (target.closest("textarea") || target.closest("input")) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onAdd();
    }
  };

  const empty = attachments.length === 0;
  const dropEnabled = Boolean(onFilesDropped) && !disabled;

  return (
    <div className={className}>
      <ComposerCanvasSectionLabel
        className={
          compact
            ? "text-text-tertiary mb-0.5 text-[10px] font-medium tracking-wide uppercase"
            : undefined
        }
      >
        Media
      </ComposerCanvasSectionLabel>
      {signerConnectionNote ? (
        <div className="mb-1.5" role="note">
          {signerConnectionNote}
        </div>
      ) : null}
      <div
        role="button"
        tabIndex={-1}
        aria-label={dropZoneLabel}
        className={cn(
          "motion-fast relative rounded-lg",
          empty && !isDraggingOver && "min-h-0",
          !empty && "bg-surface-hover/40 rounded-md px-1 py-1.5 sm:px-1.5",
          isDraggingOver &&
            dropEnabled &&
            "bg-brand/5 ring-brand/40 ring-dashed ring-2"
        )}
        onDragOver={dropEnabled ? handleDragOver : undefined}
        onDragLeave={dropEnabled ? handleDragLeave : undefined}
        onDrop={dropEnabled ? handleDrop : undefined}
        onKeyDown={handleKeyDown}
      >
        {isDraggingOver && dropEnabled ? (
          <div className="border-brand bg-brand/5 pointer-events-none absolute inset-0 z-10 flex min-h-[3.5rem] items-center justify-center rounded-md border-2 border-dashed">
            <span className="text-text-secondary text-sm">
              Drop to add images or videos
            </span>
          </div>
        ) : null}
        <AttachmentsStrip
          variant="inline"
          emptyAffordance="composerWell"
          emptyWellHint={compact ? "Add media" : "Add images or videos"}
          density={compact ? "compact" : "default"}
          attachments={attachments}
          onRemove={onRemove}
          onRetry={onRetry}
          onAdd={onAdd}
          onReorder={onReorder}
          disabled={disabled}
          failedStatusTitle={attachmentFailedTitle}
        />
        {empty && !isDraggingOver && emptyHint ? (
          <p
            className={cn(
              "text-text-tertiary leading-snug",
              compact ? "mt-0.5 text-[9px]" : "mt-1 text-[10px]"
            )}
          >
            {emptyHint}
          </p>
        ) : null}
      </div>
    </div>
  );
}
