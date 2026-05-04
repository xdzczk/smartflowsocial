import { describe, expect, it } from "vitest";

import {
  buildComposeEditUrl,
  getComposeMode,
  normalizeComposeType,
  parseComposerContext,
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

  describe("parseComposerContext", () => {
    it("defaults to create mode when no mode is provided", () => {
      const result = parseComposerContext(new URLSearchParams("type=post"));
      expect(result.error).toBeNull();
      expect(result.context).toEqual({ mode: "create" });
    });

    it("supports explicit scheduled and follow-up edit params", () => {
      const scheduled = parseComposerContext(
        new URLSearchParams("mode=edit_scheduled&id=abc")
      );
      expect(scheduled.error).toBeNull();
      expect(scheduled.context).toEqual({
        mode: "edit_scheduled",
        scheduledActionId: "abc",
      });

      const followUp = parseComposerContext(
        new URLSearchParams(
          "mode=edit_follow_up&id=child&parentActionId=parent"
        )
      );
      expect(followUp.error).toBeNull();
      expect(followUp.context).toEqual({
        mode: "edit_follow_up",
        followUpActionId: "child",
        parentActionId: "parent",
      });
    });

    it("falls back to create with error for invalid mode payload", () => {
      const invalid = parseComposerContext(
        new URLSearchParams("mode=not_real&id=1")
      );
      expect(invalid.context).toEqual({ mode: "create" });
      expect(invalid.error).toContain("Unsupported compose mode");
    });
  });

  describe("buildComposeEditUrl", () => {
    it("builds canonical edit URLs", () => {
      expect(
        buildComposeEditUrl({ mode: "edit_draft", draftId: "d1" })
      ).toContain("mode=edit_draft");
      expect(
        buildComposeEditUrl({
          mode: "edit_follow_up",
          followUpActionId: "f1",
          parentActionId: "p1",
        })
      ).toContain("parentActionId=p1");
      expect(
        buildComposeEditUrl(
          { mode: "edit_scheduled", scheduledActionId: "lf1" },
          { composeType: "article" }
        )
      ).toContain("type=article");
    });
  });
});
