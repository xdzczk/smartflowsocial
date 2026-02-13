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
  /** Per-queue counts for this day (queue name or "Unassigned"). */
  byQueue?: Array<{ queueName: string; count: number }>;
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
  const byQueueByDateKey: Record<
    string,
    Array<{ queueName: string; count: number }>
  > = {};

  function addPost(
    scheduledAtUtc: Date | null,
    queueType: { name: string } | null
  ) {
    if (scheduledAtUtc == null) return;
    const zoned = fromDate(scheduledAtUtc, tz);
    const dateKey = toDateKey(zoned);
    countByDateKey[dateKey] = (countByDateKey[dateKey] ?? 0) + 1;
    const queueName = queueType?.name ?? "Unassigned";
    const arr = byQueueByDateKey[dateKey] ?? [];
    const entry = arr.find((e) => e.queueName === queueName);
    if (entry) {
      entry.count += 1;
    } else {
      arr.push({ queueName, count: 1 });
      byQueueByDateKey[dateKey] = arr;
    }
  }

  for (const { scheduledAtUtc, queueType } of posts) {
    addPost(scheduledAtUtc, queueType);
  }
  for (const { scheduledAtUtc, queueType } of longformPosts) {
    addPost(scheduledAtUtc, queueType);
  }

  return buildDaysWithCounts(start, tz, countByDateKey, byQueueByDateKey);
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
  const byQueueByDateKey: Record<
    string,
    Array<{ queueName: string; count: number }>
  > = {};
  return buildDaysWithCounts(start, tz, countByDateKey, byQueueByDateKey);
}

function buildDaysWithCounts(
  start: Temporal.ZonedDateTime,
  tz: string,
  countByDateKey: Record<string, number>,
  byQueueByDateKey: Record<string, Array<{ queueName: string; count: number }>>
): ScheduleDayCount[] {
  const result: ScheduleDayCount[] = [];
  for (let i = 0; i < NEXT_7_DAYS; i++) {
    const day = addDays(start, i);
    const dateKey = toDateKey(day);
    result.push({
      dateKey,
      count: countByDateKey[dateKey] ?? 0,
      byQueue: byQueueByDateKey[dateKey] ?? [],
    });
  }
  return result;
}
