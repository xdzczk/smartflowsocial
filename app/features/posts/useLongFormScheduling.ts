import { useState, useCallback } from "react";
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

  const calculateQueueScheduleTime = useCallback(
    async (queueTypeName: string) => {
      if (queueTypeName === "Unassigned") {
        setScheduledFor(null);
        return;
      }

      // Find the queue type object to get its ID
      const selectedQueue = queueTypes.find(
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
        const { handleErrorSafely } = await import(
          "~/lib/error-handler.client"
        );
        handleErrorSafely(error, {
          component: "useLongFormScheduling",
          action: "calculateQueueScheduleTime",
        });
      }
    },
    [queueTypes]
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
        const { handleErrorSafely } = await import(
          "~/lib/error-handler.client"
        );
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
      // Find the currently selected queue type
      const currentQueueType = queueTypes.find(
        (qt) => (typeof qt === "string" ? qt : qt.name) === selectedQueueType
      );

      // If this is a fixed slot queue, use the API to get the next scheduled time instead
      if (
        currentQueueType &&
        typeof currentQueueType === "object" &&
        currentQueueType.scheduleType === "FIXED_SLOTS"
      ) {
        // For fixed slot queues, recalculate the schedule time instead of adding hours
        void calculateQueueScheduleTime(currentQueueType.name);
        return;
      }

      const now = new Date();
      const hoursLater = new Date(
        now.getTime() + intervalHours * 60 * 60 * 1000
      );

      // Format the date in the user's timezone
      const formattedDate = hoursLater.toLocaleString("en-US", {
        timeZone: userTimezone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      });

      // Parse the formatted date back into components
      const [datePart, timePart] = formattedDate.split(", ");
      const [month, day, year] = datePart?.split("/") ?? ["", "", ""];
      const [hours, minutes] = timePart?.split(":") ?? ["", ""];

      // Create the datetime-local format (YYYY-MM-DDTHH:mm)
      if (!year || !month || !day || !hours || !minutes) {
        return "";
      }
      const formattedForInput = `${year}-${month}-${day}T${hours}:${minutes}`;

      setScheduledFor(formattedForInput);
    },
    [queueTypes, selectedQueueType, userTimezone, calculateQueueScheduleTime]
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
