import { describe, expect, it } from "vitest";

import { applyRandomScheduleWindow } from "~/lib/schedule-random";

describe("applyRandomScheduleWindow", () => {
  it("returns nominal when windowMinutes is 0", () => {
    const nominal = 1_700_000_000; // fixed timestamp
    expect(applyRandomScheduleWindow(nominal, 0)).toBe(nominal);
  });

  it("returns nominal when windowMinutes is negative", () => {
    const nominal = 1_700_000_000;
    expect(applyRandomScheduleWindow(nominal, -5)).toBe(nominal);
  });

  it("returns nominal when nominal is not finite", () => {
    expect(applyRandomScheduleWindow(Number.NaN, 5)).toBeNaN();
    expect(applyRandomScheduleWindow(Number.POSITIVE_INFINITY, 5)).toBe(
      Number.POSITIVE_INFINITY
    );
  });

  it("returns value within ±windowMinutes of nominal (seconds)", () => {
    const nominal = 1_700_000_000; // 2023-11-15 02:13:20 UTC
    const windowMinutes = 5;
    const windowSeconds = windowMinutes * 60;

    for (let i = 0; i < 50; i++) {
      const result = applyRandomScheduleWindow(nominal, windowMinutes);
      expect(Number.isInteger(result)).toBe(true);
      expect(result).toBeGreaterThanOrEqual(nominal - windowSeconds);
      expect(result).toBeLessThanOrEqual(nominal + windowSeconds);
    }
  });

  it("returns integer seconds", () => {
    const nominal = 1_700_000_000;
    for (let i = 0; i < 20; i++) {
      const result = applyRandomScheduleWindow(nominal, 10);
      expect(Number.isInteger(result)).toBe(true);
    }
  });
});
