/**
 * Unit tests for date range filter utilities
 * Tests app/features/posts/utils/date-range-filter.ts
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const fixedNow = { year: 2025, month: 3, day: 10 };

vi.mock("~/lib/temporal", () => ({
  nowInTimezone: vi.fn(() => fixedNow),
  addDays: vi.fn((_zoned: unknown, days: number) => {
    const d = new Date(2025, 2, 10);
    d.setDate(d.getDate() + days);
    return {
      year: d.getFullYear(),
      month: d.getMonth() + 1,
      day: d.getDate(),
    };
  }),
}));

import {
  getTodayInTimezone,
  getNext7DaysRange,
  getNext30DaysRange,
  getPast7DaysRange,
  getPast30DaysRange,
  formatDateOnlyForDisplay,
  isDateInRange,
} from "~/features/posts/utils/date-range-filter";

describe("Date Range Filter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("getTodayInTimezone returns YYYY-MM-DD", () => {
    expect(getTodayInTimezone("UTC")).toBe("2025-03-10");
  });

  it("getNext7DaysRange returns from today to today+6", () => {
    const range = getNext7DaysRange("UTC");
    expect(range.from).toBe("2025-03-10");
    expect(range.to).toBe("2025-03-16");
  });

  it("getNext30DaysRange returns from today to today+29", () => {
    const range = getNext30DaysRange("America/New_York");
    expect(range.from).toBe("2025-03-10");
    expect(range.to).toBe("2025-04-08");
  });

  it("getPast7DaysRange returns today-6 to today", () => {
    const range = getPast7DaysRange("UTC");
    expect(range.from).toBe("2025-03-04");
    expect(range.to).toBe("2025-03-10");
  });

  it("getPast30DaysRange returns today-29 to today", () => {
    const range = getPast30DaysRange("Europe/London");
    expect(range.from).toBe("2025-02-09");
    expect(range.to).toBe("2025-03-10");
  });

  it("trims timezone and uses UTC when empty", () => {
    expect(getTodayInTimezone("  ")).toBe("2025-03-10");
  });

  describe("formatDateOnlyForDisplay", () => {
    it("formats ddmmyyyy as d/m/y", () => {
      expect(formatDateOnlyForDisplay("2025-03-10", "ddmmyyyy")).toBe(
        "10/03/2025"
      );
    });
    it("formats mmddyyyy as m/d/y", () => {
      expect(formatDateOnlyForDisplay("2025-03-10", "mmddyyyy")).toBe(
        "03/10/2025"
      );
    });
    it("formats yyyymmdd as y-m-d", () => {
      expect(formatDateOnlyForDisplay("2025-03-10", "yyyymmdd")).toBe(
        "2025-03-10"
      );
    });
    it("returns isoDate when not YYYY-MM-DD", () => {
      expect(formatDateOnlyForDisplay("invalid", "ddmmyyyy")).toBe("invalid");
    });
  });

  describe("isDateInRange", () => {
    it("returns true when date is within from and to", () => {
      expect(isDateInRange("2025-03-05", "2025-03-01", "2025-03-31")).toBe(
        true
      );
      expect(
        isDateInRange(new Date("2025-03-05"), "2025-03-01", "2025-03-31")
      ).toBe(true);
    });
    it("returns false when date is before from", () => {
      expect(isDateInRange("2025-02-28", "2025-03-01", "2025-03-31")).toBe(
        false
      );
    });
    it("returns false when date is after to", () => {
      expect(isDateInRange("2025-04-01", "2025-03-01", "2025-03-31")).toBe(
        false
      );
    });
    it("returns true when from is empty (no lower bound)", () => {
      expect(isDateInRange("2025-01-01", "", "2025-12-31")).toBe(true);
    });
    it("returns true when to is empty (no upper bound)", () => {
      expect(isDateInRange("2025-12-01", "2025-01-01", "")).toBe(true);
    });
    it("returns false for null/undefined date", () => {
      expect(isDateInRange(null, "2025-03-01", "2025-03-31")).toBe(false);
      expect(isDateInRange(undefined, "2025-03-01", "2025-03-31")).toBe(false);
    });
  });
});
