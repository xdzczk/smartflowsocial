/**
 * Follow-up actions after the main post publishes.
 */

import { Button } from "~/components/ui/button";
import { Checkbox } from "~/components/ui/checkbox";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";

import type { RepostConditions } from "../types";
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
  repostConditions?: RepostConditions | null;
  onRepostConditionsChange?: (value: RepostConditions | null) => void;
  alsoScheduleQuote: boolean;
  onAlsoScheduleQuoteChange: (value: boolean) => void;
  quoteEntries: QuoteEntry[];
  onQuoteEntriesChange: React.Dispatch<React.SetStateAction<QuoteEntry[]>>;
  disabled?: boolean;
}

function toNum(val: string): number | undefined {
  const n = parseInt(val, 10);
  return val.trim() === ""
    ? undefined
    : Number.isNaN(n)
      ? undefined
      : Math.max(0, n);
}

export function AlsoScheduleBlock({
  alsoScheduleRepost,
  onAlsoScheduleRepostChange,
  repostDelayList,
  onRepostDelayListChange,
  repostConditions,
  onRepostConditionsChange,
  alsoScheduleQuote,
  onAlsoScheduleQuoteChange,
  quoteEntries,
  onQuoteEntriesChange,
  disabled = false,
}: AlsoScheduleBlockProps) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <h4 className="text-muted-foreground dark:text-foreground text-sm font-medium">
          Repost later
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
            Schedule repost
          </Label>
        </div>
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
          {onRepostConditionsChange ? (
            <div className="border-border mt-3 space-y-2 rounded border p-3">
              <Label className="text-muted-foreground text-xs">
                Only repost if original gets (optional)
              </Label>
              <div className="flex flex-wrap items-center gap-3 gap-y-2">
                <div className="flex items-center gap-1.5">
                  <Label className="text-muted-foreground text-xs whitespace-nowrap">
                    Reactions
                  </Label>
                  <Input
                    type="number"
                    min={0}
                    placeholder="—"
                    value={repostConditions?.minReactions ?? ""}
                    onChange={(e) => {
                      const v = toNum(e.target.value);
                      onRepostConditionsChange(
                        v !== undefined
                          ? { ...repostConditions, minReactions: v }
                          : (() => {
                              const next = { ...repostConditions };
                              delete next.minReactions;
                              return Object.keys(next).length > 0 ? next : null;
                            })()
                      );
                    }}
                    disabled={disabled}
                    className="w-20"
                    aria-label="Min reactions"
                  />
                </div>
                <div className="flex items-center gap-1.5">
                  <Label className="text-muted-foreground text-xs whitespace-nowrap">
                    Zaps
                  </Label>
                  <Input
                    type="number"
                    min={0}
                    placeholder="—"
                    value={repostConditions?.minZaps ?? ""}
                    onChange={(e) => {
                      const v = toNum(e.target.value);
                      onRepostConditionsChange(
                        v !== undefined
                          ? { ...repostConditions, minZaps: v }
                          : (() => {
                              const next = { ...repostConditions };
                              delete next.minZaps;
                              return Object.keys(next).length > 0 ? next : null;
                            })()
                      );
                    }}
                    disabled={disabled}
                    className="w-20"
                    aria-label="Min zaps"
                  />
                </div>
                <div className="flex items-center gap-1.5">
                  <Label className="text-muted-foreground text-xs whitespace-nowrap">
                    Comments
                  </Label>
                  <Input
                    type="number"
                    min={0}
                    placeholder="—"
                    value={repostConditions?.minComments ?? ""}
                    onChange={(e) => {
                      const v = toNum(e.target.value);
                      onRepostConditionsChange(
                        v !== undefined
                          ? { ...repostConditions, minComments: v }
                          : (() => {
                              const next = { ...repostConditions };
                              delete next.minComments;
                              return Object.keys(next).length > 0 ? next : null;
                            })()
                      );
                    }}
                    disabled={disabled}
                    className="w-20"
                    aria-label="Min comments"
                  />
                </div>
                <div className="flex items-center gap-1.5">
                  <Label className="text-muted-foreground text-xs whitespace-nowrap">
                    Reposts
                  </Label>
                  <Input
                    type="number"
                    min={0}
                    placeholder="—"
                    value={repostConditions?.minReposts ?? ""}
                    onChange={(e) => {
                      const v = toNum(e.target.value);
                      onRepostConditionsChange(
                        v !== undefined
                          ? { ...repostConditions, minReposts: v }
                          : (() => {
                              const next = { ...repostConditions };
                              delete next.minReposts;
                              return Object.keys(next).length > 0 ? next : null;
                            })()
                      );
                    }}
                    disabled={disabled}
                    className="w-20"
                    aria-label="Min reposts"
                  />
                </div>
                <div className="flex items-center gap-1.5">
                  <Label className="text-muted-foreground text-xs whitespace-nowrap">
                    Sats
                  </Label>
                  <Input
                    type="number"
                    min={0}
                    placeholder="—"
                    value={repostConditions?.minSats ?? ""}
                    onChange={(e) => {
                      const v = toNum(e.target.value);
                      onRepostConditionsChange(
                        v !== undefined
                          ? { ...repostConditions, minSats: v }
                          : (() => {
                              const next = { ...repostConditions };
                              delete next.minSats;
                              return Object.keys(next).length > 0 ? next : null;
                            })()
                      );
                    }}
                    disabled={disabled}
                    className="w-24"
                    aria-label="Min sats"
                  />
                </div>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="space-y-2">
        <h4 className="text-muted-foreground dark:text-foreground text-sm font-medium">
          Quote later
        </h4>
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
            Schedule quote
          </Label>
        </div>
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
