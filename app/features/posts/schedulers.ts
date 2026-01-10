import type { QueueType } from "@prisma/client";

import { getScheduleInterval } from "~/features/user";
import { logError } from "~/lib/error-logger.server";
import { getLastPostTimeForQueue } from "~/models/post.queries.server";

import { isIntervalScheduleConfig, isFixedSlotsScheduleConfig } from "./types";
import type { QueueType as TypedQueueType } from "./types";

interface CalculateNextScheduleTimeParams {
  queueType: QueueType | TypedQueueType;
  userId: string;
  userTimezone?: string;
  baseTime?: Date;
}

// ============================================================================
// Helper Functions for Date Validation
// ============================================================================

function isValidDate(date: unknown): date is Date {
  return date instanceof Date && !isNaN(date.getTime());
}

function getValidBaseTime(baseTime?: Date): Date {
  return isValidDate(baseTime) ? baseTime : new Date();
}

function getDefaultFutureTime(baseTime: Date): Date {
  return new Date(baseTime.getTime() + 1000);
}

// ============================================================================
// Helper Functions for Interval Schedule Calculation
// ============================================================================

async function getGlobalInterval(userId: string): Promise<number> {
  try {
    const scheduleIntervals = await getScheduleInterval(userId);
    const intervalsArray = Array.isArray(scheduleIntervals)
      ? scheduleIntervals
      : null;
    const firstInterval: unknown =
      intervalsArray && intervalsArray.length > 0 ? intervalsArray[0] : null;
    return firstInterval ? Number(firstInterval) : 4; // Default to 4 hours
  } catch (error) {
    logError(error instanceof Error ? error : new Error(String(error)), {
      userId,
      message: "Error getting schedule interval",
    });
    return 4; // Default to 4 hours
  }
}

function calculateIntervalTime(
  lastPostTime: Date | null,
  intervalHours: number,
  baseTime: Date
): Date {
  if (!isValidDate(lastPostTime)) {
    return getDefaultFutureTime(baseTime);
  }

  const nextTime = new Date(
    lastPostTime.getTime() + intervalHours * 60 * 60 * 1000
  );

  if (!isValidDate(nextTime)) {
    return baseTime;
  }

  return nextTime >= baseTime ? nextTime : getDefaultFutureTime(baseTime);
}

async function calculateIntervalSchedule(
  config: unknown,
  lastPostTime: Date | null,
  baseTime: Date,
  userId: string
): Promise<Date> {
  // Handle missing or invalid config - default to 4 hours
  if (!config || !isIntervalScheduleConfig(config)) {
    return calculateIntervalTime(lastPostTime, 4, baseTime);
  }

  // Use global interval if configured
  if (config.useGlobalInterval) {
    const interval = await getGlobalInterval(userId);
    return calculateIntervalTime(lastPostTime, interval, baseTime);
  }

  // Use queue-specific interval
  const intervalHours =
    typeof config === "object" &&
    "intervalHours" in config &&
    typeof config.intervalHours === "number"
      ? config.intervalHours
      : 4;

  return calculateIntervalTime(lastPostTime, intervalHours, baseTime);
}

// ============================================================================
// Helper Functions for Fixed Slots Schedule Calculation
// ============================================================================

interface ParsedSlot {
  slot: string;
  hours: number;
  minutes: number;
  totalMinutes: number;
}

function parseSlot(slot: unknown, userId: string): ParsedSlot | null {
  const slotStr = typeof slot === "string" ? slot : String(slot);
  try {
    if (!slotStr.includes(":")) {
      return null;
    }
    const parts = slotStr.split(":");
    if (parts.length !== 2) {
      return null;
    }
    const hours = Number(parts[0]);
    const minutes = Number(parts[1]);
    if (
      isNaN(hours) ||
      isNaN(minutes) ||
      hours < 0 ||
      hours > 23 ||
      minutes < 0 ||
      minutes > 59
    ) {
      return null;
    }
    return {
      slot: slotStr,
      hours,
      minutes,
      totalMinutes: hours * 60 + minutes,
    };
  } catch (error) {
    logError(error instanceof Error ? error : new Error(String(error)), {
      userId,
      slot: slotStr,
      message: "Error parsing slot",
    });
    return null;
  }
}

