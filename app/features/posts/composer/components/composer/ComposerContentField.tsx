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

export function ComposerContentField({
  value,
  onChange,
  error = null,
  disabled = false,
  placeholder = "Write your post…",
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
      <div className="border-border bg-card focus-within:ring-primary/25 relative rounded-lg border p-4 shadow-sm transition-shadow duration-200 focus-within:ring-2">
        <Textarea
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={
            "text-foreground min-h-[180px] resize-y border-0 bg-transparent text-[15px] leading-relaxed shadow-none focus-visible:ring-0 " +
            (error ? "focus-visible:ring-destructive" : "")
          }
          placeholder={placeholder}
          rows={rows}
          disabled={disabled}
        />
        {showDraftButton && onOpenDraft ? (
          <div className="absolute top-4 right-4 flex gap-2">
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
      {error?.message ? (
        <div className="text-destructive mt-1 text-sm">{error.message}</div>
      ) : null}
      <div className="text-muted-foreground mt-2 flex flex-col gap-1 text-xs sm:flex-row sm:items-center sm:justify-between">
        <span className="hidden sm:inline">
          ⌘S save draft · ⌘↵ publish (when ready)
        </span>
        <span className="sm:hidden">⌘S save · ⌘↵ publish</span>
        <span className="text-right text-sm tabular-nums sm:ml-auto">
          {value.length} / {maxLength}
        </span>
      </div>
    </div>
  );
}
