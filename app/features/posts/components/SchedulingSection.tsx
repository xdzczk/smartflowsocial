import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";

import type { QueueType } from "../types";
interface SchedulingSectionProps {
  scheduledFor: string;
  onScheduledForChange: (value: string) => void;
  scheduleIntervals: number[];
  queueTypes: (string | QueueType)[];
  selectedQueue: string;
  onScheduleIntervalClick: (intervalHours: string | number) => void;
  onCalculateNextSlot: () => void;
  disabled?: boolean;
  label?: string;
  showTimeInput?: boolean;
  className?: string;
}

export function SchedulingSection({
  scheduledFor,
  onScheduledForChange,
  scheduleIntervals,
  queueTypes,
  selectedQueue,
  onScheduleIntervalClick,
  onCalculateNextSlot,
  disabled = false,
  label = "Schedule for later",
  showTimeInput = true,
  className = "",
}: SchedulingSectionProps) {
  // Find the currently selected queue type
  const selectedQueueType = queueTypes.find((qt) =>
    typeof qt === "string" ? qt === selectedQueue : qt.name === selectedQueue,
  );

  const isFixedSlotQueue =
    selectedQueueType &&
    typeof selectedQueueType === "object" &&
    selectedQueueType.scheduleType === "FIXED_SLOTS";

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
              value={scheduledFor ?? ""}
              onChange={(e) => onScheduledForChange(e.target.value)}
              disabled={disabled}
            />
          </div>
        </div>
      ) : null}

      <div className="mt-2 flex flex-wrap gap-2">
        {isFixedSlotQueue ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onCalculateNextSlot}
            disabled={disabled}
            className="border-blue-500 text-blue-700 hover:bg-blue-50"
          >
            Next Slot
          </Button>
        ) : (
          scheduleIntervals.map((interval) => (
            <Button
              key={interval}
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onScheduleIntervalClick(interval)}
              disabled={disabled}
              className="border-blue-500 text-blue-700 hover:bg-blue-50"
            >
              +{interval}h
            </Button>
          ))
        )}
      </div>
    </div>
  );
}



