/**
 * Presentational thread mode field: segment list, add segment, delay between posts.
 * V3: continuous thread canvas — light segment shells, quiet reorder, compact media.
 */

import { ChevronDown, ChevronUp, CornerDownRight, Trash2 } from "lucide-react";
import React from "react";

import { Button } from "~/components/ui/button";
import { Textarea } from "~/components/ui/textarea";
import { AttachmentsStrip } from "~/features/posts/components/AttachmentsStrip";
import type { ComposerAttachment } from "~/features/posts/types";
import { removeToken } from "~/features/posts/utils/inline-tokens.client";
import { INLINE_ICON_STROKE } from "~/lib/icon-constants";
import { cn } from "~/lib/utils";

import { MIN_THREAD_SEGMENTS } from "./thread-constants";

export interface ThreadSegment {
  id: string;
  content: string;
  attachments: ComposerAttachment[];
}

export interface ComposerThreadFieldProps {
  segments: ThreadSegment[];
  onSegmentsChange: React.Dispatch<React.SetStateAction<ThreadSegment[]>>;
  threadDelayMinutes: number;
  onFilesDropped: (segmentId: string, files: File[]) => void;
  onAddSegmentClick: (segmentId: string) => void;
  disabled?: boolean;
  /** Blocks segment media add/drop/remove strip only (text areas use `disabled`). */
  attachmentsDisabled?: boolean;
  draggingOverSegmentId: string | null;
  onDraggingOverSegmentIdChange: (id: string | null) => void;
  /** Shown once when Blossom is on but there is no Settings signer and no NIP-07 `window.nostr`. */
  signerConnectionNote?: React.ReactNode;
  /** Tooltip on failed attachment tiles in each segment */
  attachmentFailedTitle?: string;
}

