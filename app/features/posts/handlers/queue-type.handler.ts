/**
 * Queue Type Handlers for Bulk Posts
 *
 * Handles queue type changes for individual and bulk posts
 */

import { logClientError } from "~/lib/error-handler.client";
import {
  addDays,
  addHours,
  createZonedDateTime,
  formatForDateTimeLocal,
  fromDate,
  parseDateTimeLocal,
  toDate,
} from "~/lib/temporal";

import type { BulkPostsHandlerDeps } from "../types";
import {
  isIntervalScheduleConfig,
  isFixedSlotsScheduleConfig,
  isWeeklySlotsScheduleConfig,
} from "../types";

import { updateDisplayedHashtags } from "./hashtag.handler";

// ============================================================================
// Helper Functions for Schedule Calculation
// ============================================================================

function formatDateToDateTimeLocal(date: Date, userTimezone = "UTC"): string {
  // Use Temporal for consistency
  const zoned = fromDate(date, userTimezone);
  return formatForDateTimeLocal(zoned, userTimezone);
}

function getIntervalHours(
  config: unknown,
  user: BulkPostsHandlerDeps["user"]
): number {
  if (!config || !isIntervalScheduleConfig(config)) {
    return 4;
  }
  if (config.useGlobalInterval) {
    return user?.scheduleInterval?.[0] ?? 4;
  }
  return config.intervalHours ?? 4;
}

function calculateIntervalScheduleTime(
  baseDate: Date,
  index: number,
  config: unknown,
  user: BulkPostsHandlerDeps["user"]
): string {
  const intervalHours = getIntervalHours(config, user);
  const userTimezone = user?.timezone ?? "UTC";
  const baseZoned = fromDate(baseDate, userTimezone);
  const newZoned = addHours(baseZoned, index * intervalHours);
  return formatDateToDateTimeLocal(toDate(newZoned), userTimezone);
}

interface SlotInfo {
  slot: string;
  hours: number;
  minutes: number;
  totalMinutes: number;
}

