/**
 * Attachments strip for unified composer.
 * Shows thumbnails (image/video), filename for others; remove, reorder, optional alt.
 * Upload state: queued → uploading → done → failed (retry).
 */

import { ChevronDown, ChevronUp, Plus, X } from "lucide-react";

import { Button } from "~/components/ui/button";
import { INLINE_ICON_STROKE } from "~/lib/icon-constants";
import { cn } from "~/lib/utils";

import type { ComposerAttachment } from "../types";

interface AttachmentsStripProps {
  attachments: ComposerAttachment[];
  onRemove: (localId: string) => void;
  /** Retry a failed upload (same file reference). */
  onRetry?: (localId: string) => void;
  onAdd: () => void;
  disabled?: boolean;
  /** Shown as native tooltip on failed tiles (e.g. Blossom + signer hints). */
  failedStatusTitle?: string;
  /** Optional: reorder (fromIndex, toIndex) - for drag reorder */
  onReorder?: (fromIndex: number, toIndex: number) => void;
  /**
   * `inline` — no outer bordered box (use inside unified composer canvas).
   * `boxed` — legacy bordered wrapper.
   */
  variant?: "inline" | "boxed";
  /**
   * When empty + inline: full-width dashed well (composer main canvas) vs compact add tile only.
   */
  emptyAffordance?: "default" | "composerWell";
  /** Shown beside add control when `emptyAffordance="composerWell"`. */
  emptyWellHint?: string;
  /** Smaller tiles and add control (e.g. per thread segment). */
  density?: "default" | "compact";
  /**
   * `minimal` — ghost-style add control for thread segments (lighter than outline tile).
   */
  addControlTone?: "default" | "minimal";
  className?: string;
}

export function AttachmentsStrip({
  attachments,
  onRemove,
  onRetry,
  onAdd,
  disabled = false,
  failedStatusTitle,
  onReorder,
  variant = "inline",
  emptyAffordance = "default",
  emptyWellHint = "Images and videos",
  density = "default",
  addControlTone = "default",
  className,
}: AttachmentsStripProps) {
  const compact = density === "compact";
  const minimalAdd = addControlTone === "minimal";
  const tileClass = compact
    ? "h-12 w-12 rounded border-border/40"
    : "h-16 w-16 rounded border-border";
  const failedTileClass = compact
    ? "min-h-[3.75rem] w-[4.75rem] max-w-[5.5rem] rounded border-border/40"
    : "min-h-[5.75rem] w-[7.25rem] rounded border-border";
  const addBtnClass = compact ? "h-12 w-12 shrink-0" : "h-16 w-16 shrink-0";
  const plusClass = compact ? "h-4 w-4" : "h-6 w-6";
  const minimalAddBtnClass =
    "h-9 w-9 shrink-0 rounded-md border border-dashed border-border/30 bg-transparent text-muted-foreground/55 hover:border-border/45 hover:bg-muted/40 hover:text-muted-foreground";

  const useComposerWell =
    variant === "inline" &&
    emptyAffordance === "composerWell" &&
    attachments.length === 0;

  if (useComposerWell) {
    return (
      <div
        className={cn(
          "border-border/35 bg-muted/[0.06] flex min-h-[3.25rem] w-full items-center gap-3 rounded-lg border border-dashed px-3 py-2.5",
          compact && "min-h-[2.75rem] gap-2 py-2",
          className
        )}
      >
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onAdd}
          disabled={disabled}
          className={cn(
            "border-border/50 text-muted-foreground hover:text-foreground shrink-0 p-0",
            compact ? "h-9 w-9" : "h-11 w-11"
          )}
          aria-label="Add attachment"
        >
          <Plus
            className={cn(compact ? "h-4 w-4" : "h-5 w-5")}
            strokeWidth={INLINE_ICON_STROKE}
            aria-hidden
          />
        </Button>
        <span className="text-muted-foreground text-xs leading-snug">
          {emptyWellHint}
        </span>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-2",
        variant === "boxed" && "border-border mt-2 rounded-md border p-2",
        variant === "inline" && "mt-0",
        className
      )}
    >
      {/* eslint-disable-next-line sonarjs/cognitive-complexity -- per-tile upload states */}
      {attachments.map((att, index) => (
        <div
          key={att.localId}
          className={cn(
            "bg-muted/50 relative flex shrink-0 items-center justify-center overflow-hidden border",
            att.status === "failed" ? failedTileClass : tileClass
          )}
          title={
            att.status === "failed"
              ? [att.file?.name, att.uploadErrorMessage, failedStatusTitle]
                  .filter(Boolean)
                  .join(" — ")
              : undefined
          }
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
            <div className="flex h-full w-full flex-col items-stretch justify-end gap-1 px-1 pt-5 pb-1 text-center">
              <span className="text-destructive text-[10px] leading-tight font-medium">
                Upload failed
              </span>
              {att.file?.name ? (
                <span className="text-muted-foreground line-clamp-2 text-[9px] leading-snug">
                  {att.file.name}
                </span>
              ) : null}
              {att.uploadErrorMessage ? (
                <span className="text-muted-foreground/90 line-clamp-2 text-[8px] leading-snug">
                  {att.uploadErrorMessage}
                </span>
              ) : null}
              {onRetry ? (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="h-6 shrink-0 px-1 text-[10px]"
                  disabled={disabled}
                  onClick={() => onRetry(att.localId)}
                >
                  Retry
                </Button>
              ) : null}
            </div>
          ) : null}
          {onReorder && attachments.length > 1 ? (
            <div className="bg-background/80 absolute bottom-0 left-0 flex flex-col gap-0 p-0.5">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className={compact ? "h-4 w-4" : "h-5 w-5"}
                aria-label="Move earlier"
                disabled={disabled || index === 0}
                onClick={() => onReorder(index, index - 1)}
              >
                <ChevronUp
                  className={compact ? "h-2.5 w-2.5" : "h-3 w-3"}
                  strokeWidth={INLINE_ICON_STROKE}
                />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className={compact ? "h-4 w-4" : "h-5 w-5"}
                aria-label="Move later"
                disabled={disabled || index === attachments.length - 1}
                onClick={() => onReorder(index, index + 1)}
              >
                <ChevronDown
                  className={compact ? "h-2.5 w-2.5" : "h-3 w-3"}
                  strokeWidth={INLINE_ICON_STROKE}
                />
              </Button>
            </div>
          ) : null}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className={cn(
              "absolute top-0 right-0 rounded-full opacity-90",
              compact ? "h-5 w-5" : "h-6 w-6"
            )}
            aria-label="Remove attachment"
            onClick={() => onRemove(att.localId)}
            disabled={disabled}
          >
            <span className="sr-only">Remove</span>
            <X
              className={compact ? "h-3 w-3" : "h-3.5 w-3.5"}
              strokeWidth={INLINE_ICON_STROKE}
              aria-hidden
            />
          </Button>
        </div>
      ))}
      <Button
        type="button"
        variant={minimalAdd ? "ghost" : "outline"}
        size="sm"
        onClick={onAdd}
        disabled={disabled}
        className={cn(
          minimalAdd ? minimalAddBtnClass : addBtnClass,
          !minimalAdd && compact && "border-border/40 text-muted-foreground"
        )}
        aria-label="Add attachment"
      >
        <Plus
          className={minimalAdd ? "h-3.5 w-3.5" : plusClass}
          strokeWidth={INLINE_ICON_STROKE}
          aria-hidden
        />
      </Button>
    </div>
  );
}
