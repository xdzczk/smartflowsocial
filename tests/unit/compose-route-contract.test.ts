import { describe, expect, it } from "vitest";

import {
  getComposeMode,
  normalizeComposeType,
  shouldDispatchToLongform,
} from "~/features/posts/composer/services/compose-route-contract";

describe("compose-route-contract", () => {
  describe("normalizeComposeType", () => {
    it("defaults unknown types to post", () => {
      expect(normalizeComposeType(null)).toBe("post");
      expect(normalizeComposeType("")).toBe("post");
      expect(normalizeComposeType("unknown")).toBe("post");
    });

    it("returns supported type values unchanged", () => {
      expect(normalizeComposeType("post")).toBe("post");
      expect(normalizeComposeType("poll")).toBe("poll");
      expect(normalizeComposeType("thread")).toBe("thread");
      expect(normalizeComposeType("article")).toBe("article");
    });
  });

  describe("getComposeMode", () => {
    it("uses article mode only for article type", () => {
      expect(getComposeMode("article")).toBe("article");
      expect(getComposeMode("post")).toBe("shortform");
      expect(getComposeMode("poll")).toBe("shortform");
      expect(getComposeMode("thread")).toBe("shortform");
    });
  });

  describe("shouldDispatchToLongform", () => {
    it("dispatches to longform for explicit article contentType", () => {
      expect(
        shouldDispatchToLongform({
          queryType: "post",
          contentType: "article",
          actionType: "save-draft",
        })
      ).toBe(true);
    });

    it("dispatches to longform for article query context", () => {
      expect(
        shouldDispatchToLongform({
          queryType: "article",
          contentType: "post",
          actionType: "save-draft",
        })
      ).toBe(true);
    });

    it("dispatches to longform for longform-specific actions", () => {
      expect(
        shouldDispatchToLongform({
          queryType: "post",
          contentType: "post",
          actionType: "schedule-longform",
        })
      ).toBe(true);
      expect(
        shouldDispatchToLongform({
          queryType: "post",
          contentType: "post",
          actionType: "upload-image",
        })
      ).toBe(true);
    });

    it("keeps shortform actions in shortform dispatch", () => {
      expect(
        shouldDispatchToLongform({
          queryType: "post",
          contentType: "post",
          actionType: "save-draft",
        })
      ).toBe(false);
      expect(
        shouldDispatchToLongform({
          queryType: "thread",
          contentType: "thread",
          actionType: "publish-now",
        })
      ).toBe(false);
    });
  });
});