export function ComposerThreadField({
  segments,
  onSegmentsChange,
  threadDelayMinutes: _threadDelayMinutes,
  onFilesDropped,
  onAddSegmentClick,
  disabled = false,
  attachmentsDisabled = false,
  draggingOverSegmentId,
  onDraggingOverSegmentIdChange,
  signerConnectionNote,
  attachmentFailedTitle,
}: ComposerThreadFieldProps) {
  const attachmentsBlocked = disabled || attachmentsDisabled;

  return (
    <div className="space-y-6">
      {signerConnectionNote ? (
        <div className="mb-1" role="note">
          {signerConnectionNote}
        </div>
      ) : null}
      {segments.map((seg, idx) => (
        <div
          key={seg.id}
          role="button"
          tabIndex={-1}
          aria-label={`Segment ${idx + 1}. Drop media here or press Enter to add files.`}
          className={cn(
            "group border-l-primary/20 relative rounded-r-md border-l-2 pl-3 transition-colors",
            "hover:bg-muted/[0.04] focus-within:bg-muted/[0.05]"
          )}
          onDragOver={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onDraggingOverSegmentIdChange(seg.id);
          }}
          onDragLeave={(e) => {
            e.preventDefault();
            const related = e.relatedTarget;
            if (related == null || !e.currentTarget.contains(related as Node)) {
              onDraggingOverSegmentIdChange(null);
            }
          }}
          onDrop={(e) => {
            e.preventDefault();
            onDraggingOverSegmentIdChange(null);
            if (attachmentsBlocked) return;
            const files = Array.from(e.dataTransfer.files);
            if (files.length > 0) onFilesDropped(seg.id, files);
          }}
          onKeyDown={(e) => {
            const target = e.target as HTMLElement;
            if (target.closest("textarea") || target.closest("input")) {
              return;
            }
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              if (!attachmentsBlocked) onAddSegmentClick(seg.id);
            }
          }}
        >
          {draggingOverSegmentId === seg.id ? (
            <div className="border-primary bg-primary/5 pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-r-md border-2 border-dashed">
              <span className="text-muted-foreground text-xs">
                Drop to add media
              </span>
            </div>
          ) : null}
          <div className="flex items-center justify-between gap-2 pt-0.5 pb-1.5">
            <span
              className="text-muted-foreground/70 border-border/40 inline-flex h-6 min-w-[1.25rem] items-center justify-center rounded border bg-transparent px-1 text-xs font-medium tabular-nums"
              aria-hidden
            >
              {idx + 1}
            </span>
            {segments.length > 1 ? (
              <div className="flex items-center gap-0.5">
                <div
                  className={cn(
                    "flex items-center gap-0 transition-opacity",
                    "opacity-40 group-focus-within:opacity-100 group-hover:opacity-100",
                    "max-sm:opacity-100"
                  )}
                >
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="text-muted-foreground h-7 w-7"
                    aria-label={`Move segment ${idx + 1} up`}
                    disabled={disabled || idx === 0}
                    onClick={() =>
                      onSegmentsChange((prev) => {
                        if (idx === 0) return prev;
                        const next = [...prev];
                        const [item] = next.splice(idx, 1);
                        if (!item) return prev;
                        next.splice(idx - 1, 0, item);
                        return next;
                      })
                    }
                  >
                    <ChevronUp
                      className="h-4 w-4"
                      strokeWidth={INLINE_ICON_STROKE}
                      aria-hidden
                    />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="text-muted-foreground h-7 w-7"
                    aria-label={`Move segment ${idx + 1} down`}
                    disabled={disabled || idx >= segments.length - 1}
                    onClick={() =>
                      onSegmentsChange((prev) => {
                        if (idx >= prev.length - 1) return prev;
                        const next = [...prev];
                        const [item] = next.splice(idx, 1);
                        if (!item) return prev;
                        next.splice(idx + 1, 0, item);
                        return next;
                      })
                    }
                  >
                    <ChevronDown
                      className="h-4 w-4"
                      strokeWidth={INLINE_ICON_STROKE}
                      aria-hidden
                    />
                  </Button>
                </div>
                {segments.length > MIN_THREAD_SEGMENTS ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="text-destructive/75 hover:text-destructive hover:bg-destructive/10 h-7 w-7"
                    onClick={() =>
                      onSegmentsChange((prev) =>
                        prev.filter((p) => p.id !== seg.id)
                      )
                    }
                    disabled={disabled}
                    aria-label={`Remove segment ${idx + 1}`}
                  >
                    <Trash2
                      className="h-3.5 w-3.5"
                      strokeWidth={INLINE_ICON_STROKE}
                      aria-hidden
                    />
                  </Button>
                ) : null}
              </div>
            ) : null}
          </div>

          <div className="focus-within:bg-muted/[0.06] focus-within:ring-border/20 -mx-0.5 rounded-md px-0.5 pt-0.5 pb-0 transition-colors focus-within:ring-1">
            <div className="relative">
              <Textarea
                value={seg.content}
                onChange={(e) =>
                  onSegmentsChange((prev) =>
                    prev.map((p) =>
                      p.id === seg.id ? { ...p, content: e.target.value } : p
                    )
                  )
                }
                onKeyDown={(e) => {
                  if (
                    (e.metaKey || e.ctrlKey) &&
                    e.shiftKey &&
                    e.key === "Enter"
                  ) {
                    e.preventDefault();
                    onSegmentsChange((prev) => {
                      const next = [...prev];
                      next.splice(idx + 1, 0, {
                        id: crypto.randomUUID(),
                        content: "",
                        attachments: [],
                      });
                      return next;
                    });
                  }
                }}
                placeholder="Segment content…"
                rows={3}
                disabled={disabled}
                className="text-foreground placeholder:text-muted-foreground/65 min-h-[5rem] resize-y border-0 bg-transparent px-0 pt-0 pb-4 text-base leading-relaxed shadow-none focus-visible:ring-0"
              />
              <p className="text-muted-foreground/35 pointer-events-none absolute right-0 bottom-0.5 text-[9px] tabular-nums">
                {seg.content.length} chars
              </p>
            </div>
          </div>

          <div className="mt-1.5">
            <AttachmentsStrip
              variant="inline"
              density="compact"
              attachments={seg.attachments}
              onRemove={(localId) =>
                onSegmentsChange((prev) =>
                  prev.map((p) =>
                    p.id === seg.id
                      ? {
                          ...p,
                          content: removeToken(p.content, localId),
                          attachments: p.attachments.filter(
                            (a) => a.localId !== localId
                          ),
                        }
                      : p
                  )
                )
              }
              onAdd={() => onAddSegmentClick(seg.id)}
              disabled={attachmentsBlocked}
              failedStatusTitle={attachmentFailedTitle}
            />
          </div>

          <div className="mt-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-muted-foreground hover:text-muted-foreground h-7 px-1 text-xs font-normal"
              onClick={() =>
                onSegmentsChange((prev) => {
                  const next = [...prev];
                  next.splice(idx + 1, 0, {
                    id: crypto.randomUUID(),
                    content: "",
                    attachments: [],
                  });
                  return next;
                })
              }
              disabled={disabled}
            >
              <CornerDownRight
                className="text-muted-foreground/60 mr-1 h-3.5 w-3.5"
                strokeWidth={INLINE_ICON_STROKE}
                aria-hidden
              />
              Add below
            </Button>
          </div>
        </div>
      ))}

      <button
        type="button"
        aria-label="Add another segment to the thread"
        disabled={disabled}
        onClick={() =>
          onSegmentsChange((prev) => [
            ...prev,
            {
              id: crypto.randomUUID(),
              content: "",
              attachments: [],
            },
          ])
        }
        className={cn(
          "border-border/35 text-muted-foreground hover:text-foreground hover:bg-muted/[0.04] w-full rounded-lg border border-dashed px-3 py-2.5 text-left text-xs transition-colors",
          "disabled:pointer-events-none disabled:opacity-50"
        )}
      >
        Add another segment
      </button>
    </div>
  );
}
