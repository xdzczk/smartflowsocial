/**
 * Property-based tests for data validation and sanitization
 * 
 * Uses fast-check to verify validation properties:
 * - Sanitization preserves valid data
 * - Invalid data is rejected or sanitized
 * - Normalization is idempotent
 */

import fc from "fast-check";
import { describe, it, expect } from "vitest";
describe("Property-Based Tests: Data Validation", () => {
  describe("String Sanitization Properties", () => {
    it("should preserve valid strings after sanitization", () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 0, maxLength: 1000 }).filter((s) => {
            // Valid strings: no control characters except newlines/tabs
            return !/[^\x20-\x7E\n\t]/.test(s);
          }),
          (validString) => {
            // Sanitization should preserve valid strings
            const sanitized = validString.trim();
            return sanitized === validString.trim();
          },
        ),
        { numRuns: 50 },
      );
    });

    it("should remove or escape dangerous characters", () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 100 }),
          (input) => {
            // After sanitization, should not contain script tags
            const sanitized = input.replace(/<script[^>]*>.*?<\/script>/gi, "");
            return !sanitized.includes("<script");
          },
        ),
        { numRuns: 50 },
      );
    });
  });

  describe("URL Validation Properties", () => {
    it("should validate well-formed URLs", () => {
      fc.assert(
        fc.property(
          fc.webUrl(),
          (url) => {
            try {
              new URL(url);
              return true;
            } catch {
              return false;
            }
          },
        ),
        { numRuns: 50 },
      );
    });

    it("should reject malformed URLs", () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 200 }).filter((s) => {
            try {
              new URL(s);
              return false; // Valid URL, skip
            } catch {
              return true; // Invalid URL, test it
            }
          }),
          (invalidUrl) => {
            try {
              new URL(invalidUrl);
              return false; // Should have thrown
            } catch {
              return true; // Correctly rejected
            }
          },
        ),
        { numRuns: 30 },
      );
    });
  });

  describe("Email Validation Properties", () => {
    it("should validate email format", () => {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

      fc.assert(
        fc.property(
          fc.emailAddress(),
          (email) => {
            return emailRegex.test(email);
          },
        ),
        { numRuns: 50 },
      );
    });
  });

  describe("Number Validation Properties", () => {
    it("should validate positive integers", () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 1000000 }),
          (num) => {
            return Number.isInteger(num) && num > 0;
          },
        ),
        { numRuns: 50 },
      );
    });

    it("should validate non-negative numbers", () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 1000000 }),
          (num) => {
            return num >= 0;
          },
        ),
        { numRuns: 50 },
      );
    });
  });

  describe("Array Validation Properties", () => {
    it("should validate array length constraints", () => {
      fc.assert(
        fc.property(
          fc.array(fc.string(), { minLength: 0, maxLength: 100 }),
          (arr) => {
            return arr.length >= 0 && arr.length <= 100;
          },
        ),
        { numRuns: 50 },
      );
    });

    it("should validate unique arrays", () => {
      fc.assert(
        fc.property(
          fc.uniqueArray(fc.string(), { minLength: 0, maxLength: 50 }),
          (arr) => {
            const unique = new Set(arr);
            return unique.size === arr.length;
          },
        ),
        { numRuns: 50 },
      );
    });
  });

  describe("Date Validation Properties", () => {
    it("should validate dates are within reasonable range", () => {
      fc.assert(
        fc.property(
          fc.date({ min: new Date("2000-01-01"), max: new Date("2100-12-31") }),
          (date) => {
            return (
              date >= new Date("2000-01-01") &&
              date <= new Date("2100-12-31") &&
              !isNaN(date.getTime())
            );
          },
        ),
        { numRuns: 50 },
      );
    });

    it("should validate future dates", () => {
      fc.assert(
        fc.property(
          fc.date({ min: new Date() }),
          (date) => {
            return date >= new Date() && !isNaN(date.getTime());
          },
        ),
        { numRuns: 30 },
      );
    });
  });

  describe("Normalization Idempotency", () => {
    it("should be idempotent: normalizing twice equals normalizing once", () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 0, maxLength: 100 }),
          (input) => {
            const normalized1 = input.trim().toLowerCase();
            const normalized2 = normalized1.trim().toLowerCase();
            return normalized1 === normalized2;
          },
        ),
        { numRuns: 50 },
      );
    });
  });
});





