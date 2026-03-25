/**
 * Presentational schedule field: datetime input, time chips, random window, post options.
 */

import { ChevronDown } from "lucide-react";
import {
  Controller,
  type Control,
  type FieldValues,
  type Path,
} from "react-hook-form";

import { Checkbox } from "~/components/ui/checkbox";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Separator } from "~/components/ui/separator";
import { AlsoScheduleBlock } from "~/features/posts/components/AlsoScheduleBlock";
import { SchedulingSection } from "~/features/posts/components/SchedulingSection";
import type { QueueType, RepostConditions } from "~/features/posts/types";
import type { DelayAfterMain } from "~/features/posts/utils/delay-after-main";
import { INLINE_ICON_STROKE } from "~/lib/icon-constants";
import { getNowForDateTimeLocal } from "~/lib/temporal";

export interface RepostDelayItem {
  id: string;
  value: number;
  unit: DelayAfterMain["unit"];
}

export interface QuoteEntryItem {
  id: string;
  value: number;
  unit: DelayAfterMain["unit"];
  caption: string;
}

export interface ComposerScheduleFieldProps<
  T extends FieldValues = FieldValues,
> {
  /** Current scheduledFor value (datetime-local string) */
  value: string;
  onValueChange: (v: string) => void;
  scheduleIntervals: number[];
  queueTypes: Array<string | QueueType>;
  selectedQueue: string;
  onScheduleIntervalClick: (intervalHours: string | number) => void;
  onCalculateNextSlot: () => void;
  scheduleRandomWindowMinutes: number;
  onScheduleRandomWindowMinutesChange: (v: number) => void;
  postOptionsOpen: boolean;
  onPostOptionsOpenChange: (open: boolean) => void;
  isThreadMode: boolean;
  onThreadModeChange: (v: boolean) => void;
  /** Recyclable checkbox - controlled via form */
  isRecyclable: boolean;
  onRecyclableChange: (v: boolean) => void;
  control?: Control<T>;
  alsoScheduleRepost: boolean;
  onAlsoScheduleRepostChange: (v: boolean) => void;
  repostDelayList: RepostDelayItem[];
  onRepostDelayListChange: React.Dispatch<
    React.SetStateAction<RepostDelayItem[]>
  >;
  repostConditions: RepostConditions | null;
  onRepostConditionsChange: (v: RepostConditions | null) => void;
  alsoScheduleQuote: boolean;
  onAlsoScheduleQuoteChange: (v: boolean) => void;
  quoteEntries: QuoteEntryItem[];
  onQuoteEntriesChange: React.Dispatch<React.SetStateAction<QuoteEntryItem[]>>;
  disabled?: boolean;
  userTimezone?: string;
  /** Summary line for post options button (e.g. "Thread · 2 segments") */
  postOptionsSummary?: string;
  /** When false, thread mode is controlled elsewhere (e.g. new post tabs). */
  showThreadModeToggle?: boolean;
  /** minimal: datetime input only. full: entire schedule UI (default). */
  layout?: "full" | "minimal";
  /** When layout is full, skip the datetime block (use when minimal schedule is shown above). */
  omitScheduleInput?: boolean;
}

