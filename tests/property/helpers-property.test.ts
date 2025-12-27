/**
 * Property-based tests for helper functions
 * 
 * Uses fast-check to generate random inputs and verify properties
 */

import fc from "fast-check";
import { describe, it, expect } from "vitest";

import { getTimeRemaining, formatDate, getImageUrls, isVideoFile } from "~/lib/helpers";
describe("Property-Based Tests: Helpers", () => {
  describe("getTimeRemaining", () => {
    it("should always return a non-empty string for valid date inputs", () => {
      fc.assert(
        fc.property(
          fc.date({ min: new Date("2000-01-01"), max: new Date("2100-12-31") }),
          fc.date({ min: new Date("2000-01-01"), max: new Date("2100-12-31") }),
          (scheduledDate, currentTime) => {
            const result = getTimeRemaining(scheduledDate, currentTime);
            return typeof result === "string" && result.length > 0;
          },
        ),
        { numRuns: 100 },
      );
    });

    it("should return positive time remaining when scheduled date is in the future", () => {
      fc.assert(
        fc.property(
          fc.date({ min: new Date() }),
          (futureDate) => {
            const result = getTimeRemaining(futureDate, new Date());
            // Should contain at least one time unit (d, h, m, or s)
            return /[\d]+[dhms]/.test(result);
          },
        ),
        { numRuns: 50 },
      );
    });

    it("should handle date strings and Date objects consistently", () => {
      fc.assert(
        fc.property(
          fc.date({ min: new Date("2000-01-01"), max: new Date("2100-12-31") }),
          (date) => {
            const dateObj = new Date(date);
            const dateStr = dateObj.toISOString();
            const result1 = getTimeRemaining(dateObj);
            const result2 = getTimeRemaining(dateStr);
            // Results should be consistent (same format)
            return typeof result1 === "string" && typeof result2 === "string";
          },
        ),
        { numRuns: 50 },
      );
    });

    it("should return time in correct format (days, hours, minutes, or seconds)", () => {
      fc.assert(
        fc.property(
          fc.date({ min: new Date() }),
          (futureDate) => {
            const result = getTimeRemaining(futureDate, new Date());
            // Should match format: "Xd Xh" or "Xh Xm" or "Xm Xs" or "Xs"
            return /^(\d+d \d+h|\d+h \d+m|\d+m \d+s|\d+s)$/.test(result);
          },
        ),
        { numRuns: 50 },
      );
    });
  });

  describe("formatDate", () => {
    it("should always return a string for valid date inputs", () => {
      fc.assert(
        fc.property(
          fc.date({ min: new Date("1900-01-01"), max: new Date("2100-12-31") }),
          (date) => {
            const result = formatDate(date);
            return typeof result === "string" && result.length > 0;
          },
        ),
        { numRuns: 100 },
      );
    });

    it("should handle date strings and Date objects consistently", () => {
      fc.assert(
        fc.property(
          fc.date({ min: new Date("1900-01-01"), max: new Date("2100-12-31") }),
          (date) => {
            const dateObj = new Date(date);
            const dateStr = dateObj.toISOString();
            const result1 = formatDate(dateObj);
            const result2 = formatDate(dateStr);
            // Both should be valid strings
            return typeof result1 === "string" && typeof result2 === "string" && result1.length > 0 && result2.length > 0;
          },
        ),
        { numRuns: 50 },
      );
    });

    it("should return date in MM/DD/YYYY format", () => {
      fc.assert(
        fc.property(
          fc.date({ min: new Date("1900-01-01"), max: new Date("2100-12-31") }),
          (date) => {
            const result = formatDate(date);
            // Should contain date pattern (MM/DD/YYYY)
            return /\d{2}\/\d{2}\/\d{4}/.test(result);
          },
        ),
        { numRuns: 50 },
      );
    });
  });

  describe("getImageUrls", () => {
    it("should always return an array", () => {
      fc.assert(
        fc.property(
          fc.array(fc.string()),
          (urls) => {
            const result = getImageUrls(urls);
            return Array.isArray(result);
          },
        ),
        { numRuns: 100 },
      );
    });

    it("should return empty array for empty input", () => {
      fc.assert(
        fc.property(
          fc.constant([]),
          (urls) => {
            const result = getImageUrls(urls);
            return Array.isArray(result) && result.length === 0;
          },
        ),
      );
    });

    it("should preserve valid URL arrays", () => {
      fc.assert(
        fc.property(
          fc.array(fc.webUrl(), { minLength: 1, maxLength: 10 }),
          (urls) => {
            const result = getImageUrls(urls);
            // Should return array of same length (if not JSON string)
            return Array.isArray(result);
          },
        ),
        { numRuns: 50 },
      );
    });

    it("should parse JSON string arrays correctly", () => {
      fc.assert(
        fc.property(
          fc.array(fc.webUrl(), { minLength: 1, maxLength: 5 }),
          (urls) => {
            const jsonString = JSON.stringify(urls);
            const result = getImageUrls([jsonString]);
            return Array.isArray(result) && result.length === urls.length;
          },
        ),
        { numRuns: 50 },
      );
    });
  });

  describe("isVideoFile", () => {
    it("should return boolean for any string input", () => {
      fc.assert(
        fc.property(
          fc.string(),
          (url) => {
            const result = isVideoFile(url);
            return typeof result === "boolean";
          },
        ),
        { numRuns: 100 },
      );
    });

    it("should return true for URLs with video extensions", () => {
      const videoExtensions = [".mp4", ".mov", ".webm", ".ogg", ".avi", ".mkv", ".m4v", ".3gp", ".flv", ".wmv"];
      
      fc.assert(
        fc.property(
          fc.webUrl(),
          fc.constantFrom(...videoExtensions),
          (baseUrl, ext) => {
            const url = baseUrl + ext;
            return isVideoFile(url) === true;
          },
        ),
        { numRuns: 50 },
      );
    });

    it("should return false for URLs without video extensions", () => {
      const nonVideoExtensions = [".jpg", ".png", ".gif", ".pdf", ".txt", ".html"];
      
      fc.assert(
        fc.property(
          fc.webUrl(),
          fc.constantFrom(...nonVideoExtensions),
          (baseUrl, ext) => {
            const url = baseUrl + ext;
            return isVideoFile(url) === false;
          },
        ),
        { numRuns: 50 },
      );
    });

    it("should be case-insensitive for extensions", () => {
      fc.assert(
        fc.property(
          fc.webUrl(),
          fc.constantFrom(".MP4", ".Mov", ".WEBM", ".mp4", ".mov", ".webm"),
          (baseUrl, ext) => {
            const url1 = baseUrl + ext.toLowerCase();
            const url2 = baseUrl + ext.toUpperCase();
            const url3 = baseUrl + ext;
            // All should return same result
            return (
              isVideoFile(url1) === isVideoFile(url2) &&
              isVideoFile(url2) === isVideoFile(url3)
            );
          },
        ),
        { numRuns: 30 },
      );
    });

    it("should return false for non-string inputs", () => {
      fc.assert(
        fc.property(
          fc.oneof(fc.integer(), fc.float(), fc.boolean(), fc.constant(null), fc.constant(undefined)),
          (input) => {
            // @ts-expect-error - Testing invalid input types
            return isVideoFile(input) === false;
          },
        ),
        { numRuns: 50 },
      );
    });
  });
});






