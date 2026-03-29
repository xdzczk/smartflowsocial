/**
 * Collapsible compact preview for poll drafts: question snippet, options, tags.
 */

import { ChevronDown, ChevronUp } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "~/components/ui/button";
import {
  INLINE_ICON_SIZE_CLASS,
  INLINE_ICON_STROKE,
} from "~/lib/icon-constants";
import { cn } from "~/lib/utils";

const SNIPPET_LEN = 160;

export interface PollOutputPanelProps {
  question: string;
  options: string[];
  /** Stable ids aligned with `options` (same length). */
  optionRowIds: string[];
  tagsLine: string;
  pollTypeLabel: string;
  /**
   * `embedded` — inside ComposerLeftCanvas after ComposerCanvasDivider (no top border).
   * `standalone` — legacy top border when used alone.
   */
  variant?: "embedded" | "standalone";
}

export function PollOutputPanel({
  question,
  options,
  optionRowIds,
  tagsLine,
  pollTypeLabel,
  variant = "embedded",
}: PollOutputPanelProps) {
  const [open, setOpen] = useState(false);
  const q = question.trim();
  const snippet =
    q.length > SNIPPET_LEN ? `${q.slice(0, SNIPPET_LEN).trim()}…` : q;
  const filledRows = options
    .map((o, i) => ({
      text: o.trim(),
      id: optionRowIds[i] ?? `opt-${i}`,
    }))
    .filter((row) => row.text.length > 0);

  const filledCount = filledRows.length;

  const dismissedAutoRef = useRef(false);
  const prevFilledRef = useRef(filledCount);
  const prevQuestionLenRef = useRef(q.length);

  // Defer setState to satisfy react-hooks/set-state-in-effect (auto-open on draft richness).
  useEffect(() => {
    const prev = prevFilledRef.current;
    prevFilledRef.current = filledCount;
    if (dismissedAutoRef.current) return;
    if (prev < 2 && filledCount >= 2) {
      queueMicrotask(() => setOpen(true));
    }
  }, [filledCount]);

  useEffect(() => {
    const prev = prevQuestionLenRef.current;
    prevQuestionLenRef.current = q.length;
    if (dismissedAutoRef.current) return;
    if (prev < 24 && q.length >= 24) {
      queueMicrotask(() => setOpen(true));
    }
  }, [q.length]);

  useEffect(() => {
    if (filledCount === 0 && q.length === 0) {
      dismissedAutoRef.current = false;
    }
  }, [filledCount, q.length]);

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
        className="text-muted-foreground/90 hover:text-muted-foreground hover:bg-muted/35 h-7 min-h-7 w-full justify-between gap-2 px-1.5 py-0 text-[11px] font-normal"
        onClick={toggleOpen}
        aria-expanded={open}
      >
        <span className="truncate">Preview</span>
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
        <div className="border-border/30 space-y-2.5 border-t pt-2 text-sm">
          <div>
            <p className="text-muted-foreground mb-1 text-xs font-medium uppercase">
              Question
            </p>
            <p className="whitespace-pre-wrap">
              {snippet ? (
                snippet
              ) : (
                <span className="text-muted-foreground italic">
                  No question yet
                </span>
              )}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground mb-1 text-xs font-medium uppercase">
              Options ({filledRows.length})
            </p>
            {filledRows.length > 0 ? (
              <ol className="list-decimal space-y-1 pl-5">
                {filledRows.map((row) => (
                  <li key={row.id} className="break-words">
                    {row.text}
                  </li>
                ))}
              </ol>
            ) : (
              <span className="text-muted-foreground italic">
                No options yet
              </span>
            )}
          </div>
          <p className="text-muted-foreground text-xs">Mode: {pollTypeLabel}</p>
          <div className="flex flex-wrap items-center gap-2">
            {tagsLine.trim() ? (
              <span className="text-muted-foreground text-xs">
                Tags: {tagsLine.trim()}
              </span>
            ) : (
              <span className="text-muted-foreground text-xs">Tags: none</span>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
