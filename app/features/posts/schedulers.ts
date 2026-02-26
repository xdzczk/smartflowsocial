import type { QueueType } from "@prisma/client";

import { getScheduleInterval } from "~/features/user";
import { logError } from "~/lib/error-logger.server";
import {
  addDays,
  addHours,
  compareZonedDateTime,
  createZonedDateTime,
  fromDate,
  isAfter,
  nowUTC,
  toDate,
} from "~/lib/temporal";
import { getLastPostTimeForQueue } from "~/models/post.queries.server";

import {
  isIntervalScheduleConfig,
  isFixedSlotsScheduleConfig,
  isWeeklySlotsScheduleConfig,
} from "./types";
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
  if (isValidDate(baseTime)) return baseTime;
  // Use Temporal for consistency
  return toDate(nowUTC());
}

function getDefaultFutureTime(baseTime: Date): Date {
  const zonedDateTime = fromDate(baseTime, "UTC");
  const futureZoned = zonedDateTime.add({ seconds: 1 });
  return toDate(futureZoned);
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

  // Use Temporal for date arithmetic
  const lastPostZoned = fromDate(lastPostTime, "UTC");
  const nextZoned = addHours(lastPostZoned, intervalHours);
  const nextTime = toDate(nextZoned);

  if (!isValidDate(nextTime)) {
    return baseTime;
  }

  const baseZoned = fromDate(baseTime, "UTC");
  return isAfter(nextZoned, baseZoned) ||
    compareZonedDateTime(nextZoned, baseZoned) === 0
    ? nextTime
    : getDefaultFutureTime(baseTime);
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
    // Convert base date to Temporal ZonedDateTime in user's timezone
    const baseZoned = fromDate(baseDate, userTimezone);

    // Get the date components in user's timezone
    const year = baseZoned.year;
    const month = baseZoned.month;
    const day = baseZoned.day;

    // Create a ZonedDateTime with the desired time in user's timezone
    const slotZoned = createZonedDateTime(
      year,
      month,
      day,
      hours,
      minutes,
      userTimezone
    );

    // Convert back to Date for compatibility
    const slotDate = toDate(slotZoned);
    return isValidDate(slotDate) ? slotDate : fallbackTime;
  } catch (error) {
    logError(error instanceof Error ? error : new Error(String(error)), {
      userId,
      hours,
      minutes,
      message: "Error in createSlotInUserTimezone",
      userTimezone,
    });
    // Fallback: create in UTC
    try {
      const baseZoned = fromDate(baseDate, "UTC");
      const slotZoned = createZonedDateTime(
        baseZoned.year,
        baseZoned.month,
        baseZoned.day,
        hours,
        minutes,
        "UTC"
      );
      const slotDate = toDate(slotZoned);
      return isValidDate(slotDate) ? slotDate : fallbackTime;
    } catch {
      return fallbackTime;
    }
  }
}

