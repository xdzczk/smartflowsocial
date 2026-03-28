import { useState, useCallback, useRef, useEffect } from "react";

import {
  addHours,
  formatForDateTimeLocal,
  nowInTimezone,
  parseDateTimeLocal,
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

/** Canonical sentinel for "no queue" (matches LongFormPublishingOptions Select items). */
function normalizeInitialQueueType(name: string): string {
  return name === "Unassigned" || name === "unassigned" ? "unassigned" : name;
}

export function useLongFormScheduling({
  queueTypes,
  scheduleIntervals: _scheduleIntervals,
  userTags,
  userTimezone,
  initialQueueType = "unassigned",
  onQueueTypeChange,
}: UseLongFormSchedulingOptions) {
  const [selectedQueueType, setSelectedQueueType] = useState(() =>
    normalizeInitialQueueType(initialQueueType)
  );
  const [scheduledFor, setScheduledFor] = useState<string | null>("");
  const [displayedHashtags, setDisplayedHashtags] = useState(userTags);

  const queueTypesRef = useRef(queueTypes);
  useEffect(() => {
    queueTypesRef.current = queueTypes;
  }, [queueTypes]);

  const calculateQueueScheduleTime = useCallback(
    async (queueTypeName: string): Promise<string | null> => {
      if (queueTypeName === "Unassigned" || queueTypeName === "unassigned") {
        setScheduledFor(null);
        return null;
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
          if (scheduledTime) {
            setScheduledFor(scheduledTime);
            return scheduledTime;
          }
        }
      } catch (error) {
        const { handleErrorSafely } =
          await import("~/lib/error-handler.client");
        handleErrorSafely(error, {
          component: "useLongFormScheduling",
          action: "calculateQueueScheduleTime",
        });
      }
      return null;
    },
    []
  );

  const updateDisplayedHashtags = useCallback(
    async (queueTypeName: string) => {
      setSelectedQueueType(queueTypeName);

      const isUnassigned =
        queueTypeName === "Unassigned" || queueTypeName === "unassigned";
      if (!isUnassigned) {
        await calculateQueueScheduleTime(queueTypeName);
      } else {
        setScheduledFor(null);
      }

      if (isUnassigned) {
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

      setScheduledFor((prev) => {
        const now = nowInTimezone(userTimezone);
        const trimmed = (prev ?? "").trim();
        let base: ReturnType<typeof nowInTimezone>;
        if (trimmed) {
          try {
            base = parseDateTimeLocal(trimmed, userTimezone);
          } catch {
            base = now;
          }
        } else {
          base = now;
        }
        let result = addHours(base, intervalHours);
        if (Number(result.epochMilliseconds) < Number(now.epochMilliseconds)) {
          result = now;
        }
        return formatForDateTimeLocal(result, userTimezone);
      });
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
