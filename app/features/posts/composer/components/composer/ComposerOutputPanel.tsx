/**
 * Collapsible draft preview: body (tokens stripped), media thumbs, tags, recyclable.
 */

import { ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";

import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import MediaThumbnail from "~/components/ui/MediaThumbnail";
import type { ComposerAttachment } from "~/features/posts/types";
import { stripAttachmentTokens } from "~/features/posts/utils/inline-tokens.client";
import {
  INLINE_ICON_SIZE_CLASS,
  INLINE_ICON_STROKE,
} from "~/lib/icon-constants";

export interface ComposerOutputPanelProps {
  content: string;
  attachments: ComposerAttachment[];
  tagsLine: string;
  isRecyclable: boolean;
  /** e.g. "Preview (first segment)" in thread mode */
  previewLabel?: string;
}

export function ComposerOutputPanel({
  content,
  attachments,
  tagsLine,
  isRecyclable,
  previewLabel = "Preview",
}: ComposerOutputPanelProps) {
  const [open, setOpen] = useState(false);
  const body = stripAttachmentTokens(content).trim();
  const withUrl = attachments.filter((a) => a.url);

  return (
    <div className="border-border mt-4 rounded-lg border">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="text-muted-foreground hover:text-foreground h-9 w-full justify-between rounded-none px-3 text-xs font-medium"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        {previewLabel}
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
        <div className="border-border space-y-3 border-t p-3">
          {withUrl.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {withUrl.map((a) => (
                <div
                  key={a.localId}
                  className="border-border h-20 w-20 overflow-hidden rounded-md border"
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
          <div className="bg-muted/30 max-h-48 overflow-y-auto rounded-md p-3 text-sm whitespace-pre-wrap">
            {body ? (
              body
            ) : (
              <span className="text-muted-foreground italic">No text yet</span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {tagsLine.trim() ? (
              <span className="text-muted-foreground text-xs">
                Tags: {tagsLine.trim()}
              </span>
            ) : (
              <span className="text-muted-foreground text-xs">Tags: none</span>
            )}
            {isRecyclable ? (
              <Badge variant="secondary" className="text-xs">
                Recyclable
              </Badge>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