function parseAndSortSlots(slots: string[]): SlotInfo[] {
  return slots
    .map((slot) => {
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

function findCurrentSlotIndex(sortedSlots: SlotInfo[], baseDate: Date): number {
  const baseHours = baseDate.getHours();
  const baseMinutes = baseDate.getMinutes();
  const baseTotalMinutes = baseHours * 60 + baseMinutes;

  for (let i = 0; i < sortedSlots.length; i++) {
    const slot = sortedSlots[i];
    if (slot && slot.totalMinutes >= baseTotalMinutes) {
      return i;
    }
  }
  return 0;
}

function calculateFixedSlotsScheduleTime(
  baseDate: Date,
  index: number,
  config: unknown,
  fallbackTime: string
): string {
  if (!config || !isFixedSlotsScheduleConfig(config)) {
    return fallbackTime;
  }

  const slots = config.slots ?? []; // eslint-disable-line @typescript-eslint/no-unnecessary-condition -- config.slots can be undefined
  if (slots.length === 0) {
    return fallbackTime;
  }

  const sortedSlots = parseAndSortSlots(slots);
  const currentSlotIndex = findCurrentSlotIndex(sortedSlots, baseDate);
  const targetSlotIndex = (currentSlotIndex + index) % sortedSlots.length;
  const targetSlot = sortedSlots[targetSlotIndex];

  if (!targetSlot) {
    return fallbackTime;
  }

  const daysToAdd = Math.floor((currentSlotIndex + index) / sortedSlots.length);
  // user is not available in this scope - use UTC as default
  const userTimezone = "UTC";
  const baseZoned = fromDate(baseDate, userTimezone);
  const dateWithSlot = baseZoned.with({
    hour: targetSlot.hours,
    minute: targetSlot.minutes,
    second: 0,
    millisecond: 0,
  });
  const newZoned = addDays(dateWithSlot, daysToAdd);
  return formatDateToDateTimeLocal(toDate(newZoned), userTimezone);
}

interface ParsedWeeklySlot {
  dayOfWeek: number;
  hours: number;
  minutes: number;
}

function parseWeeklySlotEntry(entry: {
  dayOfWeek: number;
  time: string;
}): ParsedWeeklySlot | null {
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

function toTemporalWeekday(dayOfWeek: number): number {
  return dayOfWeek === 0 ? 7 : dayOfWeek;
}

function findNextWeeklySlotDate(
  parsedSlots: ParsedWeeklySlot[],
  afterDate: Date,
  userTimezone: string
): Date | null {
  if (parsedSlots.length === 0) return null;
  const baseZoned = fromDate(afterDate, userTimezone);
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
          userTimezone
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

function calculateWeeklySlotsScheduleTime(
  baseDate: Date,
  index: number,
  config: unknown,
  userTimezone: string,
  fallbackTime: string
): string {
  if (!config || !isWeeklySlotsScheduleConfig(config)) {
    return fallbackTime;
  }
  const weeklySlots = config.weeklySlots;
  const parsedSlots = weeklySlots
    .map((entry) => parseWeeklySlotEntry(entry))
    .filter((s): s is ParsedWeeklySlot => s !== null);
  if (parsedSlots.length === 0) return fallbackTime;

  // For all indices (including 0), use the next available weekly slot from baseDate.
  // Search from 1ms before baseDate so a slot exactly at baseDate is included.
  const searchFrom = index === 0 ? new Date(baseDate.getTime() - 1) : baseDate;
  let current = searchFrom;
  let next: Date | null = null;
  for (let i = 0; i <= index; i++) {
    next = findNextWeeklySlotDate(parsedSlots, current, userTimezone);
    if (!next) return fallbackTime;
    current = new Date(next.getTime() + 1);
  }
  return next ? formatDateToDateTimeLocal(next, userTimezone) : fallbackTime;
}

function calculateScheduleTime(
  baseTime: string,
  index: number,
  queueTypeConfig: { scheduleType: string; scheduleConfig: unknown },
  user: BulkPostsHandlerDeps["user"],
  fallbackTime: string
): string {
  // Use Temporal for consistency
  const userTimezone = user?.timezone ?? "UTC";
  const baseZoned = parseDateTimeLocal(baseTime, userTimezone);
  const baseDate = toDate(baseZoned);

  if (queueTypeConfig.scheduleType === "INTERVAL") {
    return calculateIntervalScheduleTime(
      baseDate,
      index,
      queueTypeConfig.scheduleConfig,
      user
    );
  }

  if (queueTypeConfig.scheduleType === "FIXED_SLOTS") {
    return calculateFixedSlotsScheduleTime(
      baseDate,
      index,
      queueTypeConfig.scheduleConfig,
      fallbackTime
    );
  }

  if (queueTypeConfig.scheduleType === "WEEKLY_SLOTS") {
    return calculateWeeklySlotsScheduleTime(
      baseDate,
      index,
      queueTypeConfig.scheduleConfig,
      userTimezone,
      fallbackTime
    );
  }

  return "";
}

/**
 * Handle queue type change for a single post
 */
export async function handleQueueTypeChange(
  index: number,
  value: string,
  deps: Pick<
    BulkPostsHandlerDeps,
    | "posts"
    | "setPosts"
    | "queueTypes"
    | "tags"
    | "user"
    | "setDisplayedHashtags"
    | "setSelectedQueueType"
  >
): Promise<void> {
  const {
    posts,
    setPosts,
    queueTypes,
    tags,
    user,
    setDisplayedHashtags,
    setSelectedQueueType,
  } = deps;
  const updatedPosts = [...posts];
  const postToUpdate = updatedPosts[index];
  if (!postToUpdate) return;
  postToUpdate.queueType = value;

  // Find the queue type object to get its ID
  const selectedQueueType = queueTypes.find(
    (qt) => (typeof qt === "string" ? qt : qt.name) === value
  );
  const queueTypeId =
    typeof selectedQueueType === "object" ? selectedQueueType.id : null;

  // Auto-calculate schedule time if not unassigned
  if (value !== "unassigned" && queueTypeId) {
    try {
      const requestBody = {
        queueTypeId,
        queueTypeName: value, // Keep for backward compatibility
        userId: user?.id,
      };

      const response = await fetch("/api/queue-schedule", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      if (response.ok) {
        const responseData = (await response.json()) as {
          scheduledTime?: string;
        };
        const { scheduledTime } = responseData;
        if (scheduledTime) {
          const postToUpdate = updatedPosts[index];
          if (postToUpdate) {
            postToUpdate.scheduledFor = scheduledTime;
          }
        }
      }
    } catch (error) {
      logClientError(
        error instanceof Error ? error : new Error(String(error)),
        {
          component: "bulkposts",
          action: "handleQueueTypeChange",
          queueType: value,
        }
      );
    }
  } else {
    const postToUpdate = updatedPosts[index];
    if (postToUpdate) {
      postToUpdate.scheduledFor = "";
    }
  }

  setPosts(updatedPosts);

  // Update displayed hashtags if this is the predominant queue type
  const queueTypeCounts: Record<string, number> = {};
  updatedPosts.forEach((post) => {
    queueTypeCounts[post.queueType] =
      (queueTypeCounts[post.queueType] ?? 0) + 1;
  });

  const mostUsedQueueType = Object.keys(queueTypeCounts).reduce(
    (a, b) => ((queueTypeCounts[a] ?? 0) > (queueTypeCounts[b] ?? 0) ? a : b),
    "unassigned"
  );

  if (mostUsedQueueType !== value) {
    await updateDisplayedHashtags(
      mostUsedQueueType,
      queueTypes,
      tags,
      setSelectedQueueType,
      setDisplayedHashtags
    );
  }
}

/**
 * Handle bulk queue update for all posts
 */
export async function handleBulkQueueUpdate(
  queueType: string,
  deps: Pick<
    BulkPostsHandlerDeps,
    | "posts"
    | "setPosts"
    | "queueTypes"
    | "tags"
    | "user"
    | "setDisplayedHashtags"
    | "setSelectedQueueType"
    | "firstItemTimeManuallyChanged"
  >
): Promise<void> {
  const {
    posts,
    setPosts,
    queueTypes,
    tags,
    user,
    setDisplayedHashtags,
    setSelectedQueueType,
    firstItemTimeManuallyChanged,
  } = deps;

  if (posts.length === 0) return Promise.resolve();

  // Update displayed hashtags
  await updateDisplayedHashtags(
    queueType,
    queueTypes,
    tags,
    setSelectedQueueType,
    setDisplayedHashtags
  );

  // Get the base schedule time from the API (this is the next available time after last scheduled post)
  let baseTime: string | null = null;
  if (queueType !== "unassigned") {
    // If first item time was manually changed, use it as base
    const firstPost = posts[0];
    if (firstItemTimeManuallyChanged && firstPost?.scheduledFor) {
      baseTime = firstPost.scheduledFor;
    } else {
      // Original behavior - fetch from API
      const selectedQueueType = queueTypes.find(
        (qt) => (typeof qt === "string" ? qt : qt.name) === queueType
      );
      const queueTypeId =
        typeof selectedQueueType === "object" ? selectedQueueType.id : null;

      const requestBody = {
        queueTypeId,
        queueTypeName: queueType, // Keep for backward compatibility
        userId: user?.id,
      };

      const response = await fetch("/api/queue-schedule", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      if (response.ok) {
        const responseData = (await response.json()) as {
          scheduledTime?: string;
        };
        const { scheduledTime } = responseData;
        baseTime = scheduledTime ?? null;
      }
    }
  }

  // Find the queue type configuration for bulk scheduling
  const queueTypeConfig = queueTypes.find((qt) => qt.name === queueType);

  const updatedPosts = posts.map((post, index) => {
    let scheduledFor = post.scheduledFor;

    if (queueType === "unassigned") {
      scheduledFor = "";
    } else if (
      queueType !== "unassigned" &&
      baseTime &&
      queueTypeConfig &&
      typeof queueTypeConfig === "object" &&
      "scheduleType" in queueTypeConfig &&
      "scheduleConfig" in queueTypeConfig
    ) {
      const calculatedTime = calculateScheduleTime(
        baseTime,
        index,
        {
          scheduleType: String(queueTypeConfig.scheduleType),
          scheduleConfig: queueTypeConfig.scheduleConfig,
        },
        user,
        post.scheduledFor
      );
      if (calculatedTime) {
        scheduledFor = calculatedTime;
      }
    }

    return {
      ...post,
      queueType,
      scheduledFor,
    };
  });

  setPosts(updatedPosts);
}
