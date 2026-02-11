/**
 * Compact "Also repost/quote" configurator for a single row in the bulk posts table.
 * Mirrors the single-post composer: multiple repost/quote entries with value + unit (and caption for quote).
 */

import { Button } from "~/components/ui/button";
import { Checkbox } from "~/components/ui/checkbox";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";

import type { DelayAfterMain } from "../utils/delay-after-main";

export interface RepostScheduleItem {
  id?: string;
  value: number;
  unit: DelayAfterMain["unit"];
}
export interface QuoteScheduleItem {
  id?: string;
  value: number;
  unit: DelayAfterMain["unit"];
  caption?: string;
}

const DEFAULT_REPOST: RepostScheduleItem = { value: 12, unit: "hours" };
const DEFAULT_QUOTE: QuoteScheduleItem = {
  value: 12,
  unit: "hours",
  caption: "",
};
function withId<T extends { id?: string }>(item: T): T & { id: string } {
  return { ...item, id: item.id ?? crypto.randomUUID() };
}

interface BulkAlsoScheduleCellProps {
  repostSchedules: RepostScheduleItem[];
  quoteSchedules: QuoteScheduleItem[];
  onRepostSchedulesChange: (list: RepostScheduleItem[]) => void;
  onQuoteSchedulesChange: (list: QuoteScheduleItem[]) => void;
  rowLabelId: string;
  disabled?: boolean;
}

export function BulkAlsoScheduleCell({
  repostSchedules,
  quoteSchedules,
  onRepostSchedulesChange,
  onQuoteSchedulesChange,
  rowLabelId,
  disabled = false,
}: BulkAlsoScheduleCellProps) {
  const hasRepost = repostSchedules.length > 0;
  const hasQuote = quoteSchedules.length > 0;

  return (
    <div className="min-w-[200px] space-y-3 text-xs">
      <div className="flex items-center gap-2">
        <Checkbox
          id={`${rowLabelId}-repost`}
          checked={hasRepost}
          onCheckedChange={(c) =>
            onRepostSchedulesChange(
              c === true ? [withId({ ...DEFAULT_REPOST })] : []
            )
          }
          disabled={disabled}
          aria-label="Also schedule repost(s)"
        />
        <Label
          htmlFor={`${rowLabelId}-repost`}
          className="text-muted-foreground cursor-pointer text-xs"
        >
          Also repost
        </Label>
      </div>
      {hasRepost ? (
        <div className="ml-5 space-y-1.5">
          {repostSchedules.map((item, idx) => {
            const key = item.id ?? `repost-${idx}-${item.value}-${item.unit}`;
            return (
              <div key={key} className="flex flex-wrap items-center gap-1">
                <Input
                  type="number"
                  min={1}
                  value={item.value}
                  onChange={(e) => {
                    const v = Math.max(1, parseInt(e.target.value, 10) || 1);
                    onRepostSchedulesChange(
                      repostSchedules.map((h, i) =>
                        i === idx ? { ...h, value: v } : h
                      )
                    );
                  }}
                  disabled={disabled}
                  className="h-8 w-14 text-xs"
                  aria-label="Delay value"
                />
                <select
                  value={item.unit}
                  onChange={(e) => {
                    const unit = e.target.value as DelayAfterMain["unit"];
                    onRepostSchedulesChange(
                      repostSchedules.map((h, i) =>
                        i === idx ? { ...h, unit } : h
                      )
                    );
                  }}
                  disabled={disabled}
                  className="border-border bg-background text-foreground h-8 w-20 rounded border px-1.5 text-xs"
                  aria-label="Unit"
                >
                  <option value="hours">hours</option>
                  <option value="minutes">minutes</option>
                </select>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 px-1.5 text-xs"
                  onClick={() =>
                    onRepostSchedulesChange(
                      repostSchedules.length > 1
                        ? repostSchedules.filter((_, i) => i !== idx)
                        : repostSchedules
                    )
                  }
                  disabled={disabled || repostSchedules.length <= 1}
                >
                  Remove
                </Button>
              </div>
            );
          })}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            onClick={() =>
              onRepostSchedulesChange([
                ...repostSchedules,
                withId({ ...DEFAULT_REPOST }),
              ])
            }
            disabled={disabled}
          >
            + Repost
          </Button>
        </div>
      ) : null}

      <div className="flex items-center gap-2">
        <Checkbox
          id={`${rowLabelId}-quote`}
          checked={hasQuote}
          onCheckedChange={(c) =>
            onQuoteSchedulesChange(
              c === true ? [withId({ ...DEFAULT_QUOTE })] : []
            )
          }
          disabled={disabled}
          aria-label="Also schedule quote(s)"
        />
        <Label
          htmlFor={`${rowLabelId}-quote`}
          className="text-muted-foreground cursor-pointer text-xs"
        >
          Also quote
        </Label>
      </div>
      {hasQuote ? (
        <div className="ml-5 space-y-1.5">
          {quoteSchedules.map((entry, idx) => {
            const key = entry.id ?? `quote-${idx}-${entry.value}-${entry.unit}`;
            return (
              <div
                key={key}
                className="border-border space-y-1 rounded border p-2"
              >
                <div className="flex flex-wrap items-center gap-1">
                  <Input
                    type="number"
                    min={1}
                    value={entry.value}
                    onChange={(e) => {
                      const v = Math.max(1, parseInt(e.target.value, 10) || 1);
                      onQuoteSchedulesChange(
                        quoteSchedules.map((h, i) =>
                          i === idx ? { ...h, value: v } : h
                        )
                      );
                    }}
                    disabled={disabled}
                    className="h-8 w-14 text-xs"
                    aria-label="Delay value"
                  />
                  <select
                    value={entry.unit}
                    onChange={(e) => {
                      const unit = e.target.value as DelayAfterMain["unit"];
                      onQuoteSchedulesChange(
                        quoteSchedules.map((h, i) =>
                          i === idx ? { ...h, unit } : h
                        )
                      );
                    }}
                    disabled={disabled}
                    className="border-border bg-background text-foreground h-8 w-20 rounded border px-1.5 text-xs"
                    aria-label="Quote delay unit"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 px-1.5 text-xs"
                    onClick={() =>
                      onQuoteSchedulesChange(
                        quoteSchedules.length > 1
                          ? quoteSchedules.filter((_, i) => i !== idx)
                          : quoteSchedules
                      )
                    }
                    disabled={disabled || quoteSchedules.length <= 1}
                  >
                    Remove
                  </Button>
                </div>
                <Textarea
                  value={entry.caption ?? ""}
                  onChange={(e) =>
                    onQuoteSchedulesChange(
                      quoteSchedules.map((h, i) =>
                        i === idx ? { ...h, caption: e.target.value } : h
                      )
                    )
                  }
                  placeholder="Caption (optional)"
                  rows={1}
                  disabled={disabled}
                  className="min-h-[60px] text-xs"
                />
              </div>
            );
          })}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            onClick={() =>
              onQuoteSchedulesChange([
                ...quoteSchedules,
                withId({ ...DEFAULT_QUOTE }),
              ])
            }
            disabled={disabled}
          >
            + Quote
          </Button>
        </div>
      ) : null}
    </div>
  );
}
