/**
 * Unit tests for longform listing utilities
 * Tests app/features/posts/longform/utils/longform-listing-utils.ts
 */

import { describe, it, expect } from "vitest";

import {
  getFetcherFormData,
  getDefaultSortKey,
  getDefaultSortDirection,
  getSortValue,
  compareStringValues,
  longFormMatchesSearch,
  sortLongFormPosts,
  type LongFormListingSortConfig,
} from "~/features/posts/longform/utils/longform-listing-utils";

describe("Longform Listing Utils", () => {
  describe("getFetcherFormData", () => {
    it("returns undefined when fetcher is undefined", () => {
      expect(getFetcherFormData(undefined)).toBeUndefined();
    });

    it("returns formData when fetcher has formData", () => {
      const formData = new FormData();
      formData.set("key", "value");
      const fetcher = { formData };

      expect(getFetcherFormData(fetcher as never)).toBe(formData);
    });

    it("returns null when fetcher has formData null", () => {
      const fetcher = { formData: null };

      expect(getFetcherFormData(fetcher as never)).toBeNull();
    });
  });

  describe("getDefaultSortKey", () => {
    it("returns publishedAt for published", () => {
      expect(getDefaultSortKey("published")).toBe("publishedAt");
    });
    it("returns scheduledAtUtc for scheduled", () => {
      expect(getDefaultSortKey("scheduled")).toBe("scheduledAtUtc");
    });
    it("returns createdAt for draft", () => {
      expect(getDefaultSortKey("draft")).toBe("createdAt");
    });
  });

  describe("getDefaultSortDirection", () => {
    it("returns desc for published", () => {
      expect(getDefaultSortDirection("published")).toBe("desc");
    });
    it("returns asc for scheduled", () => {
      expect(getDefaultSortDirection("scheduled")).toBe("asc");
    });
    it("returns desc for draft", () => {
      expect(getDefaultSortDirection("draft")).toBe("desc");
    });
  });

  describe("getSortValue", () => {
    it("returns epoch ms for publishedAt Date", () => {
      const d = new Date("2025-01-15T12:00:00.000Z");
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- minimal test double
      const post = { publishedAt: d } as never;
      expect(getSortValue(post, "publishedAt")).toBe(d.getTime());
    });

    it("returns epoch ms for publishedAt string", () => {
      const iso = "2025-01-15T12:00:00.000Z";
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- minimal test double
      const post = { publishedAt: iso } as never;
      expect(getSortValue(post, "publishedAt")).toBe(new Date(iso).getTime());
    });

    it("returns 0 when publishedAt is null/undefined", () => {
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- minimal test double
      expect(getSortValue({ publishedAt: null } as never, "publishedAt")).toBe(
        0
      );
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- minimal test double
      expect(getSortValue({} as never, "publishedAt")).toBe(0);
    });

    it("returns epoch ms for scheduledAtUtc Date", () => {
      const d = new Date("2025-02-01T09:00:00.000Z");
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- minimal test double
      const post = { scheduledAtUtc: d } as never;
      expect(getSortValue(post, "scheduledAtUtc")).toBe(d.getTime());
    });

    it("returns 0 when scheduledAtUtc is missing", () => {
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- minimal test double
      expect(getSortValue({} as never, "scheduledAtUtc")).toBe(0);
    });

    it("returns epoch ms for createdAt", () => {
      const d = new Date("2025-01-01T00:00:00.000Z");
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- minimal test double
      const post = { createdAt: d } as never;
      expect(getSortValue(post, "createdAt")).toBe(d.getTime());
    });

    it("returns numeric value for numeric key", () => {
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- minimal test double
      const post = { someNum: 42 } as never;
      expect(getSortValue(post, "someNum")).toBe(42);
    });

    it("returns 0 for non-numeric value", () => {
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- minimal test double
      const post = { title: "x" } as never;
      expect(getSortValue(post, "title")).toBe(0);
    });
  });

  describe("compareStringValues", () => {
    it("sorts asc correctly", () => {
      expect(compareStringValues("a", "b", "asc")).toBeLessThan(0);
      expect(compareStringValues("b", "a", "asc")).toBeGreaterThan(0);
      expect(compareStringValues("a", "a", "asc")).toBe(0);
    });
    it("sorts desc correctly", () => {
      expect(compareStringValues("b", "a", "desc")).toBeLessThan(0);
      expect(compareStringValues("a", "b", "desc")).toBeGreaterThan(0);
    });
  });

  describe("longFormMatchesSearch", () => {
    it("matches title", () => {
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- minimal test double
      expect(
        longFormMatchesSearch({ title: "Hello World" } as never, "hello")
      ).toBe(true);
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- minimal test double
      expect(
        longFormMatchesSearch({ title: "Hello World" } as never, "xyz")
      ).toBe(false);
    });
    it("matches summary", () => {
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- minimal test double
      expect(
        longFormMatchesSearch({ summary: "Some summary" } as never, "summary")
      ).toBe(true);
    });
    it("returns false when no match", () => {
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- minimal test double
      expect(
        longFormMatchesSearch({ title: "Hi", summary: "Bye" } as never, "xyz")
      ).toBe(false);
    });
    it("handles null title/summary", () => {
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- minimal test double
      expect(longFormMatchesSearch({} as never, "x")).toBe(false);
    });
  });

  describe("sortLongFormPosts", () => {
    it("sorts by numeric key asc", () => {
      const posts = [
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- minimal test double
        { id: "1", createdAt: new Date("2025-01-02") } as never,
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- minimal test double
        { id: "2", createdAt: new Date("2025-01-01") } as never,
      ];
      const config: LongFormListingSortConfig = {
        key: "createdAt",
        direction: "asc",
      };
      const sorted = sortLongFormPosts(posts, config);
      expect(sorted[0]!.id).toBe("2");
      expect(sorted[1]!.id).toBe("1");
    });

    it("sorts by string key", () => {
      const posts = [
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- minimal test double
        { id: "1", title: "Banana" } as never,
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- minimal test double
        { id: "2", title: "Apple" } as never,
      ];
      const config: LongFormListingSortConfig = {
        key: "title",
        direction: "asc",
      };
      const sorted = sortLongFormPosts(posts, config);
      expect((sorted[0]! as { title: string }).title).toBe("Apple");
    });

    it("does not mutate original array", () => {
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- minimal test double
      const posts = [{ id: "1" } as never];
      const config: LongFormListingSortConfig = {
        key: "createdAt",
        direction: "asc",
      };
      sortLongFormPosts(posts, config);
      expect(posts).toHaveLength(1);
    });
  });
});
