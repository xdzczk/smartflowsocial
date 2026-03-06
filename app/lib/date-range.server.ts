/**
 * Parse YYYY-MM-DD query params to UTC date range (start of day, end of day).
 * Used by Scheduled and Published loaders for server-side date filtering.
 */

import { Temporal } from "@js-temporal/polyfill";

const DATE_ONLY_REGEX = /^\d{4}-\d{2}-\d{2}$/;

function isValidDateOnly(s: string): boolean {
  if (!DATE_ONLY_REGEX.test(s)) return false;
  try {
    Temporal.PlainDate.from(s);
    return true;
  } catch {
    return false;
  }
}

/**
 * Returns { fromUtc, toUtc } for the given date strings (YYYY-MM-DD), interpreting
 * each date as a calendar day in the given timezone. Use this when the user picks
 * dates in their local timezone so the filter matches their expectation.
 * - fromUtc: start of dateFrom at 00:00:00 in timezone, converted to UTC
 * - toUtc: end of dateTo at 23:59:59.999 in timezone, converted to UTC
 */
export function parseDateRangeInTimezone(
  dateFrom: string | null | undefined,
  dateTo: string | null | undefined,
  timezone: string
): { fromUtc?: Date; toUtc?: Date } | undefined {
  const from = dateFrom?.trim();
  const to = dateTo?.trim();
  if (!from && !to) return undefined;
  const hasFrom = from && isValidDateOnly(from);
  const hasTo = to && isValidDateOnly(to);
  if (!hasFrom && !hasTo) return undefined;
  const tz = timezone.trim() || "UTC";

  let fromUtc: Date | undefined;
  let toUtc: Date | undefined;
  try {
    if (hasFrom && from) {
      const startZ = Temporal.PlainDate.from(from).toZonedDateTime(tz);
      fromUtc = new Date(startZ.epochMilliseconds);
    }
    if (hasTo && to) {
      const endDayZ = Temporal.PlainDate.from(to).toZonedDateTime(tz);
      const endOfDayZ = endDayZ.add({ days: 1 }).subtract({ milliseconds: 1 });
      toUtc = new Date(endOfDayZ.epochMilliseconds);
    }
  } catch {
    return undefined;
  }
  return { fromUtc, toUtc };
}

/**
 * Returns { fromUtc, toUtc } for the given date strings (YYYY-MM-DD).
 * Interprets dates as UTC calendar days (legacy behavior).
 * - fromUtc: start of that day in UTC (00:00:00.000)
 * - toUtc: end of that day in UTC (23:59:59.999)
 * Prefer parseDateRangeInTimezone when user timezone is available.
 */
export function parseDateRangeUtc(
  dateFrom?: string | null,
  dateTo?: string | null
): { fromUtc?: Date; toUtc?: Date } | undefined {
  const from = dateFrom?.trim();
  const to = dateTo?.trim();
  if (!from && !to) return undefined;
  const hasFrom = from && isValidDateOnly(from);
  const hasTo = to && isValidDateOnly(to);
  if (!hasFrom && !hasTo) return undefined;

  const fromUtc =
    hasFrom && from
      ? new Date(
          Date.UTC(
            parseInt(from.slice(0, 4), 10),
            parseInt(from.slice(5, 7), 10) - 1,
            parseInt(from.slice(8, 10), 10),
            0,
            0,
            0,
            0
          )
        )
      : undefined;
  const toUtc =
    hasTo && to
      ? new Date(
          Date.UTC(
            parseInt(to.slice(0, 4), 10),
            parseInt(to.slice(5, 7), 10) - 1,
            parseInt(to.slice(8, 10), 10),
            23,
            59,
            59,
            999
          )
        )
      : undefined;

  return { fromUtc, toUtc };
}
