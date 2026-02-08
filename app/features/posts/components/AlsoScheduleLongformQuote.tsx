/**
 * Also schedule a quote of this article as a kind 1 note.
 * Longform-specific: quote only (no repost). Used in New Longform Publish Panel.
 */

import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Separator } from "~/components/ui/separator";
import { Textarea } from "~/components/ui/textarea";

import type { LongformQuoteEntry } from "../hooks/useLongFormSubmission";
import type { DelayAfterMain } from "../utils/delay-after-main";

interface AlsoScheduleLongformQuoteProps {
  alsoScheduleQuote: boolean;
  onAlsoScheduleQuoteChange: (value: boolean) => void;
  quoteEntries: LongformQuoteEntry[];
  onQuoteEntriesChange: React.Dispatch<
    React.SetStateAction<LongformQuoteEntry[]>
  >;
  disabled?: boolean;
}

export function AlsoScheduleLongformQuote({
  alsoScheduleQuote,
  onAlsoScheduleQuoteChange,
  quoteEntries,
  onQuoteEntriesChange,
  disabled = false,
}: AlsoScheduleLongformQuoteProps) {
  return (
    <>
      <Separator className="my-4" />
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="alsoScheduleLongformQuote"
            checked={alsoScheduleQuote}
            onChange={(e) => onAlsoScheduleQuoteChange(e.target.checked)}
            disabled={disabled}
            className="border-border accent-checkbox focus:ring-ring h-4 w-4 rounded"
          />
          <Label
            htmlFor="alsoScheduleLongformQuote"
            className="text-muted-foreground dark:text-foreground cursor-pointer text-sm"
          >
            Also schedule a quote of this article as a kind 1 note
          </Label>
        </div>
        {alsoScheduleQuote ? (
          <div className="ml-6 space-y-3">
            <Label className="text-muted-foreground text-xs">
              Quote times and captions (one per quote)
            </Label>
            {quoteEntries.map((entry, idx) => (
              <div
                key={entry.id}
                className="border-border space-y-2 rounded border p-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Label className="text-muted-foreground text-xs">
                    When after main
                  </Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      onQuoteEntriesChange((prev) =>
                        prev.length > 1
                          ? prev.filter((_, i) => i !== idx)
                          : prev
                      )
                    }
                    disabled={disabled || quoteEntries.length <= 1}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    Remove
                  </Button>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Input
                    type="number"
                    min={1}
                    value={entry.value}
                    onChange={(e) => {
                      const v = Math.max(1, parseInt(e.target.value, 10) || 1);
                      onQuoteEntriesChange((prev) => {
                        const next = [...prev];
                        const current = next[idx]!;
                        next[idx] = { ...current, value: v };
                        return next;
                      });
                    }}
                    disabled={disabled}
                    className="w-20"
                    aria-label="Delay value"
                  />
                  <select
                    value={entry.unit}
                    onChange={(e) => {
                      const unit = e.target.value as DelayAfterMain["unit"];
                      onQuoteEntriesChange((prev) => {
                        const next = [...prev];
                        const current = next[idx]!;
                        next[idx] = { ...current, unit };
                        return next;
                      });
                    }}
                    disabled={disabled}
                    className="border-border bg-background text-foreground h-9 w-24 rounded-md border px-2 text-sm"
                    aria-label="Hours or minutes"
                  >
                    <option value="hours">hours</option>
                    <option value="minutes">minutes</option>
                  </select>
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs">
                    Caption (optional)
                  </Label>
                  <Textarea
                    value={entry.caption}
                    onChange={(e) =>
                      onQuoteEntriesChange((prev) => {
                        const next = [...prev];
                        const current = next[idx]!;
                        next[idx] = { ...current, caption: e.target.value };
                        return next;
                      })
                    }
                    placeholder="Add your comment..."
                    rows={2}
                    disabled={disabled}
                    className="mt-1"
                  />
                </div>
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                onQuoteEntriesChange((prev) => [
                  ...prev,
                  {
                    id: crypto.randomUUID(),
                    value: 24,
                    unit: "hours" as const,
                    caption: "",
                  },
                ])
              }
              disabled={disabled}
            >
              Add another quote
            </Button>
          </div>
        ) : null}
      </div>
    </>
  );
}
