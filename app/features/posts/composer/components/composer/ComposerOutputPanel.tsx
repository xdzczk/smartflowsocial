/**
 * Collapsible draft preview: body (tokens stripped), media thumbs, tags.
 */

import { ChevronDown, ChevronUp } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "~/components/ui/button";
import MediaThumbnail from "~/components/ui/MediaThumbnail";
import type { ComposerAttachment } from "~/features/posts/types";
import { stripAttachmentTokens } from "~/features/posts/utils/inline-tokens.client";
import {
  INLINE_ICON_SIZE_CLASS,
  INLINE_ICON_STROKE,
} from "~/lib/icon-constants";
import { cn } from "~/lib/utils";

export interface ComposerOutputPanelProps {
  content: string;
  attachments: ComposerAttachment[];
  tagsLine: string;
  /** e.g. "Preview (first segment)" in thread mode */
  previewLabel?: string;
  /**
   * `embedded` — inside ComposerLeftCanvas; no top border (parent divider).
   * `standalone` — legacy top border when used alone.
   */
  variant?: "embedded" | "standalone";
  /** Quieter chrome for thread first-segment preview. */
  previewTone?: "default" | "thread";
}

function bodyLooksRich(text: string): boolean {
  return /[#*_`]|]\(|^>\s/m.test(text);
}

export function ComposerOutputPanel({
  content,
  attachments,
  tagsLine,
  previewLabel = "Preview",
  variant = "embedded",
  previewTone = "default",
}: ComposerOutputPanelProps) {
  const threadTone = previewTone === "thread";
  const [open, setOpen] = useState(false);
  const body = stripAttachmentTokens(content).trim();
  const withUrl = attachments.filter((a) => a.url);

  const dismissedAutoRef = useRef(false);
  const prevAttachCountRef = useRef(attachments.length);
  const prevBodyLenRef = useRef(body.length);

  useEffect(() => {
    const prev = prevAttachCountRef.current;
    prevAttachCountRef.current = attachments.length;
    if (dismissedAutoRef.current) return;
    if (prev === 0 && attachments.length > 0) {
      queueMicrotask(() => setOpen(true));
    }
  }, [attachments.length]);

  useEffect(() => {
    const prev = prevBodyLenRef.current;
    prevBodyLenRef.current = body.length;
    if (dismissedAutoRef.current) return;
    if (prev < 80 && body.length >= 80 && bodyLooksRich(body)) {
      queueMicrotask(() => setOpen(true));
    }
  }, [body]);

  useEffect(() => {
    if (attachments.length === 0 && body.length === 0) {
      dismissedAutoRef.current = false;
    }
  }, [attachments.length, body.length]);

  const toggleOpen = () => {
    setOpen((o) => {
      const next = !o;
      if (!next) dismissedAutoRef.current = true;
      return next;
    });
  };

  const standalone = variant === "standalone";

  return (
    <div className={cn(standalone && "border-border/40 border-t pt-1.5")}>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className={cn(
          "h-7 min-h-7 w-full justify-between gap-2 px-1.5 py-0 font-normal",
          threadTone
            ? "text-muted-foreground/55 hover:text-muted-foreground/80 hover:bg-muted/25 text-[10px] tracking-wide"
            : "text-muted-foreground/90 hover:text-muted-foreground hover:bg-muted/35 text-[11px]"
        )}
        onClick={toggleOpen}
        aria-expanded={open}
      >
        <span className="truncate">{previewLabel}</span>
        {open ? (
          <ChevronUp
            className={INLINE_ICON_SIZE_CLASS}
            strokeWidth={INLINE_ICON_STROKE}
          />
        ) : (
          <ChevronDown
            className={INLINE_ICON_SIZE_CLASS}
            strokeWidth={INLINE_ICON_STROKE}
          />
        )}
      </Button>
      {open ? (
        <div className={cn("pt-2", threadTone ? "space-y-2" : "space-y-2.5")}>
          {withUrl.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {withUrl.map((a) => (
                <div
                  key={a.localId}
                  className={cn(
                    "overflow-hidden rounded-md border",
                    threadTone
                      ? "border-border/50 h-14 w-14"
                      : "border-border h-20 w-20"
                  )}
                >
                  {a.mime?.startsWith("video/") ? (
                    <video
                      src={a.url}
                      className="h-full w-full object-cover"
                      muted
                      preload="metadata"
                    />
                  ) : (
                    <MediaThumbnail
                      src={a.url}
                      alt={a.alt ?? ""}
                      className="h-full w-full object-cover"
                    />
                  )}
                </div>
              ))}
            </div>
          ) : null}
          <div
            className={cn(
              "max-h-48 overflow-y-auto rounded-md whitespace-pre-wrap",
              threadTone
                ? "bg-muted/15 p-2 text-[13px] leading-snug"
                : "bg-muted/25 p-3 text-sm"
            )}
          >
            {body ? (
              body
            ) : (
              <span className="text-muted-foreground italic">No text yet</span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {tagsLine.trim() ? (
              <span
                className={cn(
                  "text-muted-foreground",
                  threadTone ? "text-[10px]" : "text-xs"
                )}
              >
                Tags: {tagsLine.trim()}
              </span>
            ) : (
              <span
                className={cn(
                  "text-muted-foreground",
                  threadTone ? "text-[10px]" : "text-xs"
                )}
              >
                Tags: none
              </span>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
