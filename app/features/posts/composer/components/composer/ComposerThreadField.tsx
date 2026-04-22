/**
 * Presentational thread mode field: segment list, add segment, delay between posts.
 * Narrative-first layout: quiet utility row, dominant textarea, grouped support actions.
 */

import {
  ChevronDown,
  ChevronUp,
  CornerDownRight,
  ListPlus,
  Trash2,
} from "lucide-react";
import React from "react";

import { Button } from "~/components/ui/button";
import { Label } from "~/components/ui/label";
import { Switch } from "~/components/ui/switch";
import { Textarea } from "~/components/ui/textarea";
import { AttachmentsStrip } from "~/features/posts/components/AttachmentsStrip";
import type { ComposerAttachment } from "~/features/posts/types";
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
  /** When true, segment bodies are prefixed with "1) ", "2) ", … (inserted into text). */
  autoNumberSegments?: boolean;
  onAutoNumberSegmentsChange?: (enabled: boolean) => void;
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
  onRetryAttachment?: (localId: string) => void;
}

export function ComposerThreadField({
  segments,
  onSegmentsChange,
  autoNumberSegments = false,
  onAutoNumberSegmentsChange,
  threadDelayMinutes: _threadDelayMinutes,
  onFilesDropped,
  onAddSegmentClick,
  disabled = false,
  attachmentsDisabled = false,
  draggingOverSegmentId,
  onDraggingOverSegmentIdChange,
  signerConnectionNote,
  attachmentFailedTitle,
  onRetryAttachment,
}: ComposerThreadFieldProps) {
  const attachmentsBlocked = disabled || attachmentsDisabled;

  const insertSegmentBelow = (afterIndex: number) => {
    onSegmentsChange((prev) => {
      const next = [...prev];
      next.splice(afterIndex + 1, 0, {
        id: crypto.randomUUID(),
        content: "",
        attachments: [],
      });
      return next;
    });
  };

  return (
    <div className="space-y-5">
      {signerConnectionNote ? (
        <div className="mb-1" role="note">
          {signerConnectionNote}
        </div>
      ) : null}
      {onAutoNumberSegmentsChange ? (
        <div className="border-border-subtle bg-surface-hover/40 flex max-w-[min(100%,42rem)] items-center justify-between gap-3 rounded-md border px-2.5 py-2">
          <div className="min-w-0 space-y-0.5">
            <Label
              htmlFor="thread-auto-number-segments"
              className="text-text/90 cursor-pointer text-xs leading-tight font-medium"
            >
              Number segments in text
            </Label>
            <p className="text-text-tertiary text-[11px] leading-snug">
              Inserts{" "}
              <span className="text-text-secondary font-mono tabular-nums">
                1)
              </span>{" "}
              <span className="text-text-secondary font-mono tabular-nums">
                2)
              </span>{" "}
              … at the start of each segment. Updates when you reorder.
            </p>
          </div>
          <Switch
            id="thread-auto-number-segments"
            checked={autoNumberSegments}
            onCheckedChange={onAutoNumberSegmentsChange}
            disabled={disabled}
            aria-label="Number segments in text"
          />
        </div>
      ) : null}
      {segments.map((seg, idx) => (
        <div key={seg.id} className="relative">
          {idx > 0 ? (
            <div
              className="bg-border-subtle mb-4 h-px w-full max-w-[min(100%,42rem)]"
              aria-hidden
            />
          ) : null}
          <div
            role="button"
            tabIndex={-1}
            aria-label={`Segment ${idx + 1}. Drop media here or press Enter to add files.`}
            className={cn(
              "group border-border-subtle relative border-l pl-3 transition-[background-color,border-color] duration-150",
              "hover:bg-surface-hover/30",
              "focus-within:border-brand/30 focus-within:bg-surface-hover/40"
            )}
            onDragOver={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onDraggingOverSegmentIdChange(seg.id);
            }}
            onDragLeave={(e) => {
              e.preventDefault();
              const related = e.relatedTarget;
              if (
                related == null ||
                !e.currentTarget.contains(related as Node)
              ) {
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
              <div className="border-brand bg-brand/5 pointer-events-none absolute inset-0 z-10 flex items-center justify-center border border-dashed">
                <span className="text-text-secondary text-xs">
                  Drop to add media
                </span>
              </div>
            ) : null}

            {/* Utility row: index + reorder + remove */}
            <div className="flex items-center justify-between gap-2 pb-1.5">
              <span
                className="text-text-tertiary/70 text-[11px] font-medium tracking-tight tabular-nums"
                aria-hidden
              >
                {idx + 1}
              </span>
              {segments.length > 1 ? (
                <div className="flex items-center gap-0">
                  <div
                    className={cn(
                      "flex items-center gap-0 transition-opacity duration-150",
                      "opacity-25 group-focus-within:opacity-100 group-hover:opacity-100",
                      "max-sm:opacity-100"
                    )}
                  >
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="text-text-tertiary hover:text-text-secondary h-8 w-8"
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
                        className="h-3.5 w-3.5"
                        strokeWidth={INLINE_ICON_STROKE}
                        aria-hidden
                      />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="text-text-tertiary hover:text-text-secondary h-8 w-8"
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
                        className="h-3.5 w-3.5"
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
                      className="text-text-tertiary/65 hover:bg-danger/10 hover:text-danger h-8 w-8"
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

            {/* Main writing field */}
            <div
              className={cn(
                "focus-within:bg-surface-hover/50 focus-within:ring-border-subtle -mx-0.5 rounded-md px-0.5 pt-0.5 pb-0 transition-[background-color,box-shadow] duration-150",
                "focus-within:ring-1"
              )}
            >
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
                      insertSegmentBelow(idx);
                    }
                  }}
                  placeholder="Write this part of the thread…"
                  rows={3}
                  disabled={disabled}
                  className="text-text placeholder:text-text-tertiary/80 min-h-[4.25rem] resize-y border-0 bg-transparent px-0 pt-0 pb-3.5 text-base leading-relaxed shadow-none focus-visible:ring-0"
                />
                <p
                  className={cn(
                    "motion-fast pointer-events-none absolute right-0 bottom-0 text-[9px] tabular-nums",
                    "text-text-tertiary/30 group-focus-within:text-text-tertiary/55"
                  )}
                >
                  {seg.content.length} chars
                </p>
              </div>
            </div>

            {/* Support row: media + insert below */}
            <div
              className={cn(
                "mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5",
                "opacity-90 transition-opacity duration-150",
                "group-focus-within:opacity-100 group-hover:opacity-100",
                "max-sm:opacity-100"
              )}
            >
              <AttachmentsStrip
                variant="inline"
                density="compact"
                addControlTone="minimal"
                className="min-w-0 flex-1"
                attachments={seg.attachments}
                onRemove={(localId) =>
                  onSegmentsChange((prev) =>
                    prev.map((p) =>
                      p.id === seg.id
                        ? {
                            ...p,
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
                onRetry={onRetryAttachment}
              />
              <button
                type="button"
                className={cn(
                  "text-text-tertiary hover:text-text-secondary motion-fast inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 py-1 text-xs font-normal",
                  "focus-ring hover:bg-surface-hover/60",
                  "disabled:pointer-events-none disabled:opacity-50"
                )}
                disabled={disabled}
                onClick={() => insertSegmentBelow(idx)}
              >
                <CornerDownRight
                  className="text-text-tertiary/70 h-3.5 w-3.5 shrink-0"
                  strokeWidth={INLINE_ICON_STROKE}
                  aria-hidden
                />
                Insert below
              </button>
            </div>
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
          "text-text-secondary hover:text-text/90 hover:bg-surface-hover/60 motion-fast mt-1 inline-flex min-h-10 max-w-full items-center gap-2 rounded-md px-1.5 py-2 text-left text-xs",
          "disabled:pointer-events-none disabled:opacity-50"
        )}
      >
        <ListPlus
          className="text-text-tertiary/70 h-4 w-4 shrink-0"
          strokeWidth={INLINE_ICON_STROKE}
          aria-hidden
        />
        Add another segment
      </button>
    </div>
  );
}
