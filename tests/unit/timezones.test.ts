/**
 * Unit tests for timezone utilities
 * Tests app/lib/timezones.ts
 */

import { describe, it, expect } from "vitest";

import {
  getAllTimezoneOptions,
  searchTimezones,
  getTimezoneOption,
  formatTimezoneDisplay,
  type TimezoneOption,
} from "~/lib/timezones";

describe("Timezones", () => {
  describe("getAllTimezoneOptions", () => {
    it("returns non-empty array of TimezoneOption", () => {
      const options = getAllTimezoneOptions();
      expect(Array.isArray(options)).toBe(true);
      expect(options.length).toBeGreaterThan(0);
    });

    it("each option has required fields", () => {
      const options = getAllTimezoneOptions();
      for (const opt of options.slice(0, 20)) {
        expect(opt).toHaveProperty("value");
        expect(opt).toHaveProperty("label");
        expect(opt).toHaveProperty("city");
        expect(opt).toHaveProperty("region");
        expect(opt).toHaveProperty("offset");
        expect(opt).toHaveProperty("offsetMinutes");
        expect(typeof opt.value).toBe("string");
        expect(typeof opt.offsetMinutes).toBe("number");
      }
    });

    it("returns cached result on second call", () => {
      const first = getAllTimezoneOptions();
      const second = getAllTimezoneOptions();
      expect(first).toBe(second);
    });

    it("includes common timezone patterns", () => {
      const options = getAllTimezoneOptions();
      const values = options.map((o) => o.value);
      expect(values.some((v) => v.includes("America/"))).toBe(true);
      expect(values.some((v) => v.includes("Europe/"))).toBe(true);
    });
  });

  describe("searchTimezones", () => {
    it("returns all options when query is empty", () => {
      const options = getAllTimezoneOptions();
      const result = searchTimezones("", options);
      expect(result).toEqual(options);
    });

    it("returns all options when query is whitespace", () => {
      const options = getAllTimezoneOptions();
      const result = searchTimezones("   ", options);
      expect(result).toEqual(options);
    });

    it("filters by city name", () => {
      const options = getAllTimezoneOptions();
      const result = searchTimezones("London", options);
      expect(result.length).toBeGreaterThan(0);
      expect(result.every((o) => o.city.toLowerCase().includes("london"))).toBe(
        true
      );
    });

    it("filters by value", () => {
      const options = getAllTimezoneOptions();
      const searchTerm = options[0]!.value;
      const result = searchTimezones(searchTerm, options);
      expect(result.some((o) => o.value === searchTerm)).toBe(true);
    });

    it("returns empty when no match", () => {
      const options = getAllTimezoneOptions();
      const result = searchTimezones("xyznonexistent123", options);
      expect(result).toEqual([]);
    });
  });

  describe("getTimezoneOption", () => {
    it("returns option when value exists", () => {
      const options = getAllTimezoneOptions();
      const firstValue = options[0]!.value;
      const opt = getTimezoneOption(firstValue, options);
      expect(opt).toBeDefined();
      expect(opt?.value).toBe(firstValue);
    });

    it("returns undefined when value does not exist", () => {
      const options = getAllTimezoneOptions();
      const opt = getTimezoneOption("Invalid/Timezone", options);
      expect(opt).toBeUndefined();
    });

    it("uses getAllTimezoneOptions when options not passed", () => {
      const options = getAllTimezoneOptions();
      const firstValue = options[0]!.value;
      const opt = getTimezoneOption(firstValue);
      expect(opt).toBeDefined();
      expect(opt?.value).toBe(firstValue);
    });
  });

  describe("formatTimezoneDisplay", () => {
    it("formats as label and offset", () => {
      const option: TimezoneOption = {
        value: "America/New_York",
        label: "New York",
        city: "New York",
        region: "America",
        offset: "GMT-5",
        offsetMinutes: -300,
      };
      expect(formatTimezoneDisplay(option)).toBe("New York (GMT-5)");
    });
  });
});
