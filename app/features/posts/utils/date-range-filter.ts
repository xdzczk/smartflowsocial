/**
 * Helpers for client-side date range filtering (Scheduled / Published pages).
 * Dates are compared by calendar day (YYYY-MM-DD); time is ignored.
 */

import { nowInTimezone } from "~/lib/temporal";

/** Today's date in the given timezone as YYYY-MM-DD (for date input min/max). */
export function getTodayInTimezone(timezone: string): string {
  const tz = timezone.trim() || "UTC";
  const now = nowInTimezone(tz);
  const y = now.year;
  const m = String(now.month).padStart(2, "0");
  const d = String(now.day).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function toDateOnly(d: Date | string | null | undefined): string | null {
  if (d == null) return null;
  const date = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(date.getTime())) return null;
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Returns true if the given date falls within [from, to] (inclusive).
 * - If from is empty, no lower bound.
 * - If to is empty, no upper bound.
 */
export function isDateInRange(
  date: Date | string | null | undefined,
  from: string,
  to: string
): boolean {
  const dateStr = toDateOnly(date);
  if (dateStr == null) return false;
  if (from && dateStr < from) return false;
  if (to && dateStr > to) return false;
  return true;
}
