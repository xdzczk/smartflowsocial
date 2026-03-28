import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  RailChip,
  RailChipGroup,
  railFieldClassNames,
} from "~/features/posts/components/publishing-rail";
import {
  COMPOSER_QUICK_SCHEDULE_INTERVAL_HOURS,
  formatIntervalLabel,
} from "~/lib/schedule-intervals";
import { getNowForDateTimeLocal } from "~/lib/temporal";

import type { QueueType } from "../types";
interface SchedulingSectionProps {
  scheduledFor: string;
  onScheduledForChange: (value: string) => void;
  scheduleIntervals: number[];
  queueTypes: Array<string | QueueType>;
  selectedQueue: string;
  onScheduleIntervalClick: (intervalHours: string | number) => void;
  onCalculateNextSlot: () => void;
  disabled?: boolean;
  label?: string;
  showTimeInput?: boolean;
  className?: string;
  userTimezone?: string;
}

export function SchedulingSection({
  scheduledFor,
  onScheduledForChange,
  scheduleIntervals: _scheduleIntervals,
  queueTypes,
  selectedQueue,
  onScheduleIntervalClick,
  onCalculateNextSlot,
  disabled = false,
  label = "Schedule for later",
  showTimeInput = true,
  className = "",
  userTimezone = "UTC",
}: SchedulingSectionProps) {
  void _scheduleIntervals;
  // Find the currently selected queue type
  const selectedQueueType = queueTypes.find((qt) =>
    typeof qt === "string" ? qt === selectedQueue : qt.name === selectedQueue
  );

  const isSlotBasedQueue =
    selectedQueueType &&
    typeof selectedQueueType === "object" &&
    (selectedQueueType.scheduleType === "FIXED_SLOTS" ||
      selectedQueueType.scheduleType === "WEEKLY_SLOTS");

  return (
    <div className={className}>
      {showTimeInput ? (
        <div className="flex flex-col gap-2">
          <Label htmlFor="scheduledFor">{label}</Label>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Input
              type="datetime-local"
              id="scheduledFor"
              name="scheduledFor"
              className={railFieldClassNames}
              value={scheduledFor}
              onChange={(e) => {
                const v = e.target.value;
                const min = getNowForDateTimeLocal(userTimezone);
                onScheduledForChange(v && v < min ? min : v);
              }}
              min={getNowForDateTimeLocal(userTimezone)}
              disabled={disabled}
            />
          </div>
        </div>
      ) : null}

      <div
        className={
          isSlotBasedQueue ? "mt-2" : "mt-2 grid grid-cols-5 gap-1 sm:gap-1.5"
        }
      >
        {isSlotBasedQueue ? (
          <RailChipGroup className="w-full">
            <RailChip
              type="button"
              className="w-full min-w-0"
              onClick={onCalculateNextSlot}
              disabled={disabled}
            >
              Next slot
            </RailChip>
          </RailChipGroup>
        ) : (
          COMPOSER_QUICK_SCHEDULE_INTERVAL_HOURS.map((interval) => (
            <RailChip
              key={interval}
              type="button"
              className="w-full min-w-0 px-1 sm:px-2"
              onClick={() => onScheduleIntervalClick(interval)}
              disabled={disabled}
            >
              {formatIntervalLabel(interval, { compact: true })}
            </RailChip>
          ))
        )}
      </div>
    </div>
  );
}
