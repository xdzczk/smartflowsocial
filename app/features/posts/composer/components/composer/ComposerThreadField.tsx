/**
 * Presentational thread mode field: segment list, add segment, delay between posts.
 */

import React from "react";

import { Button } from "~/components/ui/button";
import { Textarea } from "~/components/ui/textarea";
import { AttachmentsStrip } from "~/features/posts/components/AttachmentsStrip";
import type { ComposerAttachment } from "~/features/posts/types";
import { removeToken } from "~/features/posts/utils/inline-tokens.client";

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
  draggingOverSegmentId: string | null;
  onDraggingOverSegmentIdChange: (id: string | null) => void;
}

export function ComposerThreadField({
  segments,
  onSegmentsChange,
  threadDelayMinutes,
  onFilesDropped,
  onAddSegmentClick,
  disabled = false,
  draggingOverSegmentId,
  onDraggingOverSegmentIdChange,
}: ComposerThreadFieldProps) {
  const estimatedMinutes = Math.max(
    0,
    (segments.length - 1) * threadDelayMinutes
  );
  return (
    <div className="space-y-4">
      <div className="bg-muted/30 rounded-md border px-3 py-2 text-xs">
        <p>
          {segments.length} segment{segments.length === 1 ? "" : "s"} ·
          estimated duration {estimatedMinutes} min
        </p>
      </div>
      {segments.map((seg, idx) => (
        <div
          key={seg.id}
          role="button"
          tabIndex={-1}
          aria-label={`Segment ${idx + 1}. Drop media here or press Enter to add files.`}
          className={`group relative rounded-lg border p-3 ${
            idx === 0
              ? "border-border bg-card shadow-sm"
              : "animate-in fade-in slide-in-from-bottom-2 border-border border-l-primary/30 bg-muted/20 dark:bg-muted/10 border-l-2 duration-200"
          }`}
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
              onAddSegmentClick(seg.id);
            }
          }}
        >
          {draggingOverSegmentId === seg.id ? (
            <div className="border-primary bg-primary/5 pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-lg border-2 border-dashed">
              <span className="text-muted-foreground text-xs">
                Drop to add media
              </span>
            </div>
          ) : null}
          <div className="mb-2 flex items-center justify-between">
            <span className="text-muted-foreground flex items-center gap-1.5 text-sm font-medium">
              {idx > 0 ? (
                <span
                  className="bg-muted flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs"
                  aria-hidden
                >
                  {idx + 1}
                </span>
              ) : null}
              Segment {idx + 1}
            </span>
            {segments.length > 1 ? (
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
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
                  disabled={disabled || idx === 0}
                >
                  Up
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
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
                  disabled={disabled || idx >= segments.length - 1}
                >
                  Down
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    onSegmentsChange((prev) => {
                      const source = prev[idx];
                      if (!source) return prev;
                      const clone: ThreadSegment = {
                        id: crypto.randomUUID(),
                        content: source.content,
                        attachments: [...source.attachments],
                      };
                      const next = [...prev];
                      next.splice(idx + 1, 0, clone);
                      return next;
                    })
                  }
                  disabled={disabled}
                >
                  Duplicate
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:bg-destructive/10 opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100"
                  onClick={() =>
                    onSegmentsChange((prev) =>
                      prev.filter((p) => p.id !== seg.id)
                    )
                  }
                  disabled={disabled}
                  aria-label={`Remove segment ${idx + 1}`}
                >
                  Remove
                </Button>
              </div>
            ) : null}
          </div>
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
              if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === "Enter") {
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
            className="text-foreground focus-visible:ring-primary/20 mb-2 min-h-[80px] focus-visible:ring-2"
          />
          <p className="text-muted-foreground mb-2 text-xs">
            {seg.content.length} chars
          </p>
          <AttachmentsStrip
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
            disabled={disabled}
          />
          <div className="mt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
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
              Add below
            </Button>
          </div>
        </div>
      ))}
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
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
          disabled={disabled}
        >
          Add segment
        </Button>
      </div>
    </div>
  );
}
