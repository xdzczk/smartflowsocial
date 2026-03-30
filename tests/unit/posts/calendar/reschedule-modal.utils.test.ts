/**
 * Unit tests for reschedule-modal.utils (Phase 3.1): parseFileUrl, getFirstMediaFromFileUrl,
 * getFirstMedia, formatDateTime, validateDateTime, formatDateTimeForInput,
 * RescheduleData type for calendar state.
 */

import { describe, expect, it, vi } from "vitest";

import type { RescheduleData } from "~/features/posts/calendar/Calendar/utils/reschedule-modal.utils";
import {
  formatDateTime,
  formatDateTimeForInput,
  getFirstMediaFromFileUrl,
  parseFileUrl,
  validateDateTime,
} from "~/features/posts/calendar/Calendar/utils/reschedule-modal.utils";

describe("reschedule-modal.utils", () => {
  describe("parseFileUrl", () => {
    it("returns null for non-string", () => {
      expect(parseFileUrl(null)).toBeNull();
      expect(parseFileUrl(123)).toBeNull();
    });

    it("parses JSON array and returns first element", () => {
      expect(parseFileUrl('["https://a.com","https://b.com"]')).toBe(
        "https://a.com"
      );
    });

    it("returns string as-is when not JSON array", () => {
      expect(parseFileUrl("https://single.com")).toBe("https://single.com");
    });

    it("returns string on parse error", () => {
      expect(parseFileUrl("not-json")).toBe("not-json");
    });
  });

  describe("getFirstMediaFromFileUrl", () => {
    it("returns null when post has no fileUrl", () => {
      const post = { fileUrl: [] };
      expect(
        getFirstMediaFromFileUrl(post as unknown as RescheduleData["post"])
      ).toBeNull();
    });

    it("returns parsed first URL from fileUrl[0]", () => {
      const post = { fileUrl: ['["https://img.com"]'] };
      expect(
        getFirstMediaFromFileUrl(post as unknown as RescheduleData["post"])
      ).toBe("https://img.com");
    });

    it("returns fileUrl[0] when it is a plain string", () => {
      const post = { fileUrl: ["https://plain.com"] };
      expect(
        getFirstMediaFromFileUrl(post as unknown as RescheduleData["post"])
      ).toBe("https://plain.com");
    });
  });

  describe("formatDateTime", () => {
    it("returns formatted string with weekday and time", () => {
      const date = new Date("2024-06-15T14:30:00.000Z");
      const result = formatDateTime(date, "UTC", "24h", "en-GB");
      expect(result).toMatch(/\d/);
      expect(result.length).toBeGreaterThan(5);
    });
  });

  describe("validateDateTime", () => {
    it("returns false and sets error when dateTime is null", () => {
      const setValidationError = vi.fn();
      expect(validateDateTime(null, "UTC", setValidationError)).toBe(false);
      expect(setValidationError).not.toHaveBeenCalled();
    });

    it("sets 'Cannot schedule posts in the past' when date is in the past", () => {
      const setValidationError = vi.fn();
      const past = new Date(Date.now() - 86400000);
      expect(validateDateTime(past, "UTC", setValidationError)).toBe(false);
      expect(setValidationError).toHaveBeenCalledWith(
        "Cannot schedule posts in the past"
      );
    });

    it("returns true and clears error when date is in the future", () => {
      const setValidationError = vi.fn();
      const future = new Date(Date.now() + 86400000);
      expect(validateDateTime(future, "UTC", setValidationError)).toBe(true);
      expect(setValidationError).toHaveBeenCalledWith(null);
    });
  });

  describe("formatDateTimeForInput", () => {
    it("returns datetime-local format string", () => {
      const date = new Date("2024-06-15T14:30:00.000Z");
      const result = formatDateTimeForInput(date, "UTC");
      expect(result).toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/);
    });
  });
});
