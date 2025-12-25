/**
 * Unit tests for date utility functions
 * 
 * Tests the date utilities in app/lib/date.ts
 */

import { describe, it, expect } from "vitest";
import { timeZonesList } from "~/lib/date";

describe("Date Utilities", () => {
  describe("timeZonesList", () => {
    it("should be an array", () => {
      expect(Array.isArray(timeZonesList)).toBe(true);
    });

    it("should contain timezone strings", () => {
      expect(timeZonesList.length).toBeGreaterThan(0);
      expect(typeof timeZonesList[0]).toBe("string");
    });

    it("should contain common timezones", () => {
      expect(timeZonesList).toContain("Etc/GMT"); // UTC equivalent
      expect(timeZonesList).toContain("America/New_York");
      expect(timeZonesList).toContain("America/Los_Angeles");
      expect(timeZonesList).toContain("Europe/London");
      expect(timeZonesList).toContain("Asia/Tokyo");
    });

    it("should contain Africa timezones", () => {
      const africaTimezones = timeZonesList.filter((tz) =>
        tz.startsWith("Africa/"),
      );
      expect(africaTimezones.length).toBeGreaterThan(0);
    });

    it("should contain America timezones", () => {
      const americaTimezones = timeZonesList.filter((tz) =>
        tz.startsWith("America/"),
      );
      expect(americaTimezones.length).toBeGreaterThan(0);
    });

    it("should contain Asia timezones", () => {
      const asiaTimezones = timeZonesList.filter((tz) => tz.startsWith("Asia/"));
      expect(asiaTimezones.length).toBeGreaterThan(0);
    });

    it("should contain Europe timezones", () => {
      const europeTimezones = timeZonesList.filter((tz) =>
        tz.startsWith("Europe/"),
      );
      expect(europeTimezones.length).toBeGreaterThan(0);
    });

    it("should contain Pacific timezones", () => {
      const pacificTimezones = timeZonesList.filter((tz) =>
        tz.startsWith("Pacific/"),
      );
      expect(pacificTimezones.length).toBeGreaterThan(0);
    });

    it("should contain Australia timezones", () => {
      const australiaTimezones = timeZonesList.filter((tz) =>
        tz.startsWith("Australia/"),
      );
      expect(australiaTimezones.length).toBeGreaterThan(0);
    });

    it("should contain Etc/GMT timezones", () => {
      const etcTimezones = timeZonesList.filter((tz) => tz.startsWith("Etc/"));
      expect(etcTimezones.length).toBeGreaterThan(0);
    });

    it("should have valid timezone format", () => {
      // All timezones should match IANA timezone format
      const timezonePattern = /^[A-Z][a-z]+\/[A-Za-z_]+/;
      timeZonesList.forEach((tz) => {
        // Etc/GMT+0 format is also valid
        if (!tz.startsWith("Etc/GMT")) {
          expect(tz).toMatch(timezonePattern);
        }
      });
    });

    it("should not contain duplicates", () => {
      const unique = new Set(timeZonesList);
      expect(unique.size).toBe(timeZonesList.length);
    });

    it("should have reasonable number of timezones", () => {
      // Should have at least 20 timezones but not thousands
      expect(timeZonesList.length).toBeGreaterThan(20);
      expect(timeZonesList.length).toBeLessThan(200);
    });
  });
});

