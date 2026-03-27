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

const SNIPPET_LEN = 160;

export interface PollOutputPanelProps {
  question: string;
  options: string[];
  /** Stable ids aligned with `options` (same length). */
  optionRowIds: string[];
  tagsLine: string;
  pollTypeLabel: string;
}

export function PollOutputPanel({
  question,
  options,
  optionRowIds,
  tagsLine,
  pollTypeLabel,
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

  return (
    <div className="border-border/60 border-t pt-2">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="text-muted-foreground hover:text-foreground hover:bg-muted/40 -mx-1 h-8 w-full justify-between px-2 text-xs font-normal"
        onClick={toggleOpen}
        aria-expanded={open}
      >
        Preview
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
        <div className="border-border/50 space-y-3 border-t py-3 text-sm">
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
