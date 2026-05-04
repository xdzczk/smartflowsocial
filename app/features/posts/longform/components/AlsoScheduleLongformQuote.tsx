/**
 * Schedule quote follow-ups for longform (publish rail  -  compact list UI).
 */

import { useState } from "react";

import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";
import { FollowUpDelayUnitSelect } from "~/features/posts/components/follow-up/FollowUpDelayUnitSelect";
import { RailSectionHeader } from "~/features/posts/components/publishing-rail/RailSectionHeader";
import {
  RAIL_SETTINGS_ROW,
  railFieldClassNames,
} from "~/features/posts/components/publishing-rail/tokens";
import type { LongformQuoteEntry } from "~/features/posts/hooks/useLongFormSubmission";
import { cn } from "~/lib/utils";

interface AlsoScheduleLongformQuoteProps {
  quoteEntries: LongformQuoteEntry[];
  onQuoteEntriesChange: React.Dispatch<
    React.SetStateAction<LongformQuoteEntry[]>
  >;
  disabled?: boolean;
}

const newQuote = (): LongformQuoteEntry => ({
  id: crypto.randomUUID(),
  value: 2,
  unit: "hours",
  caption: "",
});

const quoteRowClass = cn(RAIL_SETTINGS_ROW, "min-h-0 py-1");

export function AlsoScheduleLongformQuote({
  quoteEntries,
  onQuoteEntriesChange,
  disabled = false,
}: AlsoScheduleLongformQuoteProps) {
  const [editingCaptionId, setEditingCaptionId] = useState<string | null>(null);

  return (
    <div className="space-y-2">
      <RailSectionHeader>Quotes</RailSectionHeader>
      {quoteEntries.length === 0 ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 w-full text-xs"
          disabled={disabled}
          onClick={() => onQuoteEntriesChange((prev) => [...prev, newQuote()])}
        >
          Add quote
        </Button>
      ) : (
        <>
          <ul className="divide-border/50 divide-y">
            {quoteEntries.map((entry, idx) => {
              const captionAdded = entry.caption.trim().length > 0;
              const editing = editingCaptionId === entry.id;
              return (
                <li key={entry.id} className="space-y-1.5 py-2 first:pt-0">
                  <div className={quoteRowClass}>
                    <span className="text-text text-xs font-medium">
                      Quote #{idx + 1}
                    </span>
                    <Button
                      type="button"
                      variant="link"
                      className="text-text-secondary hover:text-text h-auto p-0 text-xs font-normal"
                      disabled={disabled}
                      onClick={() =>
                        onQuoteEntriesChange((prev) =>
                          prev.filter((_, i) => i !== idx)
                        )
                      }
                    >
                      Remove
                    </Button>
                  </div>
                  <div className={quoteRowClass}>
                    <span className="text-text-secondary w-12 shrink-0 text-xs">
                      After
                    </span>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Input
                        type="number"
                        min={1}
                        value={entry.value}
                        onChange={(e) => {
                          const v = Math.max(
                            1,
                            parseInt(e.target.value, 10) || 1
                          );
                          onQuoteEntriesChange((prev) => {
                            const next = [...prev];
                            const cur = next[idx]!;
                            next[idx] = { ...cur, value: v };
                            return next;
                          });
                        }}
                        disabled={disabled}
                        className={cn("h-9 w-16", railFieldClassNames)}
                        aria-label="Delay value"
                      />
                      <FollowUpDelayUnitSelect
                        value={entry.unit}
                        onValueChange={(unit) =>
                          onQuoteEntriesChange((prev) => {
                            const next = [...prev];
                            const cur = next[idx]!;
                            next[idx] = { ...cur, unit };
                            return next;
                          })
                        }
                        disabled={disabled}
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <div className={quoteRowClass}>
                      <span className="text-text-secondary text-xs">
                        Caption
                      </span>
                      <span className="text-text min-w-0 flex-1 truncate text-right text-xs">
                        {captionAdded ? "Added" : "None"}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-text-secondary h-7 shrink-0 px-2 text-xs"
                        disabled={disabled}
                        onClick={() =>
                          setEditingCaptionId((id) =>
                            id === entry.id ? null : entry.id
                          )
                        }
                      >
                        {editing ? "Done" : "Edit"}
                      </Button>
                    </div>
                    {editing ? (
                      <Textarea
                        value={entry.caption}
                        onChange={(e) =>
                          onQuoteEntriesChange((prev) => {
                            const next = [...prev];
                            const cur = next[idx]!;
                            next[idx] = {
                              ...cur,
                              caption: e.target.value,
                            };
                            return next;
                          })
                        }
                        placeholder="Optional comment…"
                        rows={3}
                        disabled={disabled}
                        className={cn(
                          "min-h-[4.5rem] text-xs",
                          railFieldClassNames
                        )}
                      />
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 w-full text-xs"
            disabled={disabled}
            onClick={() =>
              onQuoteEntriesChange((prev) => [...prev, newQuote()])
            }
          >
            Add quote
          </Button>
        </>
      )}
    </div>
  );
}
