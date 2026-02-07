import { useState, useEffect, useCallback, useRef } from "react";

import { logClientError } from "~/lib/error-handler.client";
import { useOptionalUser } from "~/lib/remix-utils";
import {
  addHours,
  formatForDateTimeLocal,
  nowInTimezone,
} from "~/lib/temporal";

import type { QueueType } from "../types";

interface UsePostSchedulingProps {
  queueTypes: Array<string | QueueType>;
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

  // Use refs to stabilize dependencies for React compiler
  const queueTypesRef = useRef(queueTypes);
  const onTimeErrorRef = useRef(onTimeError);
  const userIdRef = useRef(user?.id);
  useEffect(() => {
    queueTypesRef.current = queueTypes;
    onTimeErrorRef.current = onTimeError;
    userIdRef.current = user?.id;
  }, [queueTypes, onTimeError, user?.id]);

  const calculateQueueScheduleTime = useCallback(
    async (queueTypeName: string) => {
      if (queueTypeName === "unassigned") {
        setScheduledFor("");
        return;
      }

      // Find the queue type object to get its ID
      const selectedQueueType = queueTypesRef.current.find((qt) =>
        typeof qt === "string"
          ? qt === queueTypeName
          : qt.name === queueTypeName
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
            userId: userIdRef.current,
          }),
        });

        if (response.ok) {
          const data = (await response.json()) as { scheduledTime?: string };
          const scheduledTime = data.scheduledTime;
          if (scheduledTime) {
            setScheduledFor(scheduledTime);
          }
          setTimeError("");
          if (onTimeErrorRef.current) {
            onTimeErrorRef.current("");
          }
        }
      } catch (error) {
        logClientError(
          error instanceof Error ? error : new Error(String(error)),
          {
            component: "usePostScheduling",
            action: "calculateQueueScheduleTime",
            queueTypeId,
            queueTypeName,
          }
        );
      }
    },
    []
  );

  const handleScheduleIntervalClick = (intervalHours: string | number) => {
    // Find the currently selected queue type
    const selectedQueueType = queueTypesRef.current.find((qt) =>
      typeof qt === "string" ? qt === selectedQueue : qt.name === selectedQueue
    );

    // If this is a fixed slot or weekly slot queue, use the API to get the next scheduled time instead
    if (
      selectedQueueType &&
      typeof selectedQueueType === "object" &&
      (selectedQueueType.scheduleType === "FIXED_SLOTS" ||
        selectedQueueType.scheduleType === "WEEKLY_SLOTS")
    ) {
      // For fixed slot queues, recalculate the schedule time instead of adding hours
      void calculateQueueScheduleTime(selectedQueue);
      return;
    }

    // Use Temporal for cleaner date arithmetic and formatting
    const effectiveTimezone = userTimezone || (user?.timezone ?? "UTC");
    const now = nowInTimezone(effectiveTimezone);
    const hoursLater = addHours(now, Number(intervalHours));

    // Format for datetime-local input in user's timezone
    const formattedForInput = formatForDateTimeLocal(
      hoursLater,
      effectiveTimezone
    );

    setScheduledFor(formattedForInput);
    setTimeError("");
    if (onTimeErrorRef.current) {
      onTimeErrorRef.current("");
    }
  };

  // Calculate schedule time when queue changes; reset when deselecting (unassigned)
  useEffect(() => {
    if (selectedQueue === "unassigned") {
      setTimeout(() => setScheduledFor(""), 0);
    } else {
      // Defer to avoid cascading renders
      setTimeout(() => {
        void calculateQueueScheduleTime(selectedQueue);
      }, 0);
    }
    // Notify parent component of queue type change
    if (onQueueTypeChange) {
      // Defer to avoid cascading renders
      setTimeout(() => {
        onQueueTypeChange(selectedQueue);
      }, 0);
    }
  }, [selectedQueue, onQueueTypeChange, calculateQueueScheduleTime]);

  const handleScheduledForChange = (value: string) => {
    setScheduledFor(value);
    setTimeError("");
    if (onTimeErrorRef.current) {
      onTimeErrorRef.current("");
    }
  };

  const handleTimeError = (error: string) => {
    setTimeError(error);
    if (onTimeErrorRef.current) {
      onTimeErrorRef.current(error);
    }
  };

  // Ensure scheduleIntervals is always number[]
  const normalizedScheduleIntervals: number[] =
    scheduleIntervals.length > 0
      ? scheduleIntervals
      : user?.scheduleInterval
        ? user.scheduleInterval.map((interval) =>
            typeof interval === "string" ? Number(interval) : interval
          )
        : [];

  return {
    selectedQueue,
    setSelectedQueue,
    scheduledFor,
    setScheduledFor: handleScheduledForChange,
    timeError,
    setTimeError: handleTimeError,
    calculateQueueScheduleTime,
    handleScheduleIntervalClick,
    scheduleIntervals: normalizedScheduleIntervals,
  };
}
