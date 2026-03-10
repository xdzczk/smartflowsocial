/**
 * Unit tests for delay-after-main utilities
 * Tests app/features/posts/utils/delay-after-main.ts
 */

import { describe, it, expect } from "vitest";

import {
  delayAfterMainToSeconds,
  isValidDelayAfterMain,
  type DelayAfterMain,
} from "~/features/posts/utils/delay-after-main";

describe("Delay After Main", () => {
  describe("delayAfterMainToSeconds", () => {
    it("converts hours to seconds", () => {
      expect(delayAfterMainToSeconds({ value: 2, unit: "hours" })).toBe(7200);
    });
    it("converts minutes to seconds", () => {
      expect(delayAfterMainToSeconds({ value: 30, unit: "minutes" })).toBe(
        1800
      );
    });
  });

  describe("isValidDelayAfterMain", () => {
    it("returns true for value >= 1", () => {
      expect(isValidDelayAfterMain({ value: 1, unit: "minutes" })).toBe(true);
      expect(isValidDelayAfterMain({ value: 100, unit: "hours" })).toBe(true);
    });
    it("returns false for zero", () => {
      expect(isValidDelayAfterMain({ value: 0, unit: "minutes" })).toBe(false);
    });
    it("returns false for negative", () => {
      expect(isValidDelayAfterMain({ value: -1, unit: "minutes" })).toBe(false);
    });
    it("returns false when value is not a number", () => {
      const invalid: DelayAfterMain = { value: NaN, unit: "minutes" };
      expect(isValidDelayAfterMain(invalid)).toBe(false);
    });
  });
});
