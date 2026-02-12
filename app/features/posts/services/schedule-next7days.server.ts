/**
 * Next 7 days schedule overview: scheduled post counts per day in user timezone.
 */

import type { Temporal } from "~/lib/temporal";
import {
  addDays,
  endOfDay,
  fromDate,
  nowInTimezone,
  startOfDay,
  toPrismaDate,
} from "~/lib/temporal";
import { getScheduledLongFormPostsInDateRange } from "~/models/longformpost.server";
import { getScheduledPostsInDateRange } from "~/models/post.queries.server";

export interface ScheduleDayCount {
  dateKey: string;
  count: number;
}

const NEXT_7_DAYS = 7;

/**
 * Returns scheduled post counts per calendar day for the next 7 days (today through day 6)
 * in the user's timezone. Includes both regular posts and longform posts. Respects queueType.
 */
export async function getScheduleNext7DaysCounts(
  userId: string,
  queueType: string,
  userTimezone: string
): Promise<ScheduleDayCount[]> {
  const tz = userTimezone || "Etc/UTC";
  const now = nowInTimezone(tz);
  const start = startOfDay(now, tz);
  const endDayLast = addDays(start, NEXT_7_DAYS - 1);
  const end = endOfDay(endDayLast, tz);

  const fromUtc = toPrismaDate(start);
  const toUtc = toPrismaDate(end);
  if (!fromUtc || !toUtc) {
    return buildEmptyDays(start, tz);
  }

  const [posts, longformPosts] = await Promise.all([
    getScheduledPostsInDateRange({ userId, queueType, fromUtc, toUtc }),
    getScheduledLongFormPostsInDateRange({
      userId,
      queueType,
      fromUtc,
      toUtc,
    }),
  ]);

  const countByDateKey: Record<string, number> = {};

  for (const { scheduledAtUtc } of posts) {
    if (scheduledAtUtc == null) continue;
    const zoned = fromDate(scheduledAtUtc, tz);
    const dateKey = toDateKey(zoned);
    countByDateKey[dateKey] = (countByDateKey[dateKey] ?? 0) + 1;
  }
  for (const { scheduledAtUtc } of longformPosts) {
    if (scheduledAtUtc == null) continue;
    const zoned = fromDate(scheduledAtUtc, tz);
    const dateKey = toDateKey(zoned);
    countByDateKey[dateKey] = (countByDateKey[dateKey] ?? 0) + 1;
  }

  return buildDaysWithCounts(start, tz, countByDateKey);
}

function toDateKey(zoned: Temporal.ZonedDateTime): string {
  const m = String(zoned.month).padStart(2, "0");
  const d = String(zoned.day).padStart(2, "0");
  return `${zoned.year}-${m}-${d}`;
}

function buildEmptyDays(
  start: Temporal.ZonedDateTime,
  tz: string
): ScheduleDayCount[] {
  const countByDateKey: Record<string, number> = {};
  return buildDaysWithCounts(start, tz, countByDateKey);
}

function buildDaysWithCounts(
  start: Temporal.ZonedDateTime,
  tz: string,
  countByDateKey: Record<string, number>
): ScheduleDayCount[] {
  const result: ScheduleDayCount[] = [];
  for (let i = 0; i < NEXT_7_DAYS; i++) {
    const day = addDays(start, i);
    const dateKey = toDateKey(day);
    result.push({
      dateKey,
      count: countByDateKey[dateKey] ?? 0,
    });
  }
  return result;
}
