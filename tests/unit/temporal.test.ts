/**
 * Unit tests for temporal date/display helpers
 */

import { describe, it, expect } from "vitest";

import {
  dateFormatToLocale,
  formatForDisplay,
  fromDate,
  fromPrismaDate,
  toPrismaDate,
  fromPrismaDateArray,
  toPrismaDateArray,
  startOfDay,
  endOfDay,
  getMinDatetimeLocalForSchedule,
  getMinScheduleTimestampMs,
  nowMillis,
  nowSeconds,
  parseDateTimeLocal,
  formatForDateTimeLocal,
  getNowForDateTimeLocal,
  addHours,
  addMinutes,
  addDays,
  nowUTC,
  createZonedDateTime,
  isBefore,
  isAfter,
  difference,
  convertTimezone,
} from "~/lib/temporal";

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

describe("fromPrismaDate / toPrismaDate", () => {
  it("fromPrismaDate returns null for null/undefined", () => {
    expect(fromPrismaDate(null)).toBeNull();
    expect(fromPrismaDate(undefined)).toBeNull();
  });
  it("fromPrismaDate converts Date to ZonedDateTime", () => {
    const d = new Date("2025-03-01T12:00:00Z");
    const z = fromPrismaDate(d, "UTC");
    expect(z).not.toBeNull();
    expect(z!.epochMilliseconds).toBe(d.getTime());
  });
  it("toPrismaDate returns null for null/undefined", () => {
    expect(toPrismaDate(null)).toBeNull();
    expect(toPrismaDate(undefined)).toBeNull();
  });
  it("toPrismaDate converts ZonedDateTime to Date", () => {
    const z = fromDate(new Date("2025-03-01T12:00:00Z"), "UTC");
    const d = toPrismaDate(z);
    expect(d).not.toBeNull();
    expect(d!.getTime()).toBe(z.epochMilliseconds);
  });
});

describe("fromPrismaDateArray / toPrismaDateArray", () => {
  it("fromPrismaDateArray maps dates", () => {
    const dates = [new Date("2025-03-01Z"), null, undefined];
    const arr = fromPrismaDateArray(dates, "UTC");
    expect(arr).toHaveLength(3);
    expect(arr[0]).not.toBeNull();
    expect(arr[1]).toBeNull();
    expect(arr[2]).toBeNull();
  });
  it("toPrismaDateArray maps ZonedDateTimes", () => {
    const z = fromDate(new Date("2025-03-01Z"), "UTC");
    const arr = toPrismaDateArray([z, null, undefined]);
    expect(arr).toHaveLength(3);
    expect(arr[0]).not.toBeNull();
    expect(arr[1]).toBeNull();
    expect(arr[2]).toBeNull();
  });
});

describe("startOfDay / endOfDay", () => {
  it("startOfDay returns midnight in timezone", () => {
    const z = createZonedDateTime(2025, 3, 10, 14, 30, "UTC");
    const start = startOfDay(z, "UTC");
    expect(start.hour).toBe(0);
    expect(start.minute).toBe(0);
    expect(start.second).toBe(0);
  });
  it("endOfDay returns 23:59:59 in timezone", () => {
    const z = createZonedDateTime(2025, 3, 10, 14, 30, "UTC");
    const end = endOfDay(z, "UTC");
    expect(end.hour).toBe(23);
    expect(end.minute).toBe(59);
    expect(end.second).toBe(59);
  });
});

describe("getMinDatetimeLocalForSchedule / getMinScheduleTimestampMs", () => {
  it("getMinDatetimeLocalForSchedule without notBefore returns now-like string", () => {
    const s = getMinDatetimeLocalForSchedule("UTC");
    expect(s).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
  });
  it("getMinScheduleTimestampMs returns number", () => {
    const ms = getMinScheduleTimestampMs("UTC");
    expect(typeof ms).toBe("number");
    expect(ms).toBeGreaterThan(0);
  });
});