export function ComposerScheduleField<T extends FieldValues = FieldValues>({
  value,
  onValueChange,
  scheduleIntervals,
  queueTypes,
  selectedQueue,
  onScheduleIntervalClick,
  onCalculateNextSlot,
  scheduleRandomWindowMinutes,
  onScheduleRandomWindowMinutesChange,
  postOptionsOpen,
  onPostOptionsOpenChange,
  isThreadMode,
  onThreadModeChange,
  isRecyclable,
  onRecyclableChange,
  control,
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
  userTimezone = "UTC",
  postOptionsSummary,
  showThreadModeToggle = true,
  layout = "full",
  omitScheduleInput = false,
}: ComposerScheduleFieldProps<T>) {
  const minDatetime = getNowForDateTimeLocal(userTimezone);

  if (layout === "minimal") {
    return (
      <div className="flex flex-col gap-2">
        <Label htmlFor="scheduledFor">Schedule for later</Label>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Input
            type="datetime-local"
            id="scheduledFor"
            value={value}
            onChange={(e) => {
              const v = e.target.value;
              const clamped = v && v < minDatetime ? minDatetime : v;
              onValueChange(clamped);
            }}
            min={minDatetime}
            disabled={disabled}
          />
        </div>
        <p className="text-muted-foreground text-xs">
          Leave empty to publish immediately. Queue, tags, slot helpers, and
          threads are in Advanced posting settings.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {!omitScheduleInput ? (
        <>
          <Label htmlFor="scheduledFor">Schedule for later</Label>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Input
              type="datetime-local"
              id="scheduledFor"
              value={value}
              onChange={(e) => {
                const v = e.target.value;
                const clamped = v && v < minDatetime ? minDatetime : v;
                onValueChange(clamped);
              }}
              min={minDatetime}
              disabled={disabled}
            />
          </div>
        </>
      ) : null}
      <SchedulingSection
        scheduledFor={value}
        onScheduledForChange={onValueChange}
        scheduleIntervals={scheduleIntervals}
        queueTypes={queueTypes}
        selectedQueue={selectedQueue}
        onScheduleIntervalClick={onScheduleIntervalClick}
        onCalculateNextSlot={onCalculateNextSlot}
        disabled={disabled}
        showTimeInput={false}
        userTimezone={userTimezone}
      />
      <div className="space-y-2">
        <Label htmlFor="scheduleRandomWindowMinutes">
          Post at random time within ± minutes
        </Label>
        <Select
          value={String(scheduleRandomWindowMinutes)}
          onValueChange={(v) => onScheduleRandomWindowMinutesChange(Number(v))}
        >
          <SelectTrigger id="scheduleRandomWindowMinutes">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="0">Off (exact time)</SelectItem>
            <SelectItem value="5">±5 minutes</SelectItem>
            <SelectItem value="10">±10 minutes</SelectItem>
            <SelectItem value="15">±15 minutes</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="border-border rounded-lg border">
        <button
          type="button"
          onClick={() => onPostOptionsOpenChange(!postOptionsOpen)}
          aria-expanded={postOptionsOpen}
          className="text-muted-foreground hover:text-foreground flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors"
        >
          <span>Post options</span>
          {!postOptionsOpen && postOptionsSummary ? (
            <span className="truncate text-xs">{postOptionsSummary}</span>
          ) : null}
          <ChevronDown
            className={`h-4 w-4 shrink-0 transition-transform ${postOptionsOpen ? "rotate-180" : ""}`}
            strokeWidth={INLINE_ICON_STROKE}
            aria-hidden
          />
        </button>
        {postOptionsOpen ? (
          <>
            <Separator className="my-2" />
            <div className="border-border space-y-3 px-3 pb-3">
              {showThreadModeToggle ? (
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="thread-mode"
                    checked={isThreadMode}
                    onCheckedChange={(c) => onThreadModeChange(c === true)}
                    disabled={disabled}
                  />
                  <Label htmlFor="thread-mode" className="text-sm">
                    Thread (multiple posts in sequence)
                  </Label>
                </div>
              ) : null}
              {control ? (
                <div className="flex items-center gap-2">
                  <Controller
                    name={"isRecyclable" as Path<T>}
                    control={control}
                    render={({ field }) => (
                      <Checkbox
                        id="isRecyclable"
                        checked={!!field.value}
                        onCheckedChange={field.onChange}
                        disabled={disabled}
                      />
                    )}
                  />
                  <Label
                    htmlFor="isRecyclable"
                    className="text-muted-foreground dark:text-foreground text-sm"
                  >
                    Make this post recyclable
                  </Label>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="isRecyclable"
                    checked={isRecyclable}
                    onCheckedChange={(c) => onRecyclableChange(c === true)}
                    disabled={disabled}
                  />
                  <Label
                    htmlFor="isRecyclable"
                    className="text-muted-foreground dark:text-foreground text-sm"
                  >
                    Make this post recyclable
                  </Label>
                </div>
              )}
              <AlsoScheduleBlock
                alsoScheduleRepost={alsoScheduleRepost}
                onAlsoScheduleRepostChange={onAlsoScheduleRepostChange}
                repostDelayList={repostDelayList}
                onRepostDelayListChange={onRepostDelayListChange}
                repostConditions={repostConditions}
                onRepostConditionsChange={onRepostConditionsChange}
                alsoScheduleQuote={alsoScheduleQuote}
                onAlsoScheduleQuoteChange={onAlsoScheduleQuoteChange}
                quoteEntries={quoteEntries}
                onQuoteEntriesChange={onQuoteEntriesChange}
                disabled={disabled}
              />
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
