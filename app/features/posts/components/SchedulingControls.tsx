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
import { formatIntervalLabel } from "~/lib/schedule-intervals";
import {
  addHours,
  formatForDateTimeLocal,
  nowInTimezone,
} from "~/lib/temporal";

import { getDynamicQueueStyle } from "../queue-colors";
import type { QueueType } from "../types";

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

  // Sync local state when parent updates scheduledFor (e.g. after queue schedule API)
  useEffect(() => {
    setLocalScheduledFor(scheduledFor);
  }, [scheduledFor]);

  const calculateQueueScheduleTime = useCallback(
    async (queueTypeName: string) => {
      if (queueTypeName === "unassigned") {
        setLocalScheduledFor("");
        onScheduleChange("");
        return;
      }

      // Find the queue type object to get its ID
      const selectedQueueType = queueTypes.find(
        (qt) => (typeof qt === "string" ? qt : qt.name) === queueTypeName
      );
      const queueTypeId =
        typeof selectedQueueType === "object" ? selectedQueueType.id : null;

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
          const data = (await response.json()) as { scheduledTime?: string };
          const scheduledTime = data.scheduledTime;
          if (scheduledTime) {
            setLocalScheduledFor(scheduledTime);
            onScheduleChange(scheduledTime);
          }
        }
      } catch (error) {
        const { handleErrorSafely } =
          await import("~/lib/error-handler.client");
        handleErrorSafely(error, {
          component: "SchedulingControls",
          action: "calculateScheduleTime",
        });
      }
    },
    [queueTypes, userId, onScheduleChange]
  );

  useEffect(() => {
    if (selectedQueueType === "unassigned") {
      setLocalScheduledFor("");
      onScheduleChange("");
    } else {
      void calculateQueueScheduleTime(selectedQueueType);
    }
  }, [selectedQueueType, calculateQueueScheduleTime, onScheduleChange]);

  const _handleScheduleIntervalClick = (intervalHours: string) => {
    const tz = userTimezone || "UTC";
    const now = nowInTimezone(tz);
    const hoursLaterZoned = addHours(now, Number(intervalHours));
    // formatForDateTimeLocal already returns datetime-local format
    const datetimeLocal = formatForDateTimeLocal(hoursLaterZoned, tz);

    setLocalScheduledFor(datetimeLocal);
    onScheduleChange(datetimeLocal);
  };

  const handleQueueChange = (value: string) => {
    if (value === selectedQueueType) {
      setLocalScheduledFor("");
      onScheduleChange("");
      onQueueTypeChange("unassigned");
    } else {
      onQueueTypeChange(value);
    }
  };

  const handleDateTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLocalScheduledFor(e.target.value);
    onScheduleChange(e.target.value);
  };

  const selectedQueue = queueTypes.find(
    (q) => (typeof q === "string" ? q : q.name) === selectedQueueType
  );
  const selectedColorToken =
    typeof selectedQueue === "object"
      ? (selectedQueue as { colorToken?: string | null }).colorToken
      : null;
  const selectedQueueColor =
    selectedQueueType !== "unassigned"
      ? getDynamicQueueStyle(selectedColorToken ?? null, false)
      : "bg-muted text-foreground";

  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="queueType">Queue Type</Label>
        <Select
          value={selectedQueueType === "unassigned" ? "" : selectedQueueType}
          onValueChange={handleQueueChange}
          name="queueType"
        >
          <SelectTrigger
            id="queueType"
            className={`w-full ${selectedQueueColor}`}
          >
            <SelectValue placeholder="Select a queue (optional)" />
          </SelectTrigger>
          <SelectContent>
            {queueTypes
              .filter((queue) => queue.name !== "Unassigned")
              .map((queue) => (
                <SelectItem
                  key={queue.name}
                  value={queue.name}
                  title={
                    selectedQueueType === queue.name
                      ? "Click again to leave unassigned"
                      : undefined
                  }
                >
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

      {scheduleIntervals.length > 0 ? (
        <div>
          <Label>Quick Schedule</Label>
          <div className="mt-2 flex flex-wrap gap-2">
            {scheduleIntervals.map((interval) => (
              <Button
                key={interval}
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  const hoursFromNow = interval;
                  const tz = userTimezone || "UTC";
                  const now = nowInTimezone(tz);
                  const laterZoned = addHours(now, hoursFromNow);
                  const formattedDate = formatForDateTimeLocal(laterZoned, tz);
                  setLocalScheduledFor(formattedDate);
                  onScheduleChange(formattedDate);
                }}
              >
                {formatIntervalLabel(interval, { compact: false })}
              </Button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
