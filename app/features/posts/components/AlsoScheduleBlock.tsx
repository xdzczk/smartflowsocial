/**
 * Also schedule repost / quote of this post.
 * Single target: the post being published. Clear block instead of checkbox soup.
 */

import { Button } from "~/components/ui/button";
import { Checkbox } from "~/components/ui/checkbox";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";

import type { DelayAfterMain } from "../utils/delay-after-main";

interface RepostItem {
  id: string;
  value: number;
  unit: DelayAfterMain["unit"];
}

interface QuoteEntry {
  id: string;
  value: number;
  unit: DelayAfterMain["unit"];
  caption: string;
}

interface AlsoScheduleBlockProps {
  alsoScheduleRepost: boolean;
  onAlsoScheduleRepostChange: (value: boolean) => void;
  repostDelayList: RepostItem[];
  onRepostDelayListChange: React.Dispatch<React.SetStateAction<RepostItem[]>>;
  alsoScheduleQuote: boolean;
  onAlsoScheduleQuoteChange: (value: boolean) => void;
  quoteEntries: QuoteEntry[];
  onQuoteEntriesChange: React.Dispatch<React.SetStateAction<QuoteEntry[]>>;
  disabled?: boolean;
}

export function AlsoScheduleBlock({
  alsoScheduleRepost,
  onAlsoScheduleRepostChange,
  repostDelayList,
  onRepostDelayListChange,
  alsoScheduleQuote,
  onAlsoScheduleQuoteChange,
  quoteEntries,
  onQuoteEntriesChange,
  disabled = false,
}: AlsoScheduleBlockProps) {
  return (
    <div className="border-border mt-4 space-y-4 border-t pt-4">
      <h4 className="text-muted-foreground dark:text-foreground text-sm font-medium">
        Also schedule (repost or quote of this post)
      </h4>

      <div className="flex items-center gap-2">
        <Checkbox
          id="alsoScheduleRepost"
          checked={alsoScheduleRepost}
          onCheckedChange={(c) => onAlsoScheduleRepostChange(c === true)}
          disabled={disabled}
        />
        <Label
          htmlFor="alsoScheduleRepost"
          className="text-muted-foreground dark:text-foreground cursor-pointer text-sm"
        >
          Also schedule a repost of this post
        </Label>
      </div>
      {alsoScheduleRepost ? (
        <div className="ml-6 space-y-2">
          <Label className="text-muted-foreground text-xs">
            When after main post (one per repost)
          </Label>
          {repostDelayList.map((item, idx) => (
            <div key={item.id} className="flex flex-wrap items-center gap-2">
              <Input
                type="number"
                min={1}
                value={item.value}
                onChange={(e) => {
                  const v = Math.max(1, parseInt(e.target.value, 10) || 1);
                  onRepostDelayListChange((prev) => {
                    const next = [...prev];
                    next[idx] = { ...next[idx]!, value: v };
                    return next;
                  });
                }}
                disabled={disabled}
                className="w-20"
                aria-label="Delay value"
              />
              <select
                value={item.unit}
                onChange={(e) => {
                  const unit = e.target.value as DelayAfterMain["unit"];
                  onRepostDelayListChange((prev) => {
                    const next = [...prev];
                    next[idx] = { ...next[idx]!, unit };
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
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() =>
                  onRepostDelayListChange((prev) =>
                    prev.length > 1 ? prev.filter((_, i) => i !== idx) : prev
                  )
                }
                disabled={disabled || repostDelayList.length <= 1}
                className="text-muted-foreground hover:text-foreground"
              >
                Remove
              </Button>
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              onRepostDelayListChange((prev) => [
                ...prev,
                { id: crypto.randomUUID(), value: 24, unit: "hours" },
              ])
            }
            disabled={disabled}
          >
            Add another repost
          </Button>
        </div>
      ) : null}

      <div className="flex items-center gap-2">
        <Checkbox
          id="alsoScheduleQuote"
          checked={alsoScheduleQuote}
          onCheckedChange={(c) => onAlsoScheduleQuoteChange(c === true)}
          disabled={disabled}
        />
        <Label
          htmlFor="alsoScheduleQuote"
          className="text-muted-foreground dark:text-foreground cursor-pointer text-sm"
        >
          Also schedule a quote of this post
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
                      prev.length > 1 ? prev.filter((_, i) => i !== idx) : prev
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
                  unit: "hours",
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
  );
}
