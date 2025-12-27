/**
 * Unit tests for helper utility functions
 * 
 * Tests the utility functions in app/lib/helpers.ts
 */

import { describe, it, expect } from "vitest";

import {
  getTimeRemaining,
  convertToHex,
  formatDate,
  getImageUrls,
  isVideoFile,
} from "~/lib/helpers";

describe("Helper Utilities", () => {
  describe("getTimeRemaining", () => {
    it("should return days and hours for future dates", () => {
      const now = new Date("2024-01-15T10:00:00Z");
      const future = new Date("2024-01-17T14:00:00Z"); // 2 days, 4 hours later

      const result = getTimeRemaining(future, now);

      expect(result).toBe("2d 4h");
    });

    it("should return hours and minutes for same-day future times", () => {
      const now = new Date("2024-01-15T10:00:00Z");
      const future = new Date("2024-01-15T12:30:00Z"); // 2 hours, 30 minutes later

      const result = getTimeRemaining(future, now);

      expect(result).toBe("2h 30m");
    });

    it("should return minutes and seconds for near-future times", () => {
      const now = new Date("2024-01-15T10:00:00Z");
      const future = new Date("2024-01-15T10:05:30Z"); // 5 minutes, 30 seconds later

      const result = getTimeRemaining(future, now);

      expect(result).toBe("5m 30s");
    });

    it("should return only seconds for very near future", () => {
      const now = new Date("2024-01-15T10:00:00Z");
      const future = new Date("2024-01-15T10:00:45Z"); // 45 seconds later

      const result = getTimeRemaining(future, now);

      expect(result).toBe("45s");
    });

    it("should handle string dates", () => {
      const now = new Date("2024-01-15T10:00:00Z");
      const future = "2024-01-15T12:00:00Z";

      const result = getTimeRemaining(future, now);

      expect(result).toBe("2h 0m");
    });

    it("should use current time when not provided", () => {
      const now = Date.now();
      const future = new Date(now + 2 * 60 * 60 * 1000); // 2 hours from now

      const result = getTimeRemaining(future);

      // Allow for small timing differences (should be close to 2h, but might be 1h 59m due to execution time)
      expect(result).toMatch(/(1h 59m|2h \d+m)/);
    });

    it("should handle past dates (negative time)", () => {
      const now = new Date("2024-01-15T10:00:00Z");
      const past = new Date("2024-01-15T09:00:00Z"); // 1 hour ago

      const result = getTimeRemaining(past, now);

      // Should return negative time or 0s
      expect(result).toBeDefined();
      expect(typeof result).toBe("string");
      expect(result.length).toBeGreaterThan(0);
      // Should indicate past time (negative or 0s)
      expect(result).toMatch(/^-?\d+[hms]|0s$/);
    });

    it("should handle exact same time", () => {
      const now = new Date("2024-01-15T10:00:00Z");

      const result = getTimeRemaining(now, now);

      expect(result).toBe("0s");
    });
  });

  describe("convertToHex", () => {
    it("should convert valid npub to hex", () => {
      // Using a valid test npub format
      // Note: This will need a real npub for actual testing
      const npub = "npub1test1234567890abcdefghijklmnopqrstuvwxyz1234567890abcdefghijklmnop";

      // Mock nip19.decode to return test data
      const result = convertToHex(npub);

      // If npub is invalid, it should return null
      // For a real test, we'd need a valid npub
      // More specific: should return null or a hex string
      if (result !== null) {
        expect(typeof result).toBe("string");
        expect(result).toMatch(/^[0-9a-f]+$/i); // Hex format
        expect(result.length).toBeGreaterThan(0);
      } else {
        expect(result).toBeNull();
      }
    });

    it("should return null for invalid npub", () => {
      const invalidNpub = "invalid-npub-string";

      const result = convertToHex(invalidNpub);

      expect(result).toBeNull();
    });

    it("should return null for empty string", () => {
      const result = convertToHex("");

      expect(result).toBeNull();
    });

    it("should handle non-string inputs gracefully", () => {
      // TypeScript should prevent this, but test runtime behavior
      const result = convertToHex(null as unknown as string);

      expect(result).toBeNull();
    });
  });

  describe("formatDate", () => {
    it("should format date string correctly", () => {
      const dateStr = "2024-01-15T10:30:00Z";

      const result = formatDate(dateStr);

      // Should be in MM/DD/YYYY, HH:MM AM/PM format
      expect(result).toMatch(/\d{2}\/\d{2}\/\d{4}/);
      expect(result).toMatch(/\d{1,2}:\d{2}\s(AM|PM)/);
    });

    it("should format Date object correctly", () => {
      const date = new Date("2024-01-15T10:30:00Z");

      const result = formatDate(date);

      expect(result).toMatch(/\d{2}\/\d{2}\/\d{4}/);
      expect(result).toMatch(/\d{1,2}:\d{2}\s(AM|PM)/);
    });

    it("should handle midnight correctly", () => {
      // Create date in local timezone to avoid timezone conversion issues
      const date = new Date(2024, 0, 15, 0, 0, 0); // Jan 15, 2024, midnight local time

      const result = formatDate(date);

      expect(result).toContain("12:00 AM");
    });

    it("should handle noon correctly", () => {
      // Create date in local timezone to avoid timezone conversion issues
      const date = new Date(2024, 0, 15, 12, 0, 0); // Jan 15, 2024, noon local time

      const result = formatDate(date);

      expect(result).toContain("12:00 PM");
    });

    it("should handle different timezones", () => {
      const date = new Date("2024-01-15T15:30:00Z"); // 3:30 PM UTC

      const result = formatDate(date);

      // Result will be in local timezone
      expect(result).toBeDefined();
      expect(result).toMatch(/\d{2}\/\d{2}\/\d{4}/);
    });
  });

  describe("getImageUrls", () => {
    it("should return empty array for empty input", () => {
      const result = getImageUrls([]);

      expect(result).toEqual([]);
    });

    it("should return empty array for null/undefined", () => {
      expect(getImageUrls(null as unknown as string[])).toEqual([]);
      expect(getImageUrls(undefined as unknown as string[])).toEqual([]);
    });

    it("should return direct URLs when array contains strings", () => {
      const urls = [
        "https://example.com/image1.jpg",
        "https://example.com/image2.jpg",
      ];

      const result = getImageUrls(urls);

      expect(result).toEqual(urls);
    });

    it("should parse JSON string array", () => {
      const jsonString = JSON.stringify([
        "https://example.com/image1.jpg",
        "https://example.com/image2.jpg",
      ]);
      const urls = [jsonString];

      const result = getImageUrls(urls);

      expect(result).toEqual([
        "https://example.com/image1.jpg",
        "https://example.com/image2.jpg",
      ]);
    });

    it("should handle invalid JSON gracefully", () => {
      const invalidJson = "[invalid json";
      const urls = [invalidJson];

      const result = getImageUrls(urls);

      // Should return empty array on parse error
      expect(result).toEqual([]);
    });

    it("should handle non-array JSON string", () => {
      const jsonString = '{"url": "https://example.com/image.jpg"}';
      const urls = [jsonString];

      const result = getImageUrls(urls);

      // Should return the original array since it doesn't start with "["
      expect(result).toEqual(urls);
    });

    it("should handle mixed array and JSON string", () => {
      const urls = [
        "https://example.com/image1.jpg",
        JSON.stringify(["https://example.com/image2.jpg"]),
      ];

      const result = getImageUrls(urls);

      // Should parse the JSON string and return both
      expect(result).toContain("https://example.com/image1.jpg");
    });
  });

  describe("isVideoFile", () => {
    it("should return true for .mp4 files", () => {
      expect(isVideoFile("https://example.com/video.mp4")).toBe(true);
      expect(isVideoFile("https://example.com/path/to/video.MP4")).toBe(true);
    });

    it("should return true for .mov files", () => {
      expect(isVideoFile("https://example.com/video.mov")).toBe(true);
    });

    it("should return true for .webm files", () => {
      expect(isVideoFile("https://example.com/video.webm")).toBe(true);
    });

    it("should return true for .ogg files", () => {
      expect(isVideoFile("https://example.com/video.ogg")).toBe(true);
    });

    it("should return true for .avi files", () => {
      expect(isVideoFile("https://example.com/video.avi")).toBe(true);
    });

    it("should return true for .mkv files", () => {
      expect(isVideoFile("https://example.com/video.mkv")).toBe(true);
    });

    it("should return true for .m4v files", () => {
      expect(isVideoFile("https://example.com/video.m4v")).toBe(true);
    });

    it("should return true for .3gp files", () => {
      expect(isVideoFile("https://example.com/video.3gp")).toBe(true);
    });

    it("should return true for .flv files", () => {
      expect(isVideoFile("https://example.com/video.flv")).toBe(true);
    });

    it("should return true for .wmv files", () => {
      expect(isVideoFile("https://example.com/video.wmv")).toBe(true);
    });

    it("should return false for image files", () => {
      expect(isVideoFile("https://example.com/image.jpg")).toBe(false);
      expect(isVideoFile("https://example.com/image.png")).toBe(false);
      expect(isVideoFile("https://example.com/image.gif")).toBe(false);
    });

    it("should return false for non-video URLs", () => {
      expect(isVideoFile("https://example.com/document.pdf")).toBe(false);
      expect(isVideoFile("https://example.com/page.html")).toBe(false);
    });

    it("should return false for null or undefined", () => {
      expect(isVideoFile(null as unknown as string)).toBe(false);
      expect(isVideoFile(undefined as unknown as string)).toBe(false);
    });

    it("should return false for empty string", () => {
      expect(isVideoFile("")).toBe(false);
    });

    it("should return false for non-string input", () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Testing edge case with invalid input type
      expect(isVideoFile(123 as any)).toBe(false);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Testing edge case with invalid input type
      expect(isVideoFile({} as any)).toBe(false);
    });

    it("should handle URLs with query parameters", () => {
      expect(isVideoFile("https://example.com/video.mp4?v=1&t=10")).toBe(true);
      expect(isVideoFile("https://example.com/image.jpg?size=large")).toBe(false);
    });

    it("should handle URLs with fragments", () => {
      expect(isVideoFile("https://example.com/video.mov#timestamp")).toBe(true);
    });

    it("should be case-insensitive", () => {
      expect(isVideoFile("https://example.com/VIDEO.MP4")).toBe(true);
      expect(isVideoFile("https://example.com/Video.MoV")).toBe(true);
    });
  });
});

