/**
 * Temporal API utilities for date/time operations
 *
 * This module provides a clean abstraction over the Temporal API polyfill,
 * offering utilities that replace common Date operations with Temporal equivalents.
 *
 * Benefits of Temporal:
 * - Immutable date/time objects
 * - Better timezone handling
 * - More intuitive API
 * - No timezone confusion bugs
 */

import { Temporal } from "@js-temporal/polyfill";

// Re-export Temporal for direct access when needed
export { Temporal };

/**
 * Get the current time as a ZonedDateTime in UTC
 */
export function nowUTC(): Temporal.ZonedDateTime {
  return Temporal.Now.zonedDateTimeISO("UTC");
}

/**
 * Get the current time as a ZonedDateTime in a specific timezone
 */
export function nowInTimezone(timezone: string): Temporal.ZonedDateTime {
  return Temporal.Now.zonedDateTimeISO(timezone);
}

/**
 * Parse a datetime-local input string (YYYY-MM-DDTHH:mm) into a ZonedDateTime
 * @param dateTimeString - String in format YYYY-MM-DDTHH:mm
 * @param timezone - Target timezone (defaults to UTC)
 * @returns ZonedDateTime in the specified timezone
 */
export function parseDateTimeLocal(
  dateTimeString: string,
  timezone = "UTC"
): Temporal.ZonedDateTime {
  // Parse the datetime-local format (YYYY-MM-DDTHH:mm)
  const plainDateTime = Temporal.PlainDateTime.from(dateTimeString);
  return plainDateTime.toZonedDateTime(timezone);
}

/**
 * Format a ZonedDateTime for use in HTML datetime-local input
 * @param zonedDateTime - The ZonedDateTime to format
 * @param targetTimezone - Timezone to display in (defaults to UTC)
 * @returns Formatted date string in YYYY-MM-DDTHH:mm format
 */
export function formatForDateTimeLocal(
  zonedDateTime: Temporal.ZonedDateTime,
  targetTimezone = "UTC"
): string {
  // Convert to target timezone
  const inTargetTz = zonedDateTime.withTimeZone(targetTimezone);

  // Format as YYYY-MM-DDTHH:mm
  const year = String(inTargetTz.year).padStart(4, "0");
  const month = String(inTargetTz.month).padStart(2, "0");
  const day = String(inTargetTz.day).padStart(2, "0");
  const hour = String(inTargetTz.hour).padStart(2, "0");
  const minute = String(inTargetTz.minute).padStart(2, "0");

  return `${year}-${month}-${day}T${hour}:${minute}`;
}

/**
 * Convert a ZonedDateTime to Unix timestamp (seconds)
 */
export function toUnixTimestamp(zonedDateTime: Temporal.ZonedDateTime): number {
  return Number(zonedDateTime.epochMilliseconds) / 1000;
}

/**
 * Convert a Unix timestamp (seconds) to ZonedDateTime
 */
export function fromUnixTimestamp(
  timestamp: number,
  timezone = "UTC"
): Temporal.ZonedDateTime {
  return Temporal.Instant.fromEpochMilliseconds(
    timestamp * 1000
  ).toZonedDateTimeISO(timezone);
}

/**
 * Parse an ISO string directly to ZonedDateTime (replaces new Date(isoString))
 * Also accepts a JS Date for runtime safety (some callsites may pass Date objects).
 * @param isoString - ISO 8601 date string (e.g., "2024-01-15T14:30:00Z") or Date
 * @param timezone - Target timezone (defaults to UTC)
 */
export function fromISOString(
  isoString: string | Date,
  timezone = "UTC"
): Temporal.ZonedDateTime {
  // Runtime safety: some callers may pass Date objects (TS casts don't convert values)
  if (isoString instanceof Date) {
    return fromDate(isoString, timezone);
  }
  return Temporal.Instant.from(isoString).toZonedDateTimeISO(timezone);
}

