/**
 * Follow-up actions after the main post publishes (publish rail — compact list UI).
 */

import { useState } from "react";

import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";
import { countRepostConditionRules } from "~/features/posts/components/follow-up/follow-up-summary";
import { FollowUpDelayUnitSelect } from "~/features/posts/components/follow-up/FollowUpDelayUnitSelect";
import { FollowUpRepostConditionsEditor } from "~/features/posts/components/follow-up/FollowUpRepostConditionsEditor";
import { RailSectionHeader } from "~/features/posts/components/publishing-rail/RailSectionHeader";
import {
  RAIL_SETTINGS_ROW,
  railFieldClassNames,
} from "~/features/posts/components/publishing-rail/tokens";
import { cn } from "~/lib/utils";

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

export interface AlsoScheduleBlockProps {
  repostDelayList: RepostItem[];
  onRepostDelayListChange: React.Dispatch<React.SetStateAction<RepostItem[]>>;
  repostConditions?: RepostConditions | null;
  onRepostConditionsChange?: (value: RepostConditions | null) => void;
  quoteEntries: QuoteEntry[];
  onQuoteEntriesChange: React.Dispatch<React.SetStateAction<QuoteEntry[]>>;
  disabled?: boolean;
}

const newRepost = (): RepostItem => ({
  id: crypto.randomUUID(),
  value: 2,
  unit: "hours",
});

const newQuote = (): QuoteEntry => ({
  id: crypto.randomUUID(),
  value: 2,
  unit: "hours",
  caption: "",
});

const followUpSettingsRowClass = cn(RAIL_SETTINGS_ROW, "min-h-0 py-1");

export function AlsoScheduleBlock({
  repostDelayList,
  onRepostDelayListChange,
  repostConditions,
  onRepostConditionsChange,
  quoteEntries,
  onQuoteEntriesChange,
  disabled = false,
}: AlsoScheduleBlockProps) {
  const [conditionsOpen, setConditionsOpen] = useState(false);
  const [editingCaptionId, setEditingCaptionId] = useState<string | null>(null);

  const ruleCount = countRepostConditionRules(repostConditions);
  const hasReposts = repostDelayList.length > 0;

  return (
    <div className="space-y-0">
      <div className="space-y-2">
        <RailSectionHeader>Reposts</RailSectionHeader>
        {!hasReposts ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 w-full text-xs"
            disabled={disabled}
            onClick={() =>
              onRepostDelayListChange((prev) => [...prev, newRepost()])
            }
          >
            Add repost
          </Button>
        ) : (
          <>
            <ul className="divide-border/50 divide-y">
              {repostDelayList.map((item, idx) => (
                <li key={item.id} className="space-y-1.5 py-2 first:pt-0">
                  <div className={followUpSettingsRowClass}>
                    <span className="text-foreground text-xs font-medium">
                      Repost #{idx + 1}
                    </span>
                    <Button
                      type="button"
                      variant="link"
                      className="text-muted-foreground hover:text-foreground h-auto p-0 text-xs font-normal"
                      disabled={disabled}
                      onClick={() =>
                        onRepostDelayListChange((prev) =>
                          prev.filter((_, i) => i !== idx)
                        )
                      }
                    >
                      Remove
                    </Button>
                  </div>
                  <div className={followUpSettingsRowClass}>
                    <span className="text-muted-foreground w-12 shrink-0 text-xs">
                      After
                    </span>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Input
                        type="number"
                        min={1}
                        value={item.value}
                        onChange={(e) => {
                          const v = Math.max(
                            1,
                            parseInt(e.target.value, 10) || 1
                          );
                          onRepostDelayListChange((prev) => {
                            const next = [...prev];
                            next[idx] = { ...next[idx]!, value: v };
                            return next;
                          });
                        }}
                        disabled={disabled}
                        className={cn("h-9 w-16", railFieldClassNames)}
                        aria-label="Delay value"
                      />
                      <FollowUpDelayUnitSelect
                        value={item.unit}
                        onValueChange={(unit) =>
                          onRepostDelayListChange((prev) => {
                            const next = [...prev];
                            next[idx] = { ...next[idx]!, unit };
                            return next;
                          })
                        }
                        disabled={disabled}
                      />
                    </div>
                  </div>
                </li>
              ))}
            </ul>
            {onRepostConditionsChange ? (
              <div className="space-y-1.5">
                <div className={followUpSettingsRowClass}>
                  <span className="text-muted-foreground text-xs">
                    Conditions
                  </span>
                  <span className="text-foreground min-w-0 flex-1 truncate text-right text-xs">
                    {ruleCount === 0 ? "None" : `${ruleCount} rules`}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground h-7 shrink-0 px-2 text-xs"
                    disabled={disabled}
                    onClick={() => setConditionsOpen((o) => !o)}
                  >
                    {conditionsOpen ? "Done" : "Edit"}
                  </Button>
                </div>
                {conditionsOpen ? (
                  <FollowUpRepostConditionsEditor
                    repostConditions={repostConditions ?? null}
                    onRepostConditionsChange={onRepostConditionsChange}
                    disabled={disabled}
                  />
                ) : null}
              </div>
            ) : null}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 w-full text-xs"
              disabled={disabled}
              onClick={() =>
                onRepostDelayListChange((prev) => [...prev, newRepost()])
              }
            >
              Add repost
            </Button>
          </>
        )}
      </div>

      <div className="border-border/60 mt-3 space-y-2 border-t pt-3">
        <RailSectionHeader>Quotes</RailSectionHeader>
        {quoteEntries.length === 0 ? (
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
        ) : (
          <>
            <ul className="divide-border/50 divide-y">
              {quoteEntries.map((entry, idx) => {
                const captionAdded = entry.caption.trim().length > 0;
                const editing = editingCaptionId === entry.id;
                return (
                  <li key={entry.id} className="space-y-1.5 py-2 first:pt-0">
                    <div className={followUpSettingsRowClass}>
                      <span className="text-foreground text-xs font-medium">
                        Quote #{idx + 1}
                      </span>
                      <Button
                        type="button"
                        variant="link"
                        className="text-muted-foreground hover:text-foreground h-auto p-0 text-xs font-normal"
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
                    <div className={followUpSettingsRowClass}>
                      <span className="text-muted-foreground w-12 shrink-0 text-xs">
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
                      <div className={followUpSettingsRowClass}>
                        <span className="text-muted-foreground text-xs">
                          Caption
                        </span>
                        <span className="text-foreground min-w-0 flex-1 truncate text-right text-xs">
                          {captionAdded ? "Added" : "None"}
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="text-muted-foreground h-7 shrink-0 px-2 text-xs"
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
    </div>
  );
}
