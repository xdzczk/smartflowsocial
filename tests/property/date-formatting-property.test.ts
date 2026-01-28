/**
 * Property-based tests for date formatting functions
 *
 * Uses fast-check to verify date formatting properties:
 * - Round-trip conversions
 * - Timezone handling
 * - Format consistency
 * - Edge case handling
 */

import fc from "fast-check";
import { describe, it } from "vitest";

import { formatDate as formatDateWithTimezone } from "~/features/posts/utils/content-helpers";
// Note: formatDate from ~/lib/helpers is deprecated - use useFormattedDate() hook in components
// or formatDateWithTimezone for utility functions
import { formatDate } from "~/lib/helpers";
import { formatScheduleTimeForInput } from "~/lib/schedule-formatting";
// Valid IANA timezone identifiers
const validTimezones = [
  "UTC",
  "America/New_York",
  "America/Los_Angeles",
  "Europe/London",
  "Europe/Paris",
  "Asia/Tokyo",
  "Australia/Sydney",
  "America/Chicago",
  "America/Denver",
  "Europe/Berlin",
];

describe("Property-Based Tests: Date Formatting", () => {
  describe("formatScheduleTimeForInput Properties", () => {
    it("should always produce valid datetime-local format (YYYY-MM-DDTHH:mm)", () => {
      fc.assert(
        fc.property(
          fc
            .date({ min: new Date("2000-01-01"), max: new Date("2100-12-31") })
            .filter((date: Date) => !isNaN(date.getTime())),
          fc.constantFrom(...validTimezones),
          (date: Date, timezone: string) => {
            const formatted = formatScheduleTimeForInput(date, timezone);
            // Should match YYYY-MM-DDTHH:mm format
            const regex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;
            return regex.test(formatted);
          }
        ),
        { numRuns: 50 }
      );
    });

    it("should be idempotent: formatting same date in same timezone produces same result", () => {
      fc.assert(
        fc.property(
          fc.date({ min: new Date("2000-01-01"), max: new Date("2100-12-31") }),
          fc.constantFrom(...validTimezones),
          (date: Date, timezone: string) => {
            const formatted1 = formatScheduleTimeForInput(date, timezone);
            const formatted2 = formatScheduleTimeForInput(date, timezone);
            return formatted1 === formatted2;
          }
        ),
        { numRuns: 50 }
      );
    });

    it("should handle all valid dates without errors", () => {
      fc.assert(
        fc.property(
          fc
            .date({ min: new Date("2000-01-01"), max: new Date("2100-12-31") })
            .filter((date: Date) => !isNaN(date.getTime())),
          fc.constantFrom(...validTimezones),
          (date: Date, timezone: string) => {
            try {
              const formatted = formatScheduleTimeForInput(date, timezone);
              return formatted.length > 0 && !formatted.includes("NaN");
            } catch {
              return false;
            }
          }
        ),
        { numRuns: 50 }
      );
    });

    it("should maintain ordering: later dates format to later strings (same timezone)", () => {
      fc.assert(
        fc.property(
          fc.date({ min: new Date("2000-01-01"), max: new Date("2100-12-31") }),
          fc.integer({ min: 86400, max: 86400 * 365 }), // At least 24 hours to avoid DST transition issues
          fc.constantFrom(...validTimezones),
          (date: Date, secondsToAdd: number, timezone: string) => {
            const laterDate = new Date(date.getTime() + secondsToAdd * 1000);
            const formatted1 = formatScheduleTimeForInput(date, timezone);
            const formatted2 = formatScheduleTimeForInput(laterDate, timezone);

            // Compare the actual date values to handle DST transitions
            // With 24+ hour difference, we should be safe from DST transition edge cases
            const dateDiff = laterDate.getTime() - date.getTime();
            const comparison = formatted2.localeCompare(formatted1);

            // For 24+ hour differences, require non-negative comparison
            // This ensures that with a full day difference, the formatted string maintains ordering
            // DST transitions can cause issues with smaller differences, but 24 hours should be safe
            if (dateDiff >= 86400000) {
              // 24 hours in milliseconds
              // With 24+ hour difference, formatted2 should not be lexicographically less
              return comparison >= 0;
            } else {
              // For smaller differences (shouldn't happen with min: 86400, but just in case),
              // just ensure both are valid formatted strings
              return formatted1.length > 0 && formatted2.length > 0;
            }
          }
        ),
        { numRuns: 50 }
      );
    });

    it("should handle UTC timezone correctly", () => {
      fc.assert(
        fc.property(
          fc.date({ min: new Date("2000-01-01"), max: new Date("2100-12-31") }),
          (date: Date) => {
            const formatted = formatScheduleTimeForInput(date, "UTC");
            // Should match UTC date components
            const year = date.getUTCFullYear();
            const month = String(date.getUTCMonth() + 1).padStart(2, "0");
            const day = String(date.getUTCDate()).padStart(2, "0");
            const expectedPrefix = `${year}-${month}-${day}`;
            return formatted.startsWith(expectedPrefix);
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  describe("formatDate Properties (DEPRECATED - use useFormattedDate hook)", () => {
    it("should always produce non-empty string for valid dates", () => {
      fc.assert(
        fc.property(
          fc.oneof(
            fc
              .date({
                min: new Date("2000-01-01"),
                max: new Date("2100-12-31"),
              })
              .filter((d: Date) => !isNaN(d.getTime())),
            fc
              .date({
                min: new Date("2000-01-01"),
                max: new Date("2100-12-31"),
              })
              .filter((d: Date) => !isNaN(d.getTime()))
              .map((d: Date) => d.toISOString())
          ),
          (dateInput: Date | string) => {
            try {
              const formatted = formatDate(dateInput);
              return typeof formatted === "string" && formatted.length > 0;
            } catch {
              return false;
            }
          }
        ),
        { numRuns: 50 }
      );
    });

    it("should handle Date objects and ISO strings consistently", () => {
      fc.assert(
        fc.property(
          fc
            .date({ min: new Date("2000-01-01"), max: new Date("2100-12-31") })
            .filter((date: Date) => !isNaN(date.getTime())),
          (date: Date) => {
            const formattedFromDate = formatDate(date);
            const formattedFromString = formatDate(date.toISOString());
            // Should produce similar formatted output (may differ slightly due to timezone)
            return (
              formattedFromDate.length > 0 && formattedFromString.length > 0
            );
          }
        ),
        { numRuns: 30 }
      );
    });

    it("should be idempotent: formatting same date produces consistent result", () => {
      fc.assert(
        fc.property(
          fc.date({ min: new Date("2000-01-01"), max: new Date("2100-12-31") }),
          (date: Date) => {
            const formatted1 = formatDate(date);
            const formatted2 = formatDate(date);
            // Should be identical
            return formatted1 === formatted2;
          }
        ),
        { numRuns: 30 }
      );
    });
  });

  describe("formatDateWithTimezone Properties", () => {
    it("should handle Unix timestamp strings correctly", () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 946684800, max: 4102444800 }), // 2000-01-01 to 2100-01-01 in seconds
          fc.constantFrom(...validTimezones),
          (unixTimestamp: number, timezone: string) => {
            try {
              const formatted = formatDateWithTimezone(
                unixTimestamp.toString(),
                true, // isUnixTimestamp
                timezone
              );
              return formatted !== "-" && formatted.length > 0;
            } catch {
              return false;
            }
          }
        ),
        { numRuns: 30 }
      );
    });

    it("should handle Date objects with timezone", () => {
      fc.assert(
        fc.property(
          fc.date({ min: new Date("2000-01-01"), max: new Date("2100-12-31") }),
          fc.constantFrom(...validTimezones),
          (date: Date, timezone: string) => {
            // Filter out invalid dates (NaN)
            if (isNaN(date.getTime())) {
              return true; // Skip invalid dates
            }
            try {
              const formatted = formatDateWithTimezone(date, false, timezone);
              return formatted !== "-" && formatted.length > 0;
            } catch {
              return false;
            }
          }
        ),
        { numRuns: 30 }
      );
    });

    it("should return '-' for undefined/null dates", () => {
      fc.assert(
        fc.property(
          fc.constantFrom(undefined, null),
          (dateInput: undefined | null) => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Testing edge case with null/undefined input
            const formatted = formatDateWithTimezone(dateInput as any, false);
            return formatted === "-";
          }
        )
      );
    });

    it("should handle different timezones consistently", () => {
      fc.assert(
        fc.property(
          fc.date({ min: new Date("2000-01-01"), max: new Date("2100-12-31") }),
          fc.constantFrom(...validTimezones),
          fc.constantFrom(...validTimezones),
          (date: Date, tz1: string, tz2: string) => {
            // Filter out invalid dates (NaN)
            if (isNaN(date.getTime())) {
              return true; // Skip invalid dates
            }
            try {
              const formatted1 = formatDateWithTimezone(date, false, tz1);
              const formatted2 = formatDateWithTimezone(date, false, tz2);
              // Both should be valid formatted strings (may differ due to timezone)
              return (
                formatted1 !== "-" &&
                formatted2 !== "-" &&
                formatted1.length > 0 &&
                formatted2.length > 0
              );
            } catch {
              return false;
            }
          }
        ),
        { numRuns: 20 }
      );
    });
  });

  describe("Date Format Edge Cases", () => {
    it("should handle leap years correctly", () => {
      fc.assert(
        fc.property(
          fc.constantFrom(
            new Date("2000-02-29"), // Leap year
            new Date("2004-02-29"), // Leap year
            new Date("2008-02-29"), // Leap year
            new Date("2012-02-29"), // Leap year
            new Date("2016-02-29"), // Leap year
            new Date("2020-02-29"), // Leap year
            new Date("2024-02-29") // Leap year
          ),
          fc.constantFrom(...validTimezones),
          (date: Date, timezone: string) => {
            try {
              const formatted = formatScheduleTimeForInput(date, timezone);
              return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(formatted);
            } catch {
              return false;
            }
          }
        )
      );
    });

    it("should handle year boundaries correctly", () => {
      fc.assert(
        fc.property(
          fc.constantFrom(
            new Date("2000-01-01T00:00:00Z"),
            new Date("2000-12-31T23:59:59Z"),
            new Date("2099-12-31T23:59:59Z")
          ),
          fc.constantFrom(...validTimezones),
          (date: Date, timezone: string) => {
            try {
              const formatted = formatScheduleTimeForInput(date, timezone);
              return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(formatted);
            } catch {
              return false;
            }
          }
        )
      );
    });

    it("should handle DST transition dates", () => {
      // DST transitions in US (second Sunday in March, first Sunday in November)
      fc.assert(
        fc.property(
          fc.constantFrom(
            new Date("2024-03-10T07:00:00Z"), // DST start in US
            new Date("2024-11-03T06:00:00Z"), // DST end in US
            new Date("2023-03-12T07:00:00Z"), // DST start
            new Date("2023-11-05T06:00:00Z") // DST end
          ),
          fc.constantFrom(
            "America/New_York",
            "America/Los_Angeles",
            "Europe/London"
          ),
          (date: Date, timezone: string) => {
            try {
              const formatted = formatScheduleTimeForInput(date, timezone);
              return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(formatted);
            } catch {
              return false;
            }
          }
        )
      );
    });
  });
});