function isSameDay(date1: Date, date2: Date): boolean {
  const zoned1 = fromDate(date1, "UTC");
  const zoned2 = fromDate(date2, "UTC");
  return (
    zoned1.year === zoned2.year &&
    zoned1.month === zoned2.month &&
    zoned1.day === zoned2.day
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
  // Use Temporal for date arithmetic
  const baseZoned = fromDate(baseTime, "UTC");
  const oneDayAgoZoned = addDays(baseZoned, -1);
  const oneDayAgo = toDate(oneDayAgoZoned);

  const baseDate = lastPostTime < oneDayAgo ? baseTime : lastPostTime;
  const baseDateZoned = fromDate(baseDate, "UTC");
  const dayAfterBaseZoned = addDays(baseDateZoned, 1);
  const dayAfterBase = toDate(dayAfterBaseZoned);

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

  // Combine and sort all slots using Temporal for comparison
  const lastPostZoned = fromDate(lastPostTime, "UTC");
  const baseTimeZoned = fromDate(baseTime, "UTC");

  const allSlots = [
    ...baseDateSlots
      .filter((slot) => isValidDate(slot))
      .map((slot) => ({ slot, zoned: fromDate(slot, "UTC") })),
    ...dayAfterBaseSlots
      .filter((slot) => isValidDate(slot))
      .map((slot) => ({ slot, zoned: fromDate(slot, "UTC") })),
  ].sort((a, b) => compareZonedDateTime(a.zoned, b.zoned));

  // Find the next slot after the last post time
  for (const { slot: slotTime, zoned: slotZoned } of allSlots) {
    if (
      isValidDate(slotTime) &&
      isAfter(slotZoned, lastPostZoned) &&
      (isAfter(slotZoned, baseTimeZoned) ||
        compareZonedDateTime(slotZoned, baseTimeZoned) === 0)
    ) {
      return slotTime;
    }
  }

  // Fallback: first slot two days after base date
  if (sortedSlots.length > 0) {
    const twoDaysAfterBaseZoned = addDays(baseDateZoned, 2);
    const twoDaysAfterBase = toDate(twoDaysAfterBaseZoned);
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
      if (isValidDate(fallbackSlot)) {
        const fallbackZoned = fromDate(fallbackSlot, "UTC");
        const baseZoned = fromDate(baseTime, "UTC");
        if (
          isAfter(fallbackZoned, baseZoned) ||
          compareZonedDateTime(fallbackZoned, baseZoned) === 0
        ) {
          return fallbackSlot;
        }
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
    const baseZoned = fromDate(baseTime, "UTC");
    const tomorrowZoned = addDays(baseZoned, 1);
    const tomorrow = toDate(tomorrowZoned);
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
      if (isValidDate(tomorrowSlot)) {
        const tomorrowSlotZoned = fromDate(tomorrowSlot, "UTC");
        const baseZoned = fromDate(baseTime, "UTC");
        if (
          isAfter(tomorrowSlotZoned, baseZoned) ||
          compareZonedDateTime(tomorrowSlotZoned, baseZoned) === 0
        ) {
          return tomorrowSlot;
        }
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

// ============================================================================
// Helper Functions for Weekly Slots Schedule Calculation
// ============================================================================

interface ParsedWeeklySlot {
  dayOfWeek: number;
  hours: number;
  minutes: number;
}

function parseWeeklySlot(
  entry: { dayOfWeek: number; time: string },
  _userId: string
): ParsedWeeklySlot | null {
  const dayOfWeek = Number(entry.dayOfWeek);
  if (dayOfWeek < 0 || dayOfWeek > 6 || !Number.isInteger(dayOfWeek)) {
    return null;
  }
  const parts = String(entry.time).trim().split(":");
  if (parts.length !== 2) {
    return null;
  }
  const hours = Number(parts[0]);
  const minutes = Number(parts[1]);
  if (
    Number.isNaN(hours) ||
    Number.isNaN(minutes) ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59
  ) {
    return null;
  }
  return { dayOfWeek, hours, minutes };
}

function parseWeeklySlots(
  weeklySlots: Array<{ dayOfWeek: number; time: string }>,
  userId: string
): ParsedWeeklySlot[] {
  const parsed = weeklySlots
    .map((entry) => parseWeeklySlot(entry, userId))
    .filter((slot): slot is ParsedWeeklySlot => slot !== null);

  // Guard against duplicate entries in stored config (same day + time),
  // which would otherwise produce duplicate scheduling candidates.
  const uniqueByDayAndTime = new Map<string, ParsedWeeklySlot>();
  for (const slot of parsed) {
    const key = `${slot.dayOfWeek}-${slot.hours}:${slot.minutes}`;
    if (!uniqueByDayAndTime.has(key)) {
      uniqueByDayAndTime.set(key, slot);
    }
  }
  return [...uniqueByDayAndTime.values()];
}

/**
 * Temporal weekday: 1 = Monday, 7 = Sunday.
 * Our dayOfWeek: 0 = Sunday, 1 = Monday, ... 6 = Saturday.
 */
function toTemporalWeekday(dayOfWeek: number): number {
  return dayOfWeek === 0 ? 7 : dayOfWeek;
}

function findNextWeeklySlot(
  parsedSlots: ParsedWeeklySlot[],
  lastPostTime: Date | null,
  baseTime: Date,
  userTimezone: string,
  userId: string,
  fallbackTime: Date
): Date {
  if (parsedSlots.length === 0) {
    return fallbackTime;
  }

  const baseZoned = fromDate(baseTime, userTimezone);
  const lastPostZoned = lastPostTime
    ? fromDate(lastPostTime, userTimezone)
    : null;

  const candidates: Date[] = [];

  for (let daysAhead = 0; daysAhead < 8; daysAhead++) {
    const dateZoned = addDays(baseZoned, daysAhead);
    const year = dateZoned.year;
    const month = dateZoned.month;
    const day = dateZoned.day;
    const weekday = dateZoned.dayOfWeek;

    for (const slot of parsedSlots) {
      if (toTemporalWeekday(slot.dayOfWeek) !== weekday) {
        continue;
      }
      try {
        const slotZoned = createZonedDateTime(
          year,
          month,
          day,
          slot.hours,
          slot.minutes,
          userTimezone
        );
        const slotDate = toDate(slotZoned);
        if (isValidDate(slotDate)) {
          candidates.push(slotDate);
        }
      } catch (error) {
        logError(error instanceof Error ? error : new Error(String(error)), {
          userId,
          message: "Error creating weekly slot datetime",
          dayOfWeek: slot.dayOfWeek,
          hours: slot.hours,
          minutes: slot.minutes,
        });
      }
    }
  }

  const baseTimeZoned = fromDate(baseTime, userTimezone);
  const sortedCandidates = candidates
    .map((d) => ({ date: d, zoned: fromDate(d, userTimezone) }))
    .filter(
      ({ zoned }) =>
        isAfter(zoned, baseTimeZoned) ||
        compareZonedDateTime(zoned, baseTimeZoned) === 0
    )
    .filter(({ zoned }) => !lastPostZoned || isAfter(zoned, lastPostZoned))
    .sort((a, b) => compareZonedDateTime(a.zoned, b.zoned));

  const first = sortedCandidates[0];
  return first ? first.date : fallbackTime;
}

async function calculateWeeklySlotsSchedule(
  config: unknown,
  lastPostTime: Date | null,
  baseTime: Date,
  userTimezone: string,
  userId: string
): Promise<Date> {
  const weeklySlots =
    config &&
    isWeeklySlotsScheduleConfig(config) &&
    typeof config === "object" &&
    "weeklySlots" in config &&
    Array.isArray(config.weeklySlots)
      ? config.weeklySlots
      : [];

  const parsedSlots = parseWeeklySlots(weeklySlots, userId);
  const fallbackTime = getDefaultFutureTime(baseTime);

  return findNextWeeklySlot(
    parsedSlots,
    lastPostTime,
    baseTime,
    userTimezone,
    userId,
    fallbackTime
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
      : toDate(nowUTC());

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

    if (scheduleType === "WEEKLY_SLOTS") {
      return await calculateWeeklySlotsSchedule(
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
