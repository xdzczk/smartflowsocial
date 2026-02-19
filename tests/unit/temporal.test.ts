/**
 * Unit tests for temporal date/display helpers
 */

import { describe, it, expect } from "vitest";

import { dateFormatToLocale, formatForDisplay, fromDate } from "~/lib/temporal";

describe("dateFormatToLocale", () => {
  it("maps ddmmyyyy to en-GB", () => {
    expect(dateFormatToLocale("ddmmyyyy")).toBe("en-GB");
  });

  it("maps mmddyyyy to en-US", () => {
    expect(dateFormatToLocale("mmddyyyy")).toBe("en-US");
  });

  it("maps yyyymmdd to sv", () => {
    expect(dateFormatToLocale("yyyymmdd")).toBe("sv");
  });
});

describe("formatForDisplay with dateLocale", () => {
  it("uses dateLocale for date part", () => {
    const zoned = fromDate(new Date("2025-02-19T14:30:00Z"), "UTC");
    const enGB = formatForDisplay(
      zoned,
      "UTC",
      { month: "2-digit", day: "2-digit", year: "numeric" },
      undefined,
      "en-GB"
    );
    const enUS = formatForDisplay(
      zoned,
      "UTC",
      { month: "2-digit", day: "2-digit", year: "numeric" },
      undefined,
      "en-US"
    );
    expect(enGB).toMatch(/19\/02\/2025/);
    expect(enUS).toMatch(/02\/19\/2025/);
  });
});
