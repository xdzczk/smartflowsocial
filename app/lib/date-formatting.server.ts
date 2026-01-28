/**
 * Server-side date formatting utility
 * Uses Temporal for consistent date/time handling
 *
 * This utility is for server-side code (actions, loaders, services) where
 * React hooks cannot be used. For client-side components, use the
 * `useFormattedDate()` hook instead.
 */

import {
  formatForDisplay,
  fromDate,
  fromISOString,
  fromUnixTimestamp,
  type Temporal,
} from "~/lib/temporal";

/**
 * Options for server-side date formatting
 */
interface FormatDateForServerOptions {
  /**
   * Whether the input is a Unix timestamp (in seconds)
   */
  isUnixTimestamp?: boolean;
  /**
   * Custom date format options
   */
  dateFormatOptions?: Intl.DateTimeFormatOptions;
}

/**
 * Convert date input to Temporal ZonedDateTime
 */
function convertToZonedDateTime(
  date: Date | string | number,
  isUnixTimestamp: boolean
): Temporal.ZonedDateTime | null {
  try {
    if (isUnixTimestamp) {
      const timestamp =
        typeof date === "number"
          ? date
          : typeof date === "string"
            ? parseInt(date, 10)
            : 0;
      if (isNaN(timestamp)) {
        return null;
      }
      return fromUnixTimestamp(timestamp, "UTC");
    }

    if (typeof date === "string") {
      try {
        return fromISOString(date, "UTC");
      } catch {
        return fromDate(new Date(date), "UTC");
      }
    }

    if (date instanceof Date) {
      return fromDate(date, "UTC");
    }

    if (typeof date === "number") {
      return fromUnixTimestamp(date, "UTC");
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Fallback date formatting using native Date
 */
function formatDateFallback(
  date: Date | string | number,
  timezone: string,
  timeFormat: "12h" | "24h",
  isUnixTimestamp: boolean,
  dateFormatOptions: Intl.DateTimeFormatOptions
): string {
  try {
    const dateObj =
      typeof date === "string"
        ? new Date(date)
        : typeof date === "number"
          ? new Date(isUnixTimestamp ? date * 1000 : date)
          : date;

    if (!(dateObj instanceof Date) || isNaN(dateObj.getTime())) {
      return "-";
    }

    return dateObj.toLocaleString("en-US", {
      timeZone: timezone,
      ...dateFormatOptions,
      hour12: timeFormat === "12h",
    });
  } catch {
    return "-";
  }
}

/**
 * Format a date for server-side use with explicit timezone and time format
 *
 * @param date - Date input (Date, string, or number)
 * @param timezone - Timezone to display in (e.g., "America/New_York")
 * @param timeFormat - Time format preference ("12h" for AM/PM, "24h" for 24-hour)
 * @param options - Additional formatting options
 * @returns Formatted date string
 */
export function formatDateForServer(
  date: Date | string | number | null | undefined,
  timezone: string,
  timeFormat: "12h" | "24h",
  options: FormatDateForServerOptions = {}
): string {
  if (!date) return "-";

  // Handle invalid Date objects
  if (date instanceof Date && isNaN(date.getTime())) {
    return "-";
  }

  const {
    isUnixTimestamp = false,
    dateFormatOptions = {
      month: "2-digit",
      day: "2-digit",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    },
  } = options;

  try {
    const zonedDateTime = convertToZonedDateTime(date, isUnixTimestamp);

    if (!zonedDateTime) {
      return formatDateFallback(
        date,
        timezone,
        timeFormat,
        isUnixTimestamp,
        dateFormatOptions
      );
    }

    // Convert to target timezone
    const userZoned = zonedDateTime.withTimeZone(timezone);

    // Format with user preferences using Temporal
    return formatForDisplay(userZoned, timezone, dateFormatOptions, timeFormat);
  } catch {
    // Final fallback - use native Date formatting (should rarely happen)
    return formatDateFallback(
      date,
      timezone,
      timeFormat,
      isUnixTimestamp,
      dateFormatOptions
    );
  }
}