function parseAndSortSlots(slots: unknown[], userId: string): ParsedSlot[] {
  return slots
    .map((slot) => parseSlot(slot, userId))
    .filter((slot): slot is ParsedSlot => slot !== null)
    .sort((a, b) => a.totalMinutes - b.totalMinutes);
}

function createSlotInUserTimezone(
  hours: number,
  minutes: number,
  baseDate: Date,
  userTimezone: string,
  userId: string,
  fallbackTime: Date
): Date {
  try {
    // For UTC/GMT timezones, no conversion needed
    if (userTimezone === "UTC" || userTimezone === "Etc/GMT") {
      const utcSlot = new Date(baseDate);
      utcSlot.setUTCHours(hours, minutes, 0, 0);
      return isValidDate(utcSlot) ? utcSlot : fallbackTime;
    }

    // Get the date string in the user's timezone (YYYY-MM-DD format)
    const userDateStr = baseDate.toLocaleDateString("en-CA", {
      timeZone: userTimezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });

    // Start with a UTC date for the desired time
    const [year, month, day] = userDateStr.split("-").map(Number);
    let testUTC = new Date(
      Date.UTC(year ?? 0, (month ?? 1) - 1, day ?? 1, hours, minutes, 0, 0)
    );

    // Adjust to match user's timezone
    let attempts = 0;
    const maxAttempts = 24;

    while (attempts < maxAttempts) {
      const testInUserTz = testUTC.toLocaleString("en-US", {
        timeZone: userTimezone,
        hour12: false,
        hour: "2-digit",
        minute: "2-digit",
      });

      const [testHours, testMinutes] = testInUserTz.split(":").map(Number);

      const safeTestHours = testHours ?? 0;
      const safeTestMinutes = testMinutes ?? 0;
      if (safeTestHours === hours && safeTestMinutes === minutes) {
        return isValidDate(testUTC) ? testUTC : fallbackTime;
      }

      // Calculate the difference and adjust
      const hourDiff = hours - safeTestHours;
      const minuteDiff = minutes - safeTestMinutes;
      const totalMinuteDiff = hourDiff * 60 + minuteDiff;

      testUTC = new Date(testUTC.getTime() + totalMinuteDiff * 60 * 1000);
      attempts++;

      // Handle day boundary crossing
      if (Math.abs(hourDiff) > 12) {
        const dayAdjust = hourDiff > 0 ? -24 : 24;
        testUTC = new Date(testUTC.getTime() + dayAdjust * 60 * 60 * 1000);
      }
    }

    return isValidDate(testUTC) ? testUTC : fallbackTime;
  } catch (error) {
    logError(error instanceof Error ? error : new Error(String(error)), {
      userId,
      hours,
      minutes,
      message: "Error in createSlotInUserTimezone",
      userTimezone,
    });
    // Fallback to UTC
    const utcSlot = new Date(baseDate);
    utcSlot.setUTCHours(hours, minutes, 0, 0);
    return isValidDate(utcSlot) ? utcSlot : fallbackTime;
  }
}

function isSameDay(date1: Date, date2: Date): boolean {
  return (
    date1.getUTCFullYear() === date2.getUTCFullYear() &&
    date1.getUTCMonth() === date2.getUTCMonth() &&
    date1.getUTCDate() === date2.getUTCDate()
  );
}

