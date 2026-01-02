/**
 * Unit tests for schedule formatting utilities
 * Tests app/lib/schedule-formatting.ts
 */

import { describe, it, expect } from "vitest";

import { formatScheduleTimeForInput } from "~/lib/schedule-formatting";

describe("Schedule Formatting Utilities", () => {
  describe("formatScheduleTimeForInput", () => {
    it("should format date for UTC timezone", () => {
      const date = new Date("2024-12-25T12:30:00Z");
      const result = formatScheduleTimeForInput(date, "UTC");

      expect(result).toBe("2024-12-25T12:30");
    });

    it("should format date for Etc/GMT timezone", () => {
      const date = new Date("2024-12-25T12:30:00Z");
      const result = formatScheduleTimeForInput(date, "Etc/GMT");

      expect(result).toBe("2024-12-25T12:30");
    });

    it("should format date for user timezone", () => {
      const date = new Date("2024-12-25T12:30:00Z");
      const result = formatScheduleTimeForInput(date, "America/New_York");

      // Should be in YYYY-MM-DDTHH:mm format
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
    });

    it("should handle single digit months and days", () => {
      const date = new Date("2024-01-05T09:05:00Z");
      const result = formatScheduleTimeForInput(date, "UTC");

      expect(result).toBe("2024-01-05T09:05");
    });

    it("should fallback to UTC on error", () => {
      const date = new Date("2024-12-25T12:30:00Z");
      // Invalid timezone should trigger fallback (caught in try-catch)
      const result = formatScheduleTimeForInput(date, "Invalid/Timezone");

      // Should still return valid format (fallback to UTC)
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
      expect(result).toBe("2024-12-25T12:30"); // UTC fallback
    });
  });
});
