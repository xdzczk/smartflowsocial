/**
 * Pure utility functions for schedule time formatting
 * This file has no server-side dependencies and can be safely imported in tests
 */

/**
 * Formats a Date object for use in HTML datetime-local input
 * @param date - The date to format
 * @param userTimezone - The user's timezone (defaults to UTC)
 * @returns Formatted date string in YYYY-MM-DDTHH:mm format
 */
export function formatScheduleTimeForInput(
  date: Date,
  userTimezone = "UTC",
): string {
  try {
    // For UTC/GMT timezones, use the date directly
    if (userTimezone === "UTC" || userTimezone === "Etc/GMT") {
      const year = date.getUTCFullYear();
      const month = String(date.getUTCMonth() + 1).padStart(2, "0");
      const day = String(date.getUTCDate()).padStart(2, "0");
      const hours = String(date.getUTCHours()).padStart(2, "0");
      const minutes = String(date.getUTCMinutes()).padStart(2, "0");

      const result = `${year}-${month}-${day}T${hours}:${minutes}`;
      return result;
    }

    // Convert UTC date to user's timezone for display in datetime-local input
    // Use a more reliable approach: get individual date components in user timezone
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: userTimezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });

    const parts = formatter.formatToParts(date);
    const partsObj = parts.reduce((acc, part) => {
      acc[part.type] = part.value;
      return acc;
    }, {} as Record<string, string>);

    // Format for datetime-local input: YYYY-MM-DDTHH:MM
    const result = `${partsObj.year}-${partsObj.month}-${partsObj.day}T${partsObj.hour}:${partsObj.minute}`;

    return result;
  } catch (error) {
    console.error("Error in formatScheduleTimeForInput:", error, {
      date,
      userTimezone,
    });
    // Fallback to UTC formatting
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, "0");
    const day = String(date.getUTCDate()).padStart(2, "0");
    const hours = String(date.getUTCHours()).padStart(2, "0");
    const minutes = String(date.getUTCMinutes()).padStart(2, "0");

    return `${year}-${month}-${day}T${hours}:${minutes}`;
  }
}

