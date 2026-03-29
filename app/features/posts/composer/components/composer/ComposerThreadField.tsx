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
        <div className="border-border/25 bg-muted/[0.04] flex max-w-[min(100%,42rem)] items-center justify-between gap-3 rounded-md border px-2.5 py-2">
          <div className="min-w-0 space-y-0.5">
            <Label
              htmlFor="thread-auto-number-segments"
              className="text-foreground/90 cursor-pointer text-xs leading-tight font-medium"
            >
              Number segments in text
            </Label>
            <p className="text-muted-foreground/80 text-[11px] leading-snug">
              Inserts{" "}
              <span className="text-muted-foreground font-mono tabular-nums">
                1)
              </span>{" "}
              <span className="text-muted-foreground font-mono tabular-nums">
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
              className="bg-border/35 mb-4 h-px w-full max-w-[min(100%,42rem)]"
              aria-hidden
            />
          ) : null}
          <div
            role="button"
            tabIndex={-1}
            aria-label={`Segment ${idx + 1}. Drop media here or press Enter to add files.`}
            className={cn(
              "group border-border/20 relative border-l pl-3 transition-[background-color,border-color] duration-150",
              "hover:bg-muted/[0.025]",
              "focus-within:border-primary/30 focus-within:bg-muted/[0.04]"
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
              <div className="border-primary bg-primary/5 pointer-events-none absolute inset-0 z-10 flex items-center justify-center border border-dashed">
                <span className="text-muted-foreground text-xs">
                  Drop to add media
                </span>
              </div>
            ) : null}

            {/* Utility row: index + reorder + remove */}
            <div className="flex items-center justify-between gap-2 pb-1.5">
              <span
                className="text-muted-foreground/45 text-[11px] font-medium tracking-tight tabular-nums"
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
                      className="text-muted-foreground/70 hover:text-muted-foreground h-8 w-8"
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
                      className="text-muted-foreground/70 hover:text-muted-foreground h-8 w-8"
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
                      className="text-muted-foreground/45 hover:bg-destructive/10 hover:text-destructive h-8 w-8"
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
                "focus-within:bg-muted/[0.07] focus-within:ring-border/25 -mx-0.5 rounded-md px-0.5 pt-0.5 pb-0 transition-[background-color,box-shadow] duration-150",
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
                  className="text-foreground placeholder:text-muted-foreground/55 min-h-[4.25rem] resize-y border-0 bg-transparent px-0 pt-0 pb-3.5 text-base leading-relaxed shadow-none focus-visible:ring-0"
                />
                <p
                  className={cn(
                    "pointer-events-none absolute right-0 bottom-0 text-[9px] tabular-nums transition-colors duration-150",
                    "text-muted-foreground/18 group-focus-within:text-muted-foreground/32"
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
              <button
                type="button"
                className={cn(
                  "text-muted-foreground/65 hover:text-muted-foreground inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 py-1 text-xs font-normal transition-colors",
                  "hover:bg-muted/50 focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none",
                  "disabled:pointer-events-none disabled:opacity-50"
                )}
                disabled={disabled}
                onClick={() => insertSegmentBelow(idx)}
              >
                <CornerDownRight
                  className="text-muted-foreground/50 h-3.5 w-3.5 shrink-0"
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
          "text-muted-foreground/70 hover:text-foreground/85 hover:bg-muted/45 mt-1 inline-flex min-h-10 max-w-full items-center gap-2 rounded-md px-1.5 py-2 text-left text-xs transition-colors",
          "disabled:pointer-events-none disabled:opacity-50"
        )}
      >
        <ListPlus
          className="text-muted-foreground/50 h-4 w-4 shrink-0"
          strokeWidth={INLINE_ICON_STROKE}
          aria-hidden
        />
        Add another segment
      </button>
    </div>
  );
}
