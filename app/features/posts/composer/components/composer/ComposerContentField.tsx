/**
 * Presentational content field: textarea, char count, shortcut hint, error.
 * Intended inside ComposerLeftCanvas — no outer card; drafts live in canvas header.
 */

import { useCallback, useLayoutEffect, useRef } from "react";

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
  /**
   * `campaignSource` — shorter default height + auto-expand (contest/giveaway source post embed).
   */
  density?: "default" | "campaignSource";
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
  density = "default",
}: ComposerContentFieldProps) {
  const isCard = surface === "card";
  const isCampaignSource = density === "campaignSource";
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const effectiveRows = isCampaignSource ? 2 : rows;

  const syncCampaignSourceHeight = useCallback(() => {
    const el = textareaRef.current;
    if (!el || !isCampaignSource) return;
    el.style.height = "auto";
    const minPx = 72;
    el.style.height = `${Math.max(minPx, el.scrollHeight)}px`;
  }, [isCampaignSource]);

  useLayoutEffect(() => {
    syncCampaignSourceHeight();
  }, [value, syncCampaignSourceHeight]);

  return (
    <div className={className}>
      <div
        className={cn(
          isCard &&
            "border-border bg-surface focus-within:ring-brand/25 shadow-1 relative overflow-hidden rounded-lg border transition-shadow duration-200 focus-within:ring-2",
          !isCard &&
            "focus-within:bg-surface-hover/50 focus-within:ring-border-subtle motion-base rounded-md focus-within:ring-1"
        )}
      >
        <div
          className={cn(
            "relative",
            isCard ? "px-3 pt-3 pb-2" : "px-0.5 pt-0.5 pb-1"
          )}
        >
          <Textarea
            ref={textareaRef}
            id={id}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className={cn(
              "text-text resize-y border-0 bg-transparent px-0 py-0 shadow-none focus-visible:ring-0",
              isCampaignSource
                ? "max-h-[min(40vh,22rem)] min-h-[72px] overflow-y-auto"
                : "min-h-[150px]",
              isCard
                ? "text-[15px] leading-relaxed"
                : "text-base leading-relaxed",
              !isCard && "placeholder:text-text-tertiary/85",
              isCard &&
                error &&
                "focus-visible:ring-danger focus-visible:ring-2"
            )}
            placeholder={placeholder}
            rows={effectiveRows}
            disabled={disabled}
          />
        </div>
        <div
          className={cn(
            "flex flex-col gap-0.5 sm:flex-row sm:items-center sm:justify-between",
            isCard
              ? "text-text-secondary border-border-subtle bg-surface-hover/40 border-t px-3 py-1.5 pt-2 text-[10px]"
              : "text-text-tertiary border-border-subtle mt-0.5 border-t pt-1.5 text-[9px] sm:pt-1.5"
          )}
        >
          <span className="hidden sm:inline">
            ⌘S save draft · ⌘↵ publish (when ready)
          </span>
          <span className="sm:hidden">⌘S save · ⌘↵ publish</span>
          <span
            className={cn(
              "text-right tabular-nums sm:ml-auto",
              isCard
                ? "text-text/80 text-[11px]"
                : "text-text-tertiary/75 text-[10px]"
            )}
          >
            {value.length} / {maxLength}
          </span>
        </div>
      </div>
      {error?.message ? (
        <div className="text-danger mt-1 text-sm">{error.message}</div>
      ) : null}
    </div>
  );
}
