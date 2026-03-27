/**
 * Collapsible compact preview for poll drafts: question snippet, options, tags.
 */

import { ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";

import { Badge } from "~/components/ui/badge";
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
  isRecyclable: boolean;
  pollTypeLabel: string;
}

export function PollOutputPanel({
  question,
  options,
  optionRowIds,
  tagsLine,
  isRecyclable,
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
        <div className="border-border space-y-3 border-t p-3 text-sm">
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
