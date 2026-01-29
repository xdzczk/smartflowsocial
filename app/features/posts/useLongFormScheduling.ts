import { useState, useCallback, useRef, useEffect } from "react";

import {
  addHours,
  formatForDateTimeLocal,
  nowInTimezone,
} from "~/lib/temporal";
interface QueueType {
  id?: string;
  name: string;
  color?: string | null;
  hashtags?: string | null;
  scheduleType?: string;
  isEnabled?: boolean;
}

interface UseLongFormSchedulingOptions {
  queueTypes: Array<string | QueueType>;
  scheduleIntervals: number[];
  userTags: string;
  userTimezone: string;
  initialQueueType?: string;
  onQueueTypeChange?: (name: string) => void;
}

export function useLongFormScheduling({
  queueTypes,
  scheduleIntervals: _scheduleIntervals,
  userTags,
  userTimezone,
  initialQueueType = "Unassigned",
  onQueueTypeChange,
}: UseLongFormSchedulingOptions) {
  const [selectedQueueType, setSelectedQueueType] = useState(initialQueueType);
  const [scheduledFor, setScheduledFor] = useState<string | null>("");
  const [displayedHashtags, setDisplayedHashtags] = useState(userTags);

  const queueTypesRef = useRef(queueTypes);
  useEffect(() => {
    queueTypesRef.current = queueTypes;
  }, [queueTypes]);

  const calculateQueueScheduleTime = useCallback(
    async (queueTypeName: string) => {
      if (queueTypeName === "Unassigned") {
        setScheduledFor(null);
        return;
      }

      const queueTypesCurrent = queueTypesRef.current;
      const selectedQueue = queueTypesCurrent.find(
        (qt) => (typeof qt === "string" ? qt : qt.name) === queueTypeName
      );
      const queueTypeId =
        typeof selectedQueue === "object" ? selectedQueue.id : null;

      try {
        const response = await fetch("/api/queue-schedule", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            queueTypeId,
            queueTypeName, // Keep for backward compatibility
          }),
        });

        if (response.ok) {
          const data: unknown = await response.json();
          const scheduledTime =
            data &&
            typeof data === "object" &&
            !Array.isArray(data) &&
            "scheduledTime" in data &&
            typeof (data as { scheduledTime?: unknown }).scheduledTime ===
              "string"
              ? (data as { scheduledTime: string }).scheduledTime
              : "";
          setScheduledFor(scheduledTime);
        }
      } catch (error) {
        const { handleErrorSafely } =
          await import("~/lib/error-handler.client");
        handleErrorSafely(error, {
          component: "useLongFormScheduling",
          action: "calculateQueueScheduleTime",
        });
      }
    },
    []
  );

  const updateDisplayedHashtags = useCallback(
    async (queueTypeName: string) => {
      setSelectedQueueType(queueTypeName);

      // Calculate the next scheduled time when queue type changes
      if (queueTypeName !== "Unassigned") {
        await calculateQueueScheduleTime(queueTypeName);
      } else {
        setScheduledFor(null);
      }

      if (queueTypeName === "Unassigned") {
        setDisplayedHashtags(userTags);
        if (onQueueTypeChange) onQueueTypeChange(queueTypeName);
        return;
      }

      try {
        const response = await fetch("/api/effective-hashtags", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            queueTypeName: queueTypeName,
          }),
        });

        if (response.ok) {
          const data: unknown = await response.json();
          const hashtags =
            data &&
            typeof data === "object" &&
            !Array.isArray(data) &&
            "hashtags" in data &&
            typeof (data as { hashtags?: unknown }).hashtags === "string"
              ? (data as { hashtags: string }).hashtags
              : userTags;
          setDisplayedHashtags(hashtags);
          if (onQueueTypeChange) onQueueTypeChange(queueTypeName);
        } else {
          setDisplayedHashtags(userTags);
        }
      } catch (error) {
        const { handleErrorSafely } =
          await import("~/lib/error-handler.client");
        handleErrorSafely(error, {
          component: "useLongFormScheduling",
          action: "updateDisplayedHashtags",
        });
        setDisplayedHashtags(userTags);
      }
    },
    [userTags, onQueueTypeChange, calculateQueueScheduleTime]
  );

  const handleScheduleIntervalClick = useCallback(
    (intervalHours: number) => {
      const queueTypesCurrent = queueTypesRef.current;
      const currentQueueType = queueTypesCurrent.find(
        (qt) => (typeof qt === "string" ? qt : qt.name) === selectedQueueType
      );

      if (
        currentQueueType &&
        typeof currentQueueType === "object" &&
        (currentQueueType.scheduleType === "FIXED_SLOTS" ||
          currentQueueType.scheduleType === "WEEKLY_SLOTS")
      ) {
        void calculateQueueScheduleTime(currentQueueType.name);
        return;
      }

      const now = nowInTimezone(userTimezone);
      const hoursLaterZoned = addHours(now, intervalHours);
      const formattedForInput = formatForDateTimeLocal(
        hoursLaterZoned,
        userTimezone
      );
      setScheduledFor(formattedForInput);
    },
    [selectedQueueType, userTimezone, calculateQueueScheduleTime]
  );

  return {
    selectedQueueType,
    scheduledFor,
    setScheduledFor,
    displayedHashtags,
    updateDisplayedHashtags,
    handleScheduleIntervalClick,
    calculateQueueScheduleTime,
  };
}
