/**
 * Presentational schedule field: datetime input, time chips, random window.
 */

import type { Control, FieldValues } from "react-hook-form";

import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Switch } from "~/components/ui/switch";
import {
  RailSettingsRow,
  railFieldClassNames,
  railSelectTriggerClassNames,
} from "~/features/posts/components/publishing-rail";
import { SchedulingSection } from "~/features/posts/components/SchedulingSection";
import type { QueueType } from "~/features/posts/types";
import type { DelayAfterMain } from "~/features/posts/utils/delay-after-main";
import { getNowForDateTimeLocal } from "~/lib/temporal";
import { cn } from "~/lib/utils";

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
  postOptionsOpen?: boolean;
  onPostOptionsOpenChange?: (open: boolean) => void;
  isThreadMode?: boolean;
  onThreadModeChange?: (v: boolean) => void;
  isRecyclable?: boolean;
  onRecyclableChange?: (v: boolean) => void;
  control?: Control<T>;
  disabled?: boolean;
  userTimezone?: string;
  postOptionsSummary?: string;
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
  disabled = false,
  userTimezone = "UTC",
  postOptionsSummary: _postOptionsSummary,
  showThreadModeToggle: _showThreadModeToggle = true,
  layout = "full",
  omitScheduleInput = false,
}: ComposerScheduleFieldProps<T>) {
  const minDatetime = getNowForDateTimeLocal(userTimezone);

  if (layout === "minimal") {
    return (
      <div className="flex flex-col gap-2">
        <Label htmlFor="scheduledFor">Publish time</Label>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Input
            type="datetime-local"
            id="scheduledFor"
            className={railFieldClassNames}
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
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {!omitScheduleInput ? (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Input
            type="datetime-local"
            id="scheduledFor"
            aria-label="Publish date and time"
            className={railFieldClassNames}
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
      <RailSettingsRow
        labelFor="schedule-randomize-switch"
        label="Randomize publish time"
        control={
          <Switch
            id="schedule-randomize-switch"
            checked={scheduleRandomWindowMinutes > 0}
            onCheckedChange={(on) => {
              if (!on) {
                onScheduleRandomWindowMinutesChange(0);
              } else {
                onScheduleRandomWindowMinutesChange(
                  scheduleRandomWindowMinutes > 0
                    ? scheduleRandomWindowMinutes
                    : 15
                );
              }
            }}
            disabled={disabled}
          />
        }
      />
      {scheduleRandomWindowMinutes > 0 ? (
        <div className="space-y-1.5">
          <Label
            htmlFor="scheduleRandomWindowMinutes"
            className="text-muted-foreground text-xs font-medium"
          >
            Window
          </Label>
          <Select
            value={String(scheduleRandomWindowMinutes)}
            onValueChange={(v) =>
              onScheduleRandomWindowMinutesChange(Number(v))
            }
          >
            <SelectTrigger
              id="scheduleRandomWindowMinutes"
              className={cn(railSelectTriggerClassNames)}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="5">±5 minutes</SelectItem>
              <SelectItem value="10">±10 minutes</SelectItem>
              <SelectItem value="15">±15 minutes</SelectItem>
              <SelectItem value="30">±30 minutes</SelectItem>
              <SelectItem value="60">±1 hour</SelectItem>
            </SelectContent>
          </Select>
        </div>
      ) : null}
    </div>
  );
}
