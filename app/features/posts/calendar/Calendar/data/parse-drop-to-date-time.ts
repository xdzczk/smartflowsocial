/**
 * Parse a datetime-local string (e.g. from drop) in the user's timezone to a UTC Date.
 * Centralises the try/catch/fallback chain used by Week/Day and Month views.
 *
 * Callers pass:
 * - Week/Day: `${dateKey}T${time}` (e.g. "2025-02-21T14:30")
 * - Month: `${dateKey}T09:00`
 */

import { handleErrorSafely } from "~/lib/error-handler.client";
import {
  fromDate,
  fromISOString,
  parseDateTimeLocal,
  toDate,
} from "~/lib/temporal";

/**
 * Parses isoDateLocal (YYYY-MM-DDTHH:mm) in userTimezone and returns a UTC Date.
 * On parse failure runs the same fallbacks as before (UTC parse, Temporal, Date) and returns a best-effort Date.
 */
export function parseDropToDateTime(
  isoDateLocal: string,
  userTimezone: string
): Date {
  try {
    const zonedDateTime = parseDateTimeLocal(isoDateLocal, userTimezone);
    const utcZoned = zonedDateTime.withTimeZone("UTC");
    return toDate(utcZoned);
  } catch (error) {
    handleErrorSafely(error, {
      component: "parseDropToDateTime",
      action: "parse",
    });
    try {
      const zonedDateTime = parseDateTimeLocal(isoDateLocal, "UTC");
      return toDate(zonedDateTime);
    } catch {
      try {
        const zoned = fromISOString(isoDateLocal + "Z", "UTC");
        return toDate(zoned);
      } catch {
        try {
          const dateObj = new Date(isoDateLocal + "Z");
          const zoned = fromDate(dateObj, "UTC");
          return toDate(zoned);
        } catch {
          return new Date(isoDateLocal + "Z");
        }
      }
    }
  }
}
