/**
 * Presentational content field: textarea, char count, shortcut hint, error.
 * Intended inside ComposerLeftCanvas — no outer card; drafts live in canvas header.
 */

import { Textarea } from "~/components/ui/textarea";
import { cn } from "~/lib/utils";

export interface ComposerContentFieldProps {
  value: string;
  onChange: (value: string) => void;
  error?: { message?: string } | null;
  disabled?: boolean;
  placeholder?: string;
  rows?: number;
  maxLength?: number;
  id?: string;
  className?: string;
  /**
   * `embedded` — borderless in parent canvas (default).
   * `card` — legacy bordered block if used outside the unified canvas.
   */
  surface?: "embedded" | "card";
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
  maxLength = DEFAULT_MAX_LENGTH,
  id = "content",
  className = "",
  surface = "embedded",
}: ComposerContentFieldProps) {
  const isCard = surface === "card";

  return (
    <div className={className}>
      <div
        className={cn(
          isCard &&
            "border-border bg-card focus-within:ring-primary/25 relative overflow-hidden rounded-lg border shadow-sm transition-shadow duration-200 focus-within:ring-2"
        )}
      >
        <div className={cn("relative", isCard ? "px-3 pt-3 pb-2" : "pb-1")}>
          <Textarea
            id={id}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className={cn(
              "text-foreground min-h-[150px] resize-y border-0 bg-transparent px-0 py-0 text-[15px] leading-relaxed shadow-none focus-visible:ring-0",
              isCard &&
                error &&
                "focus-visible:ring-destructive focus-visible:ring-2"
            )}
            placeholder={placeholder}
            rows={rows}
            disabled={disabled}
          />
        </div>
        <div
          className={cn(
            "text-muted-foreground flex flex-col gap-0.5 pt-2 text-[10px] sm:flex-row sm:items-center sm:justify-between",
            isCard
              ? "border-border/80 bg-muted/25 border-t px-3 py-1.5"
              : "border-border/30 mt-1 border-t sm:pt-2"
          )}
        >
          <span className="hidden sm:inline">
            ⌘S save draft · ⌘↵ publish (when ready)
          </span>
          <span className="sm:hidden">⌘S save · ⌘↵ publish</span>
          <span className="text-foreground/70 text-right text-[11px] tabular-nums sm:ml-auto">
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