function findNextSlotWithLastPost(
  sortedSlots: ParsedSlot[],
  lastPostTime: Date,
  baseTime: Date,
  userTimezone: string,
  userId: string,
  fallbackTime: Date
): Date {
  const oneDayAgo = new Date(baseTime);
  oneDayAgo.setDate(oneDayAgo.getDate() - 1);

  const baseDate = lastPostTime < oneDayAgo ? baseTime : lastPostTime;
  const dayAfterBase = new Date(baseDate);
  dayAfterBase.setDate(dayAfterBase.getDate() + 1);

  // Create slots for the base date and day after
  const baseDateSlots = sortedSlots.map((slotInfo) =>
    createSlotInUserTimezone(
      slotInfo.hours,
      slotInfo.minutes,
      baseDate,
      userTimezone,
      userId,
      fallbackTime
    )
  );

  const dayAfterBaseSlots = sortedSlots.map((slotInfo) =>
    createSlotInUserTimezone(
      slotInfo.hours,
      slotInfo.minutes,
      dayAfterBase,
      userTimezone,
      userId,
      fallbackTime
    )
  );

  // Combine and sort all slots
  const allSlots = [
    ...baseDateSlots
      .filter((slot) => isValidDate(slot))
      .map((slot) => ({ slot })),
    ...dayAfterBaseSlots
      .filter((slot) => isValidDate(slot))
      .map((slot) => ({ slot })),
  ].sort((a, b) => a.slot.getTime() - b.slot.getTime());

  // Find the next slot after the last post time
  for (const { slot: slotTime } of allSlots) {
    if (
      isValidDate(slotTime) &&
      slotTime > lastPostTime &&
      slotTime >= baseTime
    ) {
      return slotTime;
    }
  }

  // Fallback: first slot two days after base date
  if (sortedSlots.length > 0) {
    const twoDaysAfterBase = new Date(baseDate);
    twoDaysAfterBase.setDate(twoDaysAfterBase.getDate() + 2);
    const firstSlot = sortedSlots[0];
    if (firstSlot) {
      const fallbackSlot = createSlotInUserTimezone(
        firstSlot.hours,
        firstSlot.minutes,
        twoDaysAfterBase,
        userTimezone,
        userId,
        fallbackTime
      );
      if (isValidDate(fallbackSlot) && fallbackSlot >= baseTime) {
        return fallbackSlot;
      }
    }
  }
  return fallbackTime;
}

function findNextSlotWithoutLastPost(
  sortedSlots: ParsedSlot[],
  baseTime: Date,
  userTimezone: string,
  userId: string,
  fallbackTime: Date
): Date {
  // Convert slots to today's dates in user's timezone
  const todaySlots = sortedSlots
    .map((slotInfo) =>
      createSlotInUserTimezone(
        slotInfo.hours,
        slotInfo.minutes,
        baseTime,
        userTimezone,
        userId,
        fallbackTime
      )
    )
    .filter((slot) => {
      if (!isValidDate(slot) || slot < baseTime) {
        return false;
      }
      return isSameDay(slot, baseTime);
    });

  // No previous posts, find next available slot today
  if (todaySlots.length > 0) {
    const firstFutureSlot = todaySlots[0];
    if (isValidDate(firstFutureSlot) && firstFutureSlot >= baseTime) {
      return firstFutureSlot;
    }
  }

  // If no slots today work, get first slot of tomorrow
  if (sortedSlots.length > 0) {
    const tomorrow = new Date(baseTime);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const firstSlot = sortedSlots[0];
    if (firstSlot) {
      const tomorrowSlot = createSlotInUserTimezone(
        firstSlot.hours,
        firstSlot.minutes,
        tomorrow,
        userTimezone,
        userId,
        fallbackTime
      );
      if (isValidDate(tomorrowSlot) && tomorrowSlot >= baseTime) {
        return tomorrowSlot;
      }
    }
  }
  return fallbackTime;
}

function findNextFixedSlot(
  sortedSlots: ParsedSlot[],
  lastPostTime: Date | null,
  baseTime: Date,
  userTimezone: string,
  userId: string
): Date {
  const fallbackTime = getDefaultFutureTime(baseTime);

  if (sortedSlots.length === 0) {
    return fallbackTime;
  }

  // If there's a last post time, find the next chronological slot after it
  if (isValidDate(lastPostTime)) {
    return findNextSlotWithLastPost(
      sortedSlots,
      lastPostTime,
      baseTime,
      userTimezone,
      userId,
      fallbackTime
    );
  }

  // No previous posts, find next available slot
  return findNextSlotWithoutLastPost(
    sortedSlots,
    baseTime,
    userTimezone,
    userId,
    fallbackTime
  );
}

