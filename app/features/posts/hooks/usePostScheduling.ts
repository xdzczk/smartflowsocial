import { useState, useEffect, useCallback } from "react";

import type { QueueType } from "~/features/posts/types";
import { useOptionalUser } from "~/lib/remix-utils";

interface UsePostSchedulingProps {
  queueTypes: (string | QueueType)[];
  scheduleIntervals?: number[];
  userTimezone?: string;
  initialQueue?: string;
  onQueueTypeChange?: (queueType: string) => void;
  onTimeError?: (error: string) => void;
}

export function usePostScheduling({
  queueTypes,
  scheduleIntervals = [],
  userTimezone = "UTC",
  initialQueue = "unassigned",
  onQueueTypeChange,
  onTimeError,
}: UsePostSchedulingProps) {
  const user = useOptionalUser();
  const [selectedQueue, setSelectedQueue] = useState(initialQueue);
  const [scheduledFor, setScheduledFor] = useState("");
  const [timeError, setTimeError] = useState("");

  const calculateQueueScheduleTime = useCallback(async (queueTypeName: string) => {
    if (queueTypeName === "unassigned") {
      setScheduledFor("");
      return;
    }

    // Find the queue type object to get its ID
    const selectedQueueType = queueTypes.find((qt) =>
      typeof qt === "string" ? qt === queueTypeName : qt.name === queueTypeName
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
          userId: user?.id,
        }),
      });

      if (response.ok) {
        const data = (await response.json()) as { scheduledTime?: string };
        const scheduledTime = data.scheduledTime;
        if (scheduledTime) {
          setScheduledFor(scheduledTime);
        }
        setTimeError("");
        if (onTimeError) {
          onTimeError("");
        }
      }
    } catch (error) {
      console.error("Error calculating schedule time:", error);
    }
  }, [queueTypes, user?.id, onTimeError]);

  const handleScheduleIntervalClick = (intervalHours: string | number) => {
    // Find the currently selected queue type
    const selectedQueueType = queueTypes.find((qt) =>
      typeof qt === "string"
        ? qt === selectedQueue
        : qt.name === selectedQueue
    );

    // If this is a fixed slot queue, use the API to get the next scheduled time instead
    if (
      selectedQueueType &&
      typeof selectedQueueType === "object" &&
      selectedQueueType.scheduleType === "FIXED_SLOTS"
    ) {
      // For fixed slot queues, recalculate the schedule time instead of adding hours
      calculateQueueScheduleTime(selectedQueue);
      return;
    }

    const now = new Date();
    const hoursLater = new Date(
      now.getTime() + parseInt(String(intervalHours)) * 60 * 60 * 1000
    );

    // Format the date in the user's timezone
    const effectiveTimezone = userTimezone || (user?.timezone ?? "UTC");
    const formattedDate = hoursLater.toLocaleString("en-US", {
      timeZone: effectiveTimezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });

    // Parse the formatted date back into components
    const [datePart, timePart] = formattedDate.split(", ");
    const [month, day, year] = datePart.split("/");
    const [hours, minutes] = timePart.split(":");

    // Create the datetime-local format (YYYY-MM-DDTHH:mm)
    const formattedForInput = `${year}-${month}-${day}T${hours}:${minutes}`;

    setScheduledFor(formattedForInput);
    setTimeError("");
    if (onTimeError) {
      onTimeError("");
    }
  };

  // Calculate schedule time when queue changes
  useEffect(() => {
    if (selectedQueue !== "unassigned") {
      void calculateQueueScheduleTime(selectedQueue);
    }
    // Notify parent component of queue type change
    if (onQueueTypeChange) {
      onQueueTypeChange(selectedQueue);
    }
  }, [selectedQueue, onQueueTypeChange, calculateQueueScheduleTime]);

  const handleScheduledForChange = (value: string) => {
    setScheduledFor(value);
    setTimeError("");
    if (onTimeError) {
      onTimeError("");
    }
  };

  const handleTimeError = (error: string) => {
    setTimeError(error);
    if (onTimeError) {
      onTimeError(error);
    }
  };

  return {
    selectedQueue,
    setSelectedQueue,
    scheduledFor,
    setScheduledFor: handleScheduledForChange,
    timeError,
    setTimeError: handleTimeError,
    calculateQueueScheduleTime,
    handleScheduleIntervalClick,
    scheduleIntervals: scheduleIntervals || user?.scheduleInterval || [],
  };
}




