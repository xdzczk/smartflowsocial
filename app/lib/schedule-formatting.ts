/**
 * Pure utility functions for schedule time formatting using Temporal API
 * This file has no server-side dependencies and can be safely imported in tests
 */

import { formatForDateTimeLocal, fromDate } from "./temporal";

/**
 * Formats a Date object for use in HTML datetime-local input
 * @param date - The date to format (assumed to be in UTC)
 * @param userTimezone - The user's timezone (defaults to UTC)
 * @returns Formatted date string in YYYY-MM-DDTHH:mm format
 */
export function formatScheduleTimeForInput(
  date: Date,
  userTimezone = "UTC"
): string {
  try {
    // Convert Date to Temporal ZonedDateTime (assuming Date is in UTC)
    const zonedDateTime = fromDate(date, "UTC");

    // Format for datetime-local input in user's timezone
    return formatForDateTimeLocal(zonedDateTime, userTimezone);
  } catch (_error) {
    // Intentionally do not log here:
    // this module is a pure utility and may run in both server and client contexts.
    // Fallback formatting below preserves behavior without introducing side effects.
    // Fallback: try to format using UTC components directly
    // This maintains backward compatibility if Temporal fails
    try {
      const year = date.getUTCFullYear();
      const month = String(date.getUTCMonth() + 1).padStart(2, "0");
      const day = String(date.getUTCDate()).padStart(2, "0");
      const hours = String(date.getUTCHours()).padStart(2, "0");
      const minutes = String(date.getUTCMinutes()).padStart(2, "0");
      return `${year}-${month}-${day}T${hours}:${minutes}`;
    } catch {
      // If even fallback fails, return empty string
      return "";
    }
  }
}
