/**
 * Helpers for client-side date range filtering (Scheduled / Published pages).
 * Dates are compared by calendar day (YYYY-MM-DD); time is ignored.
 */

import { addDays, nowInTimezone } from "~/lib/temporal";

/** Today's date in the given timezone as YYYY-MM-DD (for date input min/max). */
export function getTodayInTimezone(timezone: string): string {
  const tz = timezone.trim() || "UTC";
  const now = nowInTimezone(tz);
  return formatDateOnly(now);
}

/** Format a ZonedDateTime as YYYY-MM-DD. */
function formatDateOnly(zoned: {
  year: number;
  month: number;
  day: number;
}): string {
  const y = zoned.year;
  const m = String(zoned.month).padStart(2, "0");
  const d = String(zoned.day).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Date in timezone, today + daysOffset, as YYYY-MM-DD. */
function getDateInTimezone(timezone: string, daysOffset: number): string {
  const tz = timezone.trim() || "UTC";
  const now = nowInTimezone(tz);
  const target = addDays(now, daysOffset);
  return formatDateOnly(target);
}

/** Next 7 days (today through today+6). For Scheduled. */
export function getNext7DaysRange(timezone: string): {
  from: string;
  to: string;
} {
  const today = getTodayInTimezone(timezone);
  return { from: today, to: getDateInTimezone(timezone, 6) };
}

/** Next 30 days (today through today+29). For Scheduled. */
export function getNext30DaysRange(timezone: string): {
  from: string;
  to: string;
} {
  const today = getTodayInTimezone(timezone);
  return { from: today, to: getDateInTimezone(timezone, 29) };
}

/** Past 7 days (today-6 through today). For Published / Recyclables. */
export function getPast7DaysRange(timezone: string): {
  from: string;
  to: string;
} {
  return {
    from: getDateInTimezone(timezone, -6),
    to: getTodayInTimezone(timezone),
  };
}

/** Past 30 days (today-29 through today). For Published / Recyclables. */
export function getPast30DaysRange(timezone: string): {
  from: string;
  to: string;
} {
  return {
    from: getDateInTimezone(timezone, -29),
    to: getTodayInTimezone(timezone),
  };
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

const DATE_ONLY_REGEX = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Format a YYYY-MM-DD string for display using the user's date format preference.
 * Use when showing the selected date range in the filter (respects user's date format).
 */
export function formatDateOnlyForDisplay(
  isoDate: string,
  dateFormat: "ddmmyyyy" | "mmddyyyy" | "yyyymmdd"
): string {
  if (!DATE_ONLY_REGEX.test(isoDate)) return isoDate;
  const [y, m, d] = [
    isoDate.slice(0, 4),
    isoDate.slice(5, 7),
    isoDate.slice(8, 10),
  ];
  switch (dateFormat) {
    case "mmddyyyy":
      return `${m}/${d}/${y}`;
    case "yyyymmdd":
      return `${y}-${m}-${d}`;
    default:
      return `${d}/${m}/${y}`;
  }
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