/**
 * Convert a Date object to ZonedDateTime
 * @param date - JavaScript Date object
 * @param timezone - Target timezone (defaults to UTC)
 */
export function fromDate(date: Date, timezone = "UTC"): Temporal.ZonedDateTime {
  return Temporal.Instant.fromEpochMilliseconds(
    date.getTime()
  ).toZonedDateTimeISO(timezone);
}

/**
 * Convert a ZonedDateTime to JavaScript Date object
 * Note: This loses timezone information, converting to UTC
 */
export function toDate(zonedDateTime: Temporal.ZonedDateTime): Date {
  return new Date(Number(zonedDateTime.epochMilliseconds));
}

/**
 * Add hours to a ZonedDateTime.
 * Supports fractional hours (e.g. 0.25 = 15 min); Temporal only accepts integer duration fields,
 * so we add minutes when hours is not an integer.
 */
export function addHours(
  zonedDateTime: Temporal.ZonedDateTime,
  hours: number
): Temporal.ZonedDateTime {
  if (Number.isInteger(hours)) {
    return zonedDateTime.add({ hours });
  }
  const minutes = Math.round(hours * 60);
  return zonedDateTime.add({ minutes });
}

/**
 * Add minutes to a ZonedDateTime
 */
export function addMinutes(
  zonedDateTime: Temporal.ZonedDateTime,
  minutes: number
): Temporal.ZonedDateTime {
  return zonedDateTime.add({ minutes });
}

/**
 * Add days to a ZonedDateTime
 */
export function addDays(
  zonedDateTime: Temporal.ZonedDateTime,
  days: number
): Temporal.ZonedDateTime {
  return zonedDateTime.add({ days });
}

/**
 * Add months to a ZonedDateTime
 */
export function addMonths(
  zonedDateTime: Temporal.ZonedDateTime,
  months: number
): Temporal.ZonedDateTime {
  return zonedDateTime.add({ months });
}

/**
 * Format a ZonedDateTime for display
 * @param zonedDateTime - The ZonedDateTime to format
 * @param timezone - Timezone to display in
 * @param options - Intl.DateTimeFormatOptions
 * @param timeFormat - Optional time format preference ("12h" for AM/PM, "24h" for 24-hour)
 */
export function formatForDisplay(
  zonedDateTime: Temporal.ZonedDateTime,
  timezone: string,
  options?: Intl.DateTimeFormatOptions,
  timeFormat?: "12h" | "24h" | null
): string {
  const inTargetTz = zonedDateTime.withTimeZone(timezone);
  const date = toDate(inTargetTz);

  // Determine hour12 based on timeFormat preference
  const hour12 =
    timeFormat === "24h"
      ? false
      : timeFormat === "12h"
        ? true
        : (options?.hour12 ?? true);

  return date.toLocaleString("en-US", {
    timeZone: timezone,
    ...options,
    hour12,
  });
}

/**
 * Create a ZonedDateTime from individual components
 */
export function createZonedDateTime(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timezone = "UTC"
): Temporal.ZonedDateTime {
  const plainDateTime = new Temporal.PlainDateTime(
    year,
    month,
    day,
    hour,
    minute
  );
  return plainDateTime.toZonedDateTime(timezone);
}

/**
 * Compare two ZonedDateTimes
 * @returns -1 if a < b, 0 if a === b, 1 if a > b
 */
export function compareZonedDateTime(
  a: Temporal.ZonedDateTime,
  b: Temporal.ZonedDateTime
): number {
  if (Temporal.ZonedDateTime.compare(a, b) < 0) return -1;
  if (Temporal.ZonedDateTime.compare(a, b) > 0) return 1;
  return 0;
}

/**
 * Check if a ZonedDateTime is before another
 */
export function isBefore(
  a: Temporal.ZonedDateTime,
  b: Temporal.ZonedDateTime
): boolean {
  return Temporal.ZonedDateTime.compare(a, b) < 0;
}

/**
 * Check if a ZonedDateTime is after another
 */
