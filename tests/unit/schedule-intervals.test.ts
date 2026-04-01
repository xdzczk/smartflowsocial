/**
 * Unit tests for schedule interval helpers (whitelist and formatting)
 */

import { describe, expect, it } from "vitest";

import {
  ALLOWED_SCHEDULE_INTERVAL_HOURS,
  formatIntervalLabel,
  isAllowedScheduleInterval,
} from "~/lib/schedule-intervals";

describe("schedule-intervals", () => {
  describe("isAllowedScheduleInterval", () => {
    it("allows 0.25 and 0.5", () => {
      expect(isAllowedScheduleInterval(0.25)).toBe(true);
      expect(isAllowedScheduleInterval(0.5)).toBe(true);
    });

    it("allows positive whole hours", () => {
      expect(isAllowedScheduleInterval(1)).toBe(true);
      expect(isAllowedScheduleInterval(2)).toBe(true);
      expect(isAllowedScheduleInterval(24)).toBe(true);
    });

    it("rejects arbitrary decimals", () => {
      expect(isAllowedScheduleInterval(0.33)).toBe(false);
      expect(isAllowedScheduleInterval(1.5)).toBe(false);
      expect(isAllowedScheduleInterval(2.7)).toBe(false);
    });

    it("rejects zero and negative", () => {
      expect(isAllowedScheduleInterval(0)).toBe(false);
      expect(isAllowedScheduleInterval(-1)).toBe(false);
    });
  });

  describe("ALLOWED_SCHEDULE_INTERVAL_HOURS", () => {
    it("includes 0.25, 0.5, and whole hours", () => {
      expect(ALLOWED_SCHEDULE_INTERVAL_HOURS).toContain(0.25);
      expect(ALLOWED_SCHEDULE_INTERVAL_HOURS).toContain(0.5);
      expect(ALLOWED_SCHEDULE_INTERVAL_HOURS).toContain(1);
      expect(ALLOWED_SCHEDULE_INTERVAL_HOURS).toContain(24);
    });
  });

  describe("formatIntervalLabel", () => {
    it("formats sub-hour intervals as minutes (compact)", () => {
      expect(formatIntervalLabel(0.25, { compact: true })).toBe("+15m");
      expect(formatIntervalLabel(0.5, { compact: true })).toBe("+30m");
    });

    it("formats sub-hour intervals as shortened minutes (non-compact)", () => {
      expect(formatIntervalLabel(0.25, { compact: false })).toBe("15m");
      expect(formatIntervalLabel(0.5, { compact: false })).toBe("30m");
    });

    it("formats whole hours (compact)", () => {
      expect(formatIntervalLabel(1, { compact: true })).toBe("+1h");
      expect(formatIntervalLabel(2, { compact: true })).toBe("+2h");
    });

    it("formats whole hours (non-compact)", () => {
      expect(formatIntervalLabel(1, { compact: false })).toBe("1 hour");
      expect(formatIntervalLabel(2, { compact: false })).toBe("2 hours");
    });
  });
});
