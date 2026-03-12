/**
 * Unit tests for reschedule-modal.utils (Phase 3.1): parseFileUrl, getFirstMediaFromFileUrl,
 * getFirstMedia, formatDateTime, validateDateTime, formatDateTimeForInput,
 * getRescheduleHeaderTitle, getConfirmButtonLabel.
 */

import { describe, expect, it, vi } from "vitest";

import type { RescheduleData } from "~/features/posts/calendar/Calendar/utils/reschedule-modal.utils";
import {
  formatDateTime,
  formatDateTimeForInput,
  getConfirmButtonLabel,
  getFirstMedia,
  getFirstMediaFromFileUrl,
  getRescheduleHeaderTitle,
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

  describe("getFirstMedia", () => {
    it("returns post.image when isLongform and post has image", () => {
      const data: RescheduleData = {
        post: {
          fileUrl: [],
          image: "https://longform-img.com",
        } as unknown as RescheduleData["post"],
        newDateTime: new Date(),
        wasAutoScheduled: false,
        queueName: null,
        isEdit: false,
        isLongform: true,
      };
      expect(getFirstMedia(data)).toBe("https://longform-img.com");
    });

    it("returns getFirstMediaFromFileUrl when not longform", () => {
      const data: RescheduleData = {
        post: {
          fileUrl: ["https://reg.com"],
        } as unknown as RescheduleData["post"],
        newDateTime: new Date(),
        wasAutoScheduled: false,
        queueName: null,
        isEdit: false,
        isLongform: false,
      };
      expect(getFirstMedia(data)).toBe("https://reg.com");
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

  describe("getRescheduleHeaderTitle", () => {
    it("returns Edit Post Schedule when isEdit", () => {
      expect(getRescheduleHeaderTitle(true, false)).toBe("Edit Post Schedule");
      expect(getRescheduleHeaderTitle(true, true)).toBe("Edit Post Schedule");
    });

    it("returns Override Queue Logic when wasAutoScheduled and not edit", () => {
      expect(getRescheduleHeaderTitle(false, true)).toBe(
        "Override Queue Logic?"
      );
    });

    it("returns Update Post Time when not edit and not auto-scheduled", () => {
      expect(getRescheduleHeaderTitle(false, false)).toBe("Update Post Time?");
    });
  });

  describe("getConfirmButtonLabel", () => {
    it("returns Signing Event... when isSigningEvent", () => {
      expect(getConfirmButtonLabel(false, false, true, "idle")).toBe(
        "Signing Event..."
      );
    });

    it("returns Updating... when fetcherState is submitting", () => {
      expect(getConfirmButtonLabel(false, false, false, "submitting")).toBe(
        "Updating..."
      );
    });

    it("returns Save Changes when isEdit and not signing/submitting", () => {
      expect(getConfirmButtonLabel(true, false, false, "idle")).toBe(
        "Save Changes"
      );
    });

    it("returns Convert to Manual when wasAutoScheduled and not edit", () => {
      expect(getConfirmButtonLabel(false, true, false, "idle")).toBe(
        "Convert to Manual"
      );
    });

    it("returns Confirm otherwise", () => {
      expect(getConfirmButtonLabel(false, false, false, "idle")).toBe(
        "Confirm"
      );
    });
  });
});
