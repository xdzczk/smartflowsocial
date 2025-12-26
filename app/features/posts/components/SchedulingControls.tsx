import { useState, useEffect, useCallback } from "react";

import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { getDynamicQueueStyle } from "~/features/posts/queueColors";
import type { QueueType } from "~/features/posts/types";

interface SchedulingControlsProps {
  queueTypes?: QueueType[];
  scheduleIntervals?: number[];
  selectedQueueType: string;
  scheduledFor: string;
  onQueueTypeChange: (queueType: string) => void;
  onScheduleChange: (scheduledFor: string) => void;
  userTimezone?: string;
  userId?: string;
}

export default function SchedulingControls({
  queueTypes = [],
  scheduleIntervals = [],
  selectedQueueType,
  scheduledFor,
  onQueueTypeChange,
  onScheduleChange,
  userTimezone = "UTC",
  userId,
}: SchedulingControlsProps) {
  const [localScheduledFor, setLocalScheduledFor] = useState(scheduledFor);

  const calculateQueueScheduleTime = useCallback(async (queueTypeName: string) => {
    if (queueTypeName === "unassigned") {
      setLocalScheduledFor("");
      onScheduleChange("");
      return;
    }

    // Find the queue type object to get its ID
    const selectedQueueType = queueTypes.find(qt => 
      (typeof qt === "string" ? qt : qt.name) === queueTypeName
    );
    const queueTypeId = typeof selectedQueueType === "object" ? selectedQueueType.id : null;

    try {
      const response = await fetch("/api/queue-schedule", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          queueTypeId,
          queueTypeName, // Keep for backward compatibility
          userId,
        }),
      });

      if (response.ok) {
        const { scheduledTime } = await response.json();
        setLocalScheduledFor(scheduledTime);
        onScheduleChange(scheduledTime);
      }
    } catch (error) {
      const { handleErrorSafely } = await import("~/lib/error-handler.client");
      handleErrorSafely(error, {
        component: "SchedulingControls",
        action: "calculateScheduleTime",
      });
    }
  }, [queueTypes, userId, onScheduleChange]);

  useEffect(() => {
    if (selectedQueueType !== "unassigned") {
      calculateQueueScheduleTime(selectedQueueType);
    }
  }, [selectedQueueType, calculateQueueScheduleTime]);

  const handleScheduleIntervalClick = (intervalHours: string) => {
    const now = new Date();
    const hoursLater = new Date(
      now.getTime() + parseInt(intervalHours) * 60 * 60 * 1000,
    );

    const formattedDate = hoursLater.toLocaleString("en-US", {
      timeZone: userTimezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });

    const [datePart, timePart] = formattedDate.split(", ");
    const [month, day, year] = datePart.split("/");
    const datetimeLocal = `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}T${timePart}`;

    setLocalScheduledFor(datetimeLocal);
    onScheduleChange(datetimeLocal);
  };

  const handleQueueChange = (value: string) => {
    onQueueTypeChange(value);
  };

  const handleDateTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLocalScheduledFor(e.target.value);
    onScheduleChange(e.target.value);
  };

  const selectedQueueColor =
    selectedQueueType !== "unassigned"
      ? getDynamicQueueStyle(selectedQueueType)
      : "bg-gray-100 text-gray-800";

  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="queueType">Queue Type</Label>
        <Select value={selectedQueueType} onValueChange={handleQueueChange}>
          <SelectTrigger className={`w-full ${selectedQueueColor}`}>
            <SelectValue placeholder="Select a queue type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="unassigned">Unassigned</SelectItem>
            {queueTypes.map((queue) => (
              <SelectItem key={queue.name} value={queue.name}>
                {queue.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label htmlFor="scheduledFor">Schedule for later</Label>
        <Input
          id="scheduledFor"
          name="scheduledFor"
          type="datetime-local"
          value={localScheduledFor}
          onChange={handleDateTimeChange}
          className="w-full"
        />
      </div>

      {scheduleIntervals && scheduleIntervals.length > 0 ? (
        <div>
          <Label>Quick Schedule</Label>
          <div className="mt-2 flex flex-wrap gap-2">
            {scheduleIntervals.map((interval) => (
              <Button
                key={interval.hours}
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleScheduleIntervalClick(interval.hours)}
              >
                {interval.label}
              </Button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
