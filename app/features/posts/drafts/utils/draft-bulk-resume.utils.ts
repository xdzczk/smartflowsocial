/**
 * Pure helpers for draft bulk resume: interval hours, schedule offset, fetch next slot time.
 */

import {
  isFixedSlotsScheduleConfig,
  isIntervalScheduleConfig,
  isWeeklySlotsScheduleConfig,
} from "~/features/posts/types";
import type { QueueType } from "~/features/posts/types";
import { handleErrorSafely } from "~/lib/error-handler.client";
import {
  addDays,
  addHours,
  createZonedDateTime,
  formatForDateTimeLocal,
  fromDate,
  parseDateTimeLocal,
  toDate,
} from "~/lib/temporal";

export function getIntervalHours(
  config: unknown,
  currentUser: { scheduleInterval?: unknown } | null
): number {
  if (!isIntervalScheduleConfig(config)) {
    return 4;
  }

  if (config.useGlobalInterval) {
    const userIntervalRaw: unknown =
      currentUser &&
      typeof currentUser === "object" &&
      "scheduleInterval" in currentUser &&
      Array.isArray(currentUser.scheduleInterval) &&
      currentUser.scheduleInterval.length > 0
        ? currentUser.scheduleInterval[0]
        : null;
    const userInterval =
      typeof userIntervalRaw === "number"
        ? userIntervalRaw
        : typeof userIntervalRaw === "string"
          ? Number(userIntervalRaw)
          : null;
    return userInterval && !isNaN(userInterval) ? userInterval : 4;
  }

  return config.intervalHours ?? 4;
}

interface ParsedSlot {
  slot: string;
  hours: number;
  minutes: number;
  totalMinutes: number;
}

function parseAndSortSlots(slots: string[]): ParsedSlot[] {
  return slots
    .map((slot: string) => {
      const parts = slot.split(":");
      const hours = parts[0] ? Number(parts[0]) : 0;
      const minutes = parts[1] ? Number(parts[1]) : 0;
      return {
        slot,
        hours,
        minutes,
        totalMinutes: hours * 60 + minutes,
      };
    })
    .sort((a, b) => a.totalMinutes - b.totalMinutes);
}

function calculateIntervalOffset(
  baseDate: Date,
  baseIndex: number,
  config: unknown,
  userData: { scheduleInterval?: unknown } | null
): Date {
  const intervalHours = getIntervalHours(config, userData);
  const baseZoned = fromDate(baseDate, "UTC");
  const offsetZoned = addHours(baseZoned, baseIndex * intervalHours);
  return toDate(offsetZoned);
}

function calculateFixedSlotsOffset(
  baseDate: Date,
  baseIndex: number,
  slots: string[]
): Date {
  if (slots.length === 0) return baseDate;

  const sortedSlots = parseAndSortSlots(slots);
  const baseZoned1 = fromDate(baseDate, "UTC");
  const baseTotalMinutes = baseZoned1.hour * 60 + baseZoned1.minute;

  let currentSlotIndex = 0;
  for (let i = 0; i < sortedSlots.length; i++) {
    const slot = sortedSlots[i];
    if (slot && slot.totalMinutes >= baseTotalMinutes) {
      currentSlotIndex = i;
      break;
    }
  }

  const targetSlotIndex = (currentSlotIndex + baseIndex) % sortedSlots.length;
  const targetSlot = sortedSlots[targetSlotIndex];
  if (!targetSlot) return baseDate;

  const daysToAdd = Math.floor(
    (currentSlotIndex + baseIndex) / sortedSlots.length
  );
  const baseZoned2 = fromDate(baseDate, "UTC");
  const dateWithSlot = baseZoned2.with({
    hour: targetSlot.hours,
    minute: targetSlot.minutes,
    second: 0,
    millisecond: 0,
  });
  const offsetZoned = addDays(dateWithSlot, daysToAdd);
  return toDate(offsetZoned);
}

function toTemporalWeekday(dayOfWeek: number): number {
  return dayOfWeek === 0 ? 7 : dayOfWeek;
}

function findNextWeeklySlotDate(
  parsedSlots: Array<{ dayOfWeek: number; hours: number; minutes: number }>,
  afterDate: Date,
  tz: string
): Date | null {
  if (parsedSlots.length === 0) return null;
  const baseZoned = fromDate(afterDate, tz);
  const candidates: Date[] = [];
  for (let daysAhead = 0; daysAhead < 8; daysAhead++) {
    const dateZoned = addDays(baseZoned, daysAhead);
    const year = dateZoned.year;
    const month = dateZoned.month;
    const day = dateZoned.day;
    const weekday = dateZoned.dayOfWeek;
    for (const slot of parsedSlots) {
      if (toTemporalWeekday(slot.dayOfWeek) !== weekday) continue;
      try {
        const slotZoned = createZonedDateTime(
          year,
          month,
          day,
          slot.hours,
          slot.minutes,
          tz
        );
        const slotDate = toDate(slotZoned);
        if (slotDate.getTime() > afterDate.getTime()) {
          candidates.push(slotDate);
        }
      } catch {
        // skip invalid slot
      }
    }
  }
  candidates.sort((a, b) => a.getTime() - b.getTime());
  return candidates[0] ?? null;
}

