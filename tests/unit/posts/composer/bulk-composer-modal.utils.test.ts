/**
 * Unit tests for bulk-composer-modal.utils (Phase 2.1): getModalTitle, isRepostOrQuote.
 */

import { describe, expect, it } from "vitest";

import {
  getModalTitle,
  isRepostOrQuote,
} from "~/features/posts/composer/utils/bulk-composer-modal.utils";

describe("bulk-composer-modal.utils", () => {
  describe("getModalTitle", () => {
    it("returns correct title for recycle", () => {
      expect(getModalTitle("recycle")).toBe("Recycle & Schedule Posts");
    });

    it("returns correct title for repost", () => {
      expect(getModalTitle("repost")).toBe("Schedule Reposts (Kind 6)");
    });

    it("returns correct title for quote", () => {
      expect(getModalTitle("quote")).toBe("Schedule Quote Posts");
    });

    it("returns correct title for reschedule", () => {
      expect(getModalTitle("reschedule")).toBe("Edit & Reschedule Posts");
    });

    it("returns default for unknown mode", () => {
      expect(getModalTitle("unknown" as "recycle")).toBe("Bulk Schedule Posts");
    });
  });

  describe("isRepostOrQuote", () => {
    it("returns true for repost and quote", () => {
      expect(isRepostOrQuote("repost")).toBe(true);
      expect(isRepostOrQuote("quote")).toBe(true);
    });

    it("returns false for recycle and reschedule", () => {
      expect(isRepostOrQuote("recycle")).toBe(false);
      expect(isRepostOrQuote("reschedule")).toBe(false);
    });
  });
});