export function isAfter(
  a: Temporal.ZonedDateTime,
  b: Temporal.ZonedDateTime
): boolean {
  return Temporal.ZonedDateTime.compare(a, b) > 0;
}

/**
 * Get the difference between two ZonedDateTimes as a Duration
 */
export function difference(
  a: Temporal.ZonedDateTime,
  b: Temporal.ZonedDateTime
): Temporal.Duration {
  return a.since(b);
}

/**
 * Convert a datetime-local string from one timezone to another
 * Useful for converting user input to UTC for storage
 */
export function convertTimezone(
  dateTimeString: string,
  fromTimezone: string,
  toTimezone: string
): string {
  const zonedDateTime = parseDateTimeLocal(dateTimeString, fromTimezone);
  return formatForDateTimeLocal(zonedDateTime, toTimezone);
}

/**
 * Get start of day in a timezone
 */
export function startOfDay(
  zonedDateTime: Temporal.ZonedDateTime,
  timezone: string
): Temporal.ZonedDateTime {
  const inTz = zonedDateTime.withTimeZone(timezone);
  const plainDate = inTz.toPlainDate();
  return plainDate.toZonedDateTime({
    timeZone: timezone,
    plainTime: Temporal.PlainTime.from({ hour: 0, minute: 0, second: 0 }),
  });
}

/**
 * Get end of day in a timezone
 */
export function endOfDay(
  zonedDateTime: Temporal.ZonedDateTime,
  timezone: string
): Temporal.ZonedDateTime {
  const inTz = zonedDateTime.withTimeZone(timezone);
  const plainDate = inTz.toPlainDate();
  return plainDate.toZonedDateTime({
    timeZone: timezone,
    plainTime: Temporal.PlainTime.from({ hour: 23, minute: 59, second: 59 }),
  });
}

// ============================================================================
// Database Integration Helpers
// ============================================================================

/**
 * Convert a Prisma Date object to Temporal ZonedDateTime
 * Prisma DateTime fields are stored in UTC, so we convert assuming UTC
 * @param date - Date object from Prisma (assumed to be in UTC)
 * @param timezone - Target timezone (defaults to UTC)
 * @returns ZonedDateTime in the specified timezone
 */
export function fromPrismaDate(
  date: Date | null | undefined,
  timezone = "UTC"
): Temporal.ZonedDateTime | null {
  if (!date) return null;
  return fromDate(date, timezone);
}

/**
 * Convert a Temporal ZonedDateTime to a Date for Prisma
 * This is an alias for toDate() for clarity in database operations
 * @param zonedDateTime - Temporal ZonedDateTime
 * @returns Date object suitable for Prisma DateTime fields
 */
export function toPrismaDate(
  zonedDateTime: Temporal.ZonedDateTime | null | undefined
): Date | null {
  if (!zonedDateTime) return null;
  return toDate(zonedDateTime);
}

/**
 * Convert an array of Prisma Date objects to Temporal ZonedDateTimes
 */
export function fromPrismaDateArray(
  dates: Array<Date | null | undefined>,
  timezone = "UTC"
): Array<Temporal.ZonedDateTime | null> {
  return dates.map((date) => fromPrismaDate(date, timezone));
}

/**
 * Convert an array of Temporal ZonedDateTimes to Date objects for Prisma
 */
export function toPrismaDateArray(
  zonedDateTimes: Array<Temporal.ZonedDateTime | null | undefined>
): Array<Date | null> {
  return zonedDateTimes.map((zdt) => toPrismaDate(zdt));
}

/**
 * Get current time as Unix timestamp in milliseconds (replacement for Date.now())
 * Use this instead of Date.now() for consistency
 */
export function nowMillis(): number {
  return Number(nowUTC().epochMilliseconds);
}

/**
 * Get current time as Unix timestamp in seconds
 */
export function nowSeconds(): number {
  return Number(nowUTC().epochMilliseconds) / 1000;
}