function calculateWeeklySlotsOffset(
  baseDate: Date,
  baseIndex: number,
  weeklySlots: Array<{ dayOfWeek: number; time: string }>,
  tz: string
): Date {
  const parsedSlots = weeklySlots
    .map((entry) => {
      const parts = String(entry.time).trim().split(":");
      const hours = parts[0] ? Number(parts[0]) : 0;
      const minutes = parts[1] ? Number(parts[1]) : 0;
      if (
        entry.dayOfWeek < 0 ||
        entry.dayOfWeek > 6 ||
        Number.isNaN(hours) ||
        Number.isNaN(minutes) ||
        hours < 0 ||
        hours > 23 ||
        minutes < 0 ||
        minutes > 59
      ) {
        return null;
      }
      return { dayOfWeek: entry.dayOfWeek, hours, minutes };
    })
    .filter(
      (s): s is { dayOfWeek: number; hours: number; minutes: number } =>
        s !== null
    );
  if (parsedSlots.length === 0) return baseDate;
  if (baseIndex === 0) return baseDate;
  let current = baseDate;
  let next: Date | null = null;
  for (let i = 0; i < baseIndex; i++) {
    next = findNextWeeklySlotDate(parsedSlots, current, tz);
    if (!next) return baseDate;
    current = new Date(next.getTime() + 1);
  }
  return next ?? baseDate;
}

export function applyScheduleOffset(
  baseDate: Date,
  baseIndex: number,
  queueType: QueueType,
  user: { scheduleInterval?: unknown; timezone?: string | null } | null
): Date {
  if (baseIndex === 0) return baseDate;

  if (
    typeof queueType !== "object" ||
    !("scheduleType" in queueType) ||
    !queueType.scheduleType
  ) {
    return baseDate;
  }

  const config =
    typeof queueType === "object" && "scheduleConfig" in queueType
      ? queueType.scheduleConfig
      : null;
  const userTimezone = user?.timezone ?? "UTC";

  if (queueType.scheduleType === "INTERVAL") {
    return calculateIntervalOffset(baseDate, baseIndex, config, user);
  }

  if (queueType.scheduleType === "WEEKLY_SLOTS") {
    const weeklySlots =
      config && isWeeklySlotsScheduleConfig(config) ? config.weeklySlots : [];
    return calculateWeeklySlotsOffset(
      baseDate,
      baseIndex,
      weeklySlots,
      userTimezone
    );
  }

  const slots =
    config && isFixedSlotsScheduleConfig(config) ? config.slots : [];
  return calculateFixedSlotsOffset(baseDate, baseIndex, slots);
}

/**
 * Fetch next scheduled time for a queue type by ID.
 * Caller must resolve queue type name to ID (e.g. from queueTypes list) before calling.
 */
export async function fetchScheduledTime(
  queueTypeId: string | null,
  userId: string | undefined
): Promise<string | null> {
  if (!queueTypeId || queueTypeId === "unassigned") return null;
  try {
    const response = await fetch("/api/queue-schedule", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ queueTypeId, userId }),
    });

    if (!response.ok) return null;

    const dataRaw: unknown = await response.json();
    const data =
      dataRaw && typeof dataRaw === "object" && !Array.isArray(dataRaw)
        ? (dataRaw as { scheduledTime?: unknown })
        : {};
    const scheduledTime =
      typeof data.scheduledTime === "string" ? data.scheduledTime : undefined;
    return scheduledTime ?? null;
  } catch (error) {
    handleErrorSafely(error, {
      component: "DraftBulkResume",
      action: "fetchScheduledTime",
    });
    return null;
  }
}

/** Format a date for datetime-local input. */
export function formatForDateTimeLocalExport(
  zoned: ReturnType<typeof fromDate>,
  userTimezone: string
): string {
  return formatForDateTimeLocal(zoned, userTimezone);
}

/** Parse scheduled time string and apply offset, return formatted string. */
export function applyOffsetAndFormat(
  scheduledTime: string,
  baseIndex: number,
  queueType: QueueType,
  user: { scheduleInterval?: unknown; timezone?: string | null } | null
): string {
  const userTimezone = user?.timezone ?? "UTC";
  const baseZoned = parseDateTimeLocal(scheduledTime, userTimezone);
  const baseDate = toDate(baseZoned);
  const offsetDate = applyScheduleOffset(baseDate, baseIndex, queueType, user);
  const offsetZoned = fromDate(offsetDate, userTimezone);
  return formatForDateTimeLocal(offsetZoned, userTimezone);
}
