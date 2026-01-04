/**
 * Extended unit tests for Remix utility functions
 * Tests validateEmail and other functions in app/lib/remix-utils.ts
 */

import { describe, it, expect } from "vitest";

import { validateEmail } from "~/lib/remix-utils";

describe("Remix Utils - Extended", () => {
  describe("validateEmail", () => {
    it("should return true for valid email addresses", () => {
      expect(validateEmail("user@example.com")).toBe(true);
      expect(validateEmail("test@domain.co.uk")).toBe(true);
      expect(validateEmail("user.name@example.com")).toBe(true);
      expect(validateEmail("user+tag@example.com")).toBe(true);
    });

    it("should return false for strings without @", () => {
      expect(validateEmail("notanemail")).toBe(false);
      expect(validateEmail("user.example.com")).toBe(false);
    });

    it("should return false for strings shorter than 4 characters", () => {
      expect(validateEmail("a@b")).toBe(false);
      expect(validateEmail("ab@")).toBe(false);
      expect(validateEmail("@ab")).toBe(false);
    });

    it("should return false for non-string values", () => {
      expect(validateEmail(null)).toBe(false);
      expect(validateEmail(undefined)).toBe(false);
      expect(validateEmail(123)).toBe(false);
      expect(validateEmail({})).toBe(false);
      expect(validateEmail([])).toBe(false);
    });

    it("should return false for empty string", () => {
      expect(validateEmail("")).toBe(false);
    });

    it("should return false for strings with @ but too short", () => {
      expect(validateEmail("a@b")).toBe(false);
      expect(validateEmail("@bc")).toBe(false);
    });
  });
});




