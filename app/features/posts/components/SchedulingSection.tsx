import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
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

      <div className="mt-2 flex gap-2 overflow-x-auto pb-1 sm:flex-wrap sm:overflow-visible">
        {isSlotBasedQueue ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onCalculateNextSlot}
            disabled={disabled}
            className="border-primary text-foreground hover:bg-muted transition-transform duration-150 active:scale-95"
          >
            Next Slot
          </Button>
        ) : (
          COMPOSER_QUICK_SCHEDULE_INTERVAL_HOURS.map((interval) => (
            <Button
              key={interval}
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onScheduleIntervalClick(interval)}
              disabled={disabled}
              className="border-primary text-foreground hover:bg-muted transition-transform duration-150 active:scale-95"
            >
              {formatIntervalLabel(interval, { compact: true })}
            </Button>
          ))
        )}
      </div>
    </div>
  );
}