async function calculateFixedSlotsSchedule(
  config: unknown,
  lastPostTime: Date | null,
  baseTime: Date,
  userTimezone: string,
  userId: string
): Promise<Date> {
  const slots =
    config &&
    isFixedSlotsScheduleConfig(config) &&
    typeof config === "object" &&
    "slots" in config &&
    Array.isArray(config.slots)
      ? config.slots
      : [];

  const sortedSlots = parseAndSortSlots(slots, userId);
  return findNextFixedSlot(
    sortedSlots,
    lastPostTime,
    baseTime,
    userTimezone,
    userId
  );
}

export async function calculateNextScheduleTime({
  queueType,
  userId,
  userTimezone = "UTC",
  baseTime,
}: CalculateNextScheduleTimeParams): Promise<Date> {
  // Wrapper to ensure we always return a valid Date
  const fallbackDate =
    baseTime && baseTime instanceof Date && !isNaN(baseTime.getTime())
      ? baseTime
      : new Date();

  try {
    const result = await calculateNextScheduleTimeInternal({
      queueType,
      userId,
      userTimezone,
      baseTime,
    });
    // Validate that result is a valid Date object
    if (!(result instanceof Date) || isNaN(result.getTime())) {
      const queueTypeId =
        typeof queueType === "object" &&
        "id" in queueType &&
        typeof queueType.id === "string"
          ? queueType.id
          : undefined;
      logError(
        new Error(
          "Invalid date returned from calculateNextScheduleTimeInternal"
        ),
        {
          userId,
          queueTypeId,
          result: String(result),
        }
      );
      return fallbackDate;
    }
    return result;
  } catch (error) {
    logError(error instanceof Error ? error : new Error(String(error)), {
      userId,
      queueTypeId:
        typeof queueType === "object" && "id" in queueType
          ? queueType.id
          : undefined,
      message: "Error in calculateNextScheduleTime wrapper",
    });
    return fallbackDate;
  }
}

async function calculateNextScheduleTimeInternal({
  queueType,
  userId,
  userTimezone = "UTC",
  baseTime,
}: CalculateNextScheduleTimeParams): Promise<Date> {
  try {
    const now = getValidBaseTime(baseTime);

    // Get last post time for this queue - handle errors gracefully
    let lastPostTime: Date | null = null;
    try {
      lastPostTime = await getLastPostTimeForQueue({
        userId,
        queueTypeId: queueType.id,
        queueTypeName: queueType.name, // Keep for backward compatibility
      });
    } catch (error) {
      logError(error instanceof Error ? error : new Error(String(error)), {
        userId,
        queueTypeId:
          typeof queueType === "object" && "id" in queueType
            ? queueType.id
            : undefined,
        message: "Error getting last post time",
      });
      lastPostTime = null;
    }

    // Validate queueType structure
    if (
      typeof queueType !== "object" ||
      !("scheduleType" in queueType) ||
      !queueType.scheduleType
    ) {
      logError(new Error("Invalid queueType"), {
        userId,
        queueType: String(queueType),
      });
      return getDefaultFutureTime(now);
    }

    const scheduleType =
      typeof queueType === "object" && "scheduleType" in queueType
        ? queueType.scheduleType
        : null;

    const config =
      typeof queueType === "object" && "scheduleConfig" in queueType
        ? queueType.scheduleConfig
        : null;

    if (scheduleType === "INTERVAL") {
      return await calculateIntervalSchedule(config, lastPostTime, now, userId);
    }

    if (scheduleType === "FIXED_SLOTS") {
      return await calculateFixedSlotsSchedule(
        config,
        lastPostTime,
        now,
        userTimezone,
        userId
      );
    }

    // Fallback to immediate scheduling
    return getDefaultFutureTime(now);
  } catch (error) {
    // Ensure we always return a valid Date, even if there's an error
    const fallbackTime = getValidBaseTime(baseTime);
    logError(error instanceof Error ? error : new Error(String(error)), {
      queueTypeId:
        typeof queueType === "object" && "id" in queueType
          ? queueType.id
          : undefined,
      userId,
      userTimezone,
      message: "Error in calculateNextScheduleTime",
    });
    return getDefaultFutureTime(fallbackTime);
  }
}

// Re-export from pure utility file (no server-side dependencies)
export { formatScheduleTimeForInput } from "~/lib/schedule-formatting";
