/**
 * Unit tests for edit-post-repost-quote.client (Phase 1.2): appendRepostConditionsToForm.
 */

import { describe, expect, it } from "vitest";

import {
  appendRepostConditionsToForm,
  type RepostConditionsForm,
} from "~/features/posts/utils/edit-post-repost-quote.client";

describe("edit-post-repost-quote.client", () => {
  describe("appendRepostConditionsToForm", () => {
    it("does nothing when repostConditions is null", () => {
      const fd = new FormData();
      fd.set("existing", "value");
      appendRepostConditionsToForm(fd, null);
      expect(fd.get("existing")).toBe("value");
      expect(fd.has("minReactions")).toBe(false);
    });

    it("sets minReactions when provided", () => {
      const fd = new FormData();
      const conditions: RepostConditionsForm = { minReactions: 5 };
      appendRepostConditionsToForm(fd, conditions);
      expect(fd.get("minReactions")).toBe("5");
    });

    it("sets minZaps, minComments, minReposts, minSats when provided", () => {
      const fd = new FormData();
      const conditions: RepostConditionsForm = {
        minZaps: 10,
        minComments: 2,
        minReposts: 1,
        minSats: 100,
      };
      appendRepostConditionsToForm(fd, conditions);
      expect(fd.get("minZaps")).toBe("10");
      expect(fd.get("minComments")).toBe("2");
      expect(fd.get("minReposts")).toBe("1");
      expect(fd.get("minSats")).toBe("100");
    });

    it("omits keys when value is undefined", () => {
      const fd = new FormData();
      appendRepostConditionsToForm(fd, { minReactions: 0 });
      expect(fd.get("minReactions")).toBe("0");
      expect(fd.has("minZaps")).toBe(false);
    });

    it("sets all condition keys when all provided", () => {
      const fd = new FormData();
      const conditions: RepostConditionsForm = {
        minReactions: 1,
        minZaps: 2,
        minComments: 3,
        minReposts: 4,
        minSats: 5,
      };
      appendRepostConditionsToForm(fd, conditions);
      expect(fd.get("minReactions")).toBe("1");
      expect(fd.get("minZaps")).toBe("2");
      expect(fd.get("minComments")).toBe("3");
      expect(fd.get("minReposts")).toBe("4");
      expect(fd.get("minSats")).toBe("5");
    });
  });
});
