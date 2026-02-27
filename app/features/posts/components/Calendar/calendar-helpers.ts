/**
 * Shared helpers for Calendar: post longform detection, same-slot comparison, drop datetime string, a11y labels.
 */

import {
  formatForDisplay,
  fromDate,
  nowInTimezone,
  parseDateTimeLocal,
} from "~/lib/temporal";

import type { CalendarPost } from "./PostBlock.types";

/** Whether this post is treated as longform in the current context (isAll tab vs single content type). */
export function getPostIsLongform(
  post: CalendarPost,
  isLongform: boolean,
  isAll: boolean
): boolean {
  return isAll ? Boolean(post.title && post.publishedAt) : isLongform;
}

/** True when currentMs (UTC epoch) and newDateTime fall in the same calendar half-hour slot in userTimezone. */
export function isSameCalendarSlot(
  currentMs: number,
  newDateTime: Date,
  userTimezone: string
): boolean {
  const currentZoned = fromDate(new Date(currentMs), userTimezone);
  const newZoned = fromDate(newDateTime, userTimezone);
  const slotMin = (m: number) => (m < 30 ? 0 : 30);
  const key = (y: number, m: number, d: number, h: number, min: number) =>
    `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}-${String(h).padStart(2, "0")}:${String(slotMin(min)).padStart(2, "0")}`;
  const currentKey = key(
    currentZoned.year,
    currentZoned.month,
    currentZoned.day,
    currentZoned.hour,
    currentZoned.minute
  );
  const newKey = key(
    newZoned.year,
    newZoned.month,
    newZoned.day,
    newZoned.hour,
    newZoned.minute
  );
  return currentKey === newKey;
}

/** Build datetime-local string for drop (YYYY-MM-DDTHH:mm). Used by Week/Day and Month views. */
export function buildDropIsoString(dateKey: string, time: string): string {
  return `${dateKey}T${time}`;
}

/** True when a drop slot (date + time) is in the past for userTimezone. */
export function isCalendarDropSlotInPast(
  dateKey: string,
  time: string,
  userTimezone: string
): boolean {
  const slot = parseDateTimeLocal(
    buildDropIsoString(dateKey, time),
    userTimezone
  );
  const now = nowInTimezone(userTimezone);
  return slot.epochNanoseconds <= now.epochNanoseconds;
}

/** Format a slot for aria-label on drop targets (e.g. "Drop slot: Tuesday, 17 February, 2:00 PM"). */
export function formatDropSlotAriaLabel(
  dateKey: string,
  time: string,
  userTimezone: string,
  dateLocale: "en-GB" | "en-US" | "sv" = "en-GB"
): string {
  const iso = buildDropIsoString(dateKey, time);
  const zoned = parseDateTimeLocal(iso, userTimezone);
  return `Drop slot: ${formatForDisplay(
    zoned,
    userTimezone,
    {
      weekday: "long",
      day: "numeric",
      month: "long",
      hour: "2-digit",
      minute: "2-digit",
    },
    undefined,
    dateLocale
  )}`;
}
