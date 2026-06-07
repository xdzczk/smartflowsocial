/**
 * Unit tests for published posts sort utilities
 * Tests app/features/posts/publishing/utils/published-posts-sort.ts
 */

import { describe, it, expect } from "vitest";

import {
  getDateValue,
  compareByDate,
  getEventId,
  isEngagementMetric,
  sortPublishedPosts,
} from "~/features/posts/publishing/utils/published-posts-sort";
import type { PostData } from "~/features/posts/server";

function makePost(overrides: Partial<PostData> = {}): PostData {
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- partial overrides spread
  return {
    id: "post-1",
    caption: "",
    publishedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as PostData;
}

describe("Published Posts Sort", () => {
  describe("getDateValue", () => {
    it("returns getTime() for Date", () => {
      const d = new Date("2025-01-15T12:00:00.000Z");
      expect(getDateValue(d)).toBe(d.getTime());
    });
    it("returns parsed time for string", () => {
      const iso = "2025-01-15T12:00:00.000Z";
      expect(getDateValue(iso)).toBe(new Date(iso).getTime());
    });
    it("returns 0 epoch for null/undefined", () => {
      expect(getDateValue(null)).toBe(new Date(0).getTime());
      expect(getDateValue(undefined)).toBe(new Date(0).getTime());
    });
  });

  describe("compareByDate", () => {
    it("sorts asc by publishedAt", () => {
      const a = makePost({ publishedAt: new Date("2025-01-01") });
      const b = makePost({ publishedAt: new Date("2025-01-02") });
      expect(compareByDate(a, b, "asc")).toBeLessThan(0);
      expect(compareByDate(b, a, "asc")).toBeGreaterThan(0);
    });
    it("sorts desc by publishedAt", () => {
      const a = makePost({ publishedAt: new Date("2025-01-01") });
      const b = makePost({ publishedAt: new Date("2025-01-02") });
      expect(compareByDate(a, b, "desc")).toBeGreaterThan(0);
    });
  });

  describe("getEventId", () => {
    it("returns id when signedEvent has string id", () => {
      const overrides: Partial<PostData> = {
        signedEvent: {
          id: "ev-123",
          pubkey: "pk",
          created_at: 0,
          kind: 1,
          tags: [],
          content: "",
          sig: "",
        },
      };
      const post = makePost(overrides);
      expect(getEventId(post)).toBe("ev-123");
    });
    it("returns empty string when no signedEvent", () => {
      expect(getEventId(makePost())).toBe("");
    });
    it("returns empty string when signedEvent has no id", () => {
      const signedEvent = {
        pubkey: "pk",
        created_at: 0,
        kind: 1,
        tags: [],
        content: "",
        sig: "",
      };
      const overrides: Partial<PostData> = {
        signedEvent: signedEvent as unknown as PostData["signedEvent"],
      };
      const post = makePost(overrides);
      expect(getEventId(post)).toBe("");
    });
  });

  describe("isEngagementMetric", () => {
    it("returns true for engagement keys", () => {
      expect(isEngagementMetric("likes")).toBe(true);
      expect(isEngagementMetric("replies")).toBe(true);
      expect(isEngagementMetric("mentions")).toBe(true);
      expect(isEngagementMetric("reposts")).toBe(true);
      expect(isEngagementMetric("zaps")).toBe(true);
      expect(isEngagementMetric("satszapped")).toBe(true);
    });
    it("returns false for other keys", () => {
      expect(isEngagementMetric("publishedAt")).toBe(false);
      expect(isEngagementMetric("caption")).toBe(false);
    });
  });

  describe("sortPublishedPosts", () => {
    it("sorts by publishedAt asc", () => {
      const posts = [
        makePost({ id: "2", publishedAt: new Date("2025-01-02") }),
        makePost({ id: "1", publishedAt: new Date("2025-01-01") }),
      ];
      const sorted = sortPublishedPosts(
        posts,
        { key: "publishedAt", direction: "asc" },
        undefined
      );
      const first: PostData = sorted[0]!;
      const second: PostData = sorted[1]!;
      expect(first.id).toBe("1");
      expect(second.id).toBe("2");
    });

    it("sorts by publishedAt desc", () => {
      const posts = [
        makePost({ id: "1", publishedAt: new Date("2025-01-01") }),
        makePost({ id: "2", publishedAt: new Date("2025-01-02") }),
      ];
      const sorted = sortPublishedPosts(
        posts,
        { key: "publishedAt", direction: "desc" },
        undefined
      );
      const first: PostData = sorted[0]!;
      expect(first.id).toBe("2");
    });

    it("sorts by engagement metric when stats provided", () => {
      const overrides1: Partial<PostData> = {
        id: "1",
        signedEvent: {
          id: "ev1",
          pubkey: "p",
          created_at: 0,
          kind: 1,
          tags: [],
          content: "",
          sig: "",
        },
      };
      const overrides2: Partial<PostData> = {
        id: "2",
        signedEvent: {
          id: "ev2",
          pubkey: "p",
          created_at: 0,
          kind: 1,
          tags: [],
          content: "",
          sig: "",
        },
      };
      const posts = [makePost(overrides1), makePost(overrides2)];
      const stats = {
        ev1: {
          likes: 10,
          replies: 0,
          mentions: 0,
          reposts: 0,
          zaps: 0,
          satszapped: 0,
        },
        ev2: {
          likes: 5,
          replies: 0,
          mentions: 0,
          reposts: 0,
          zaps: 0,
          satszapped: 0,
        },
      };

      const sorted = sortPublishedPosts(
        posts,
        { key: "likes", direction: "desc" },
        stats
      );
      const first: PostData = sorted[0]!;
      expect(first.id).toBe("1");
    });

    it("sorts by other property via comparePostDataByProperty", () => {
      const posts = [
        makePost({ id: "1", caption: "Banana" }),
        makePost({ id: "2", caption: "Apple" }),
      ];
      const sorted = sortPublishedPosts(
        posts,
        { key: "caption", direction: "asc" },
        undefined
      );
      const first: PostData = sorted[0]!;
      expect(first.caption).toBe("Apple");
    });

    it("does not mutate original array", () => {
      const posts = [makePost()];
      sortPublishedPosts(
        posts,
        { key: "publishedAt", direction: "asc" },
        undefined
      );
      expect(posts).toHaveLength(1);
    });
  });
});
