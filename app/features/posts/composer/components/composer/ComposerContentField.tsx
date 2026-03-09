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
  /** Show "Open draft" button (hidden in template mode) */
  showDraftButton?: boolean;
  onOpenDraft?: () => void;
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
  placeholder = "Write a note…",
  rows = 6,
  showDraftButton = false,
  onOpenDraft,
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
            "text-foreground min-h-[160px] border-0 bg-transparent shadow-none focus-visible:ring-0 " +
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
              aria-label="Open draft"
            >
              <FolderOpen
                className={`mr-1 ${INLINE_ICON_SIZE_CLASS}`}
                strokeWidth={INLINE_ICON_STROKE}
                aria-hidden
              />
              Open draft
            </Button>
          </div>
        ) : null}
      </div>
      {error?.message ? (
        <div className="text-destructive mt-1 text-sm">{error.message}</div>
      ) : null}
      <div className="text-muted-foreground mt-2 flex items-center justify-between text-sm">
        <span>
          {value.length}/{maxLength}
        </span>
      </div>
    </div>
  );
}
