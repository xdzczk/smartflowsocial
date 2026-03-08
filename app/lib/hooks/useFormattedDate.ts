/**
 * Custom hook for formatting dates with user preferences
 * Automatically uses user's timezone and time format preferences
 */

import { useMemo } from "react";

import { useOptionalUser } from "~/lib/remix-utils";
import {
  dateFormatToLocale,
  formatForDisplay,
  fromDate,
  fromISOString,
  fromUnixTimestamp,
  type DateDisplayLocale,
  type Temporal,
} from "~/lib/temporal";

/**
 * Options for date formatting
 */
interface FormatDateOptions {
  /**
   * Whether the input is a Unix timestamp (in seconds)
   */
  isUnixTimestamp?: boolean;
  /**
   * Override user's timezone (optional)
   */
  timezone?: string;
  /**
   * Override user's time format (optional)
   */
  timeFormat?: "12h" | "24h";
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
  dateFormatOptions: Intl.DateTimeFormatOptions,
  dateLocale: DateDisplayLocale = "en-GB"
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

    let result = dateObj.toLocaleString(dateLocale, {
      timeZone: timezone,
      ...dateFormatOptions,
      hour12: timeFormat === "12h",
    });
    if (timeFormat === "12h") {
      result = result
        .replace(/\bfm\b/gi, (m) => (m === "FM" ? "AM" : "am"))
        .replace(/\bem\b/gi, (m) => (m === "EM" ? "PM" : "pm"));
    }
    return result;
  } catch {
    return "-";
  }
}

/**
 * Hook that returns a date formatting function with user preferences applied
 * @returns A function to format dates according to user preferences
 */
export function useFormattedDate() {
  const user = useOptionalUser();

  const userTimezone =
    user && typeof user === "object" && "timezone" in user
      ? (user.timezone ?? "UTC")
      : "UTC";

  const userTimeFormat: "12h" | "24h" =
    user && typeof user === "object" && "timeFormat" in user
      ? user.timeFormat === "24h"
        ? "24h"
        : "12h"
      : "12h";

  const userDateFormat: "ddmmyyyy" | "mmddyyyy" | "yyyymmdd" =
    user && typeof user === "object" && "dateFormat" in user
      ? user.dateFormat === "mmddyyyy" || user.dateFormat === "yyyymmdd"
        ? user.dateFormat
        : "ddmmyyyy"
      : "ddmmyyyy";

  const dateLocale = dateFormatToLocale(userDateFormat);

  /**
   * Format a date with user preferences
   */
  const formatDate = useMemo(
    () =>
      (
        date: Date | string | number | undefined | null,
        options: FormatDateOptions = {}
      ): string => {
        if (!date) return "-";

        // Handle invalid Date objects
        if (date instanceof Date && isNaN(date.getTime())) {
          return "-";
        }

        const {
          isUnixTimestamp = false,
          timezone = userTimezone,
          timeFormat = userTimeFormat,
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
              dateFormatOptions,
              dateLocale
            );
          }

          // Convert to user's timezone
          const userZoned = zonedDateTime.withTimeZone(timezone);

          // Format with user preferences
          return formatForDisplay(
            userZoned,
            timezone,
            dateFormatOptions,
            timeFormat,
            dateLocale
          );
        } catch {
          // Final fallback - use native Date formatting
          return formatDateFallback(
            date,
            timezone,
            timeFormat,
            isUnixTimestamp,
            dateFormatOptions,
            dateLocale
          );
        }
      },
    [userTimezone, userTimeFormat, dateLocale]
  );

  return {
    formatDate,
    userTimezone,
    userTimeFormat,
    userDateFormat,
    dateLocale,
  };
}
