import { describe, it, expect } from "vitest";

import {
  defaultRangeForAdminPath,
  getBoundsForPreset,
  getPreviousPeriodBounds,
  parseRangePreset,
} from "~/features/admin/metrics/date-range";

describe("admin date-range", () => {
  it("parses preset or falls back", () => {
    expect(parseRangePreset("30d", "7d")).toBe("30d");
    expect(parseRangePreset("bogus", "7d")).toBe("7d");
  });

  it("defaults by path", () => {
    expect(defaultRangeForAdminPath("/dashboard/admin")).toBe("7d");
    expect(defaultRangeForAdminPath("/dashboard/admin/analytics")).toBe("30d");
    expect(defaultRangeForAdminPath("/dashboard/admin/operations")).toBe("24h");
  });

  it("computes previous period", () => {
    const now = new Date("2026-03-20T12:00:00.000Z");
    const cur = getBoundsForPreset("7d", now);
    const prev = getPreviousPeriodBounds(cur, now);
    expect(prev).not.toBeNull();
    expect(prev!.to.getTime()).toBe(cur.from.getTime());
  });
});