describe("nowMillis / nowSeconds", () => {
  it("nowMillis returns number near Date.now()", () => {
    const ms = nowMillis();
    expect(typeof ms).toBe("number");
    expect(Math.abs(ms - Date.now())).toBeLessThan(2000);
  });
  it("nowSeconds returns number of seconds", () => {
    const s = nowSeconds();
    expect(typeof s).toBe("number");
    expect(s).toBeGreaterThan(0);
  });
});

describe("parseDateTimeLocal / formatForDateTimeLocal / getNowForDateTimeLocal", () => {
  it("parseDateTimeLocal parses YYYY-MM-DDTHH:mm", () => {
    const z = parseDateTimeLocal("2025-03-10T14:30", "UTC");
    expect(z.year).toBe(2025);
    expect(z.month).toBe(3);
    expect(z.day).toBe(10);
    expect(z.hour).toBe(14);
    expect(z.minute).toBe(30);
  });
  it("formatForDateTimeLocal formats to YYYY-MM-DDTHH:mm", () => {
    const z = createZonedDateTime(2025, 3, 10, 14, 30, "UTC");
    expect(formatForDateTimeLocal(z, "UTC")).toBe("2025-03-10T14:30");
  });
  it("getNowForDateTimeLocal returns datetime-local string in timezone", () => {
    const s = getNowForDateTimeLocal("UTC");
    expect(s).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
  });
});

describe("getMinDatetimeLocalForSchedule with notBeforeUtc", () => {
  it("returns notBefore when notBeforeUtc is after now in timezone", () => {
    const notBefore = new Date("2025-12-01T15:00:00Z");
    const s = getMinDatetimeLocalForSchedule("UTC", notBefore);
    expect(s).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
  });
});

describe("addHours / addMinutes / addDays", () => {
  it("addHours adds integer hours", () => {
    const z = createZonedDateTime(2025, 3, 10, 10, 0, "UTC");
    const next = addHours(z, 2);
    expect(next.hour).toBe(12);
  });
  it("addHours adds fractional hours as minutes", () => {
    const z = createZonedDateTime(2025, 3, 10, 10, 0, "UTC");
    const next = addHours(z, 1.5);
    expect(next.hour).toBe(11);
    expect(next.minute).toBe(30);
  });
  it("addMinutes adds minutes", () => {
    const z = createZonedDateTime(2025, 3, 10, 10, 0, "UTC");
    const next = addMinutes(z, 45);
    expect(next.minute).toBe(45);
  });
  it("addDays adds days", () => {
    const z = createZonedDateTime(2025, 3, 10, 10, 0, "UTC");
    const next = addDays(z, 1);
    expect(next.day).toBe(11);
  });
});

describe("nowUTC", () => {
  it("returns ZonedDateTime in UTC", () => {
    const z = nowUTC();
    expect(z.timeZoneId).toBe("UTC");
  });
});

describe("isBefore / isAfter / difference", () => {
  it("isBefore returns true when a is before b", () => {
    const a = createZonedDateTime(2025, 3, 10, 10, 0, "UTC");
    const b = createZonedDateTime(2025, 3, 10, 11, 0, "UTC");
    expect(isBefore(a, b)).toBe(true);
    expect(isBefore(b, a)).toBe(false);
  });

  it("isAfter returns true when a is after b", () => {
    const a = createZonedDateTime(2025, 3, 10, 11, 0, "UTC");
    const b = createZonedDateTime(2025, 3, 10, 10, 0, "UTC");
    expect(isAfter(a, b)).toBe(true);
    expect(isAfter(b, a)).toBe(false);
  });

  it("difference returns duration between two ZonedDateTimes", () => {
    const a = createZonedDateTime(2025, 3, 10, 12, 0, "UTC");
    const b = createZonedDateTime(2025, 3, 10, 10, 0, "UTC");
    const d = difference(a, b);
    expect(d.hours).toBe(2);
  });
});

describe("convertTimezone", () => {
  it("converts datetime-local string from one timezone to another", () => {
    const result = convertTimezone(
      "2025-06-01T14:00",
      "America/New_York",
      "UTC"
    );
    expect(result).toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/);
  });
});
