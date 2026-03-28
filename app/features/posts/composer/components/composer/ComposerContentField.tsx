/**
 * Presentational content field: textarea, optional draft button, char count, error.
 */

import { FolderOpen } from "lucide-react";

import { Button } from "~/components/ui/button";
import { Textarea } from "~/components/ui/textarea";
import {
  INLINE_ICON_SIZE_CLASS,
  INLINE_ICON_STROKE,
} from "~/lib/icon-constants";

export interface ComposerContentFieldProps {
  value: string;
  onChange: (value: string) => void;
  error?: { message?: string } | null;
  disabled?: boolean;
  placeholder?: string;
  rows?: number;
  /** Show "Drafts" button (hidden in template mode) */
  showDraftButton?: boolean;
  onOpenDraft?: () => void;
  /** Button label (default: "Drafts") */
  draftButtonLabel?: string;
  maxLength?: number;
  id?: string;
  /** Optional className for the wrapper */
  className?: string;
}

const DEFAULT_MAX_LENGTH = 5000;

const DEFAULT_PLACEHOLDER =
  "Share an update, link, or drop media—tokens go inline as you type.";

export function ComposerContentField({
  value,
  onChange,
  error = null,
  disabled = false,
  placeholder = DEFAULT_PLACEHOLDER,
  rows = 6,
  showDraftButton = false,
  onOpenDraft,
  draftButtonLabel = "Drafts",
  maxLength = DEFAULT_MAX_LENGTH,
  id = "content",
  className = "",
}: ComposerContentFieldProps) {
  return (
    <div className={className}>
      <div className="border-border bg-card focus-within:ring-primary/25 relative overflow-hidden rounded-lg border shadow-sm transition-shadow duration-200 focus-within:ring-2">
        <div className="relative px-3 pt-3 pb-2">
          <Textarea
            id={id}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className={
              "text-foreground min-h-[150px] resize-y border-0 bg-transparent px-0 py-0 text-[15px] leading-relaxed shadow-none focus-visible:ring-0 " +
              (showDraftButton && onOpenDraft ? "pr-28 " : "") +
              (error ? "focus-visible:ring-destructive" : "")
            }
            placeholder={placeholder}
            rows={rows}
            disabled={disabled}
          />
          {showDraftButton && onOpenDraft ? (
            <div className="absolute top-3 right-3 flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onOpenDraft}
                disabled={disabled}
                aria-label={draftButtonLabel}
              >
                <FolderOpen
                  className={`mr-1 ${INLINE_ICON_SIZE_CLASS}`}
                  strokeWidth={INLINE_ICON_STROKE}
                  aria-hidden
                />
                {draftButtonLabel}
              </Button>
            </div>
          ) : null}
        </div>
        <div className="border-border/80 bg-muted/25 text-muted-foreground flex flex-col gap-0.5 border-t px-3 py-1.5 text-[11px] sm:flex-row sm:items-center sm:justify-between">
          <span className="hidden sm:inline">
            ⌘S save draft · ⌘↵ publish (when ready)
          </span>
          <span className="sm:hidden">⌘S save · ⌘↵ publish</span>
          <span className="text-foreground/80 text-right text-xs tabular-nums sm:ml-auto">
            {value.length} / {maxLength}
          </span>
        </div>
      </div>
      {error?.message ? (
        <div className="text-destructive mt-1 text-sm">{error.message}</div>
      ) : null}
    </div>
  );
}
