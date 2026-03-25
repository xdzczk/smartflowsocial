/**
 * Unit tests for giveaway "new" page (recent posts for selector).
 * Tests app/features/giveaway/giveaway-new.server.ts
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const mockGetRecentPublishedPosts = vi.fn();

vi.mock("~/features/posts/server", () => ({
  getRecentPublishedPosts: (...args: unknown[]) =>
    mockGetRecentPublishedPosts(...args),
}));

import { getRecentPostsForGiveawaySelector } from "~/features/giveaway/giveaway-new.server";

describe("giveaway-new", () => {
  const userId = "user-1";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getRecentPostsForGiveawaySelector", () => {
    it("returns posts mapped to id, caption, publishedAt, fileUrl, postType", async () => {
      mockGetRecentPublishedPosts.mockResolvedValue([
        {
          id: "post-1",
          caption: "Hello",
          publishedAt: new Date("2025-01-15T12:00:00Z"),
          fileUrl: ["https://example.com/a.jpg"],
          postType: "IMAGE",
        },
        {
          id: "post-2",
          caption: null,
          publishedAt: new Date("2025-01-14T00:00:00Z"),
          fileUrl: [],
          postType: "TEXT",
        },
      ]);
      const result = await getRecentPostsForGiveawaySelector(userId);
      expect(mockGetRecentPublishedPosts).toHaveBeenCalledWith({
        userId,
        days: 90,
      });
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        id: "post-1",
        caption: "Hello",
        publishedAt: "2025-01-15T12:00:00.000Z",
        fileUrl: ["https://example.com/a.jpg"],
        postType: "IMAGE",
      });
      expect(result[1]?.caption).toBeNull();
      expect(result[1]?.publishedAt).toBe("2025-01-14T00:00:00.000Z");
    });

    it("limits to default 50 posts", async () => {
      const many = Array.from({ length: 100 }, (_, i) => ({
        id: `post-${i}`,
        caption: null,
        publishedAt: new Date(),
        fileUrl: [] as string[],
        postType: "TEXT",
      }));
      mockGetRecentPublishedPosts.mockResolvedValue(many);
      const result = await getRecentPostsForGiveawaySelector(userId);
      expect(result).toHaveLength(50);
    });

    it("respects custom limit", async () => {
      mockGetRecentPublishedPosts.mockResolvedValue([
        {
          id: "p1",
          caption: null,
          publishedAt: new Date(),
          fileUrl: [],
          postType: "TEXT",
        },
        {
          id: "p2",
          caption: null,
          publishedAt: new Date(),
          fileUrl: [],
          postType: "TEXT",
        },
        {
          id: "p3",
          caption: null,
          publishedAt: new Date(),
          fileUrl: [],
          postType: "TEXT",
        },
      ]);
      const result = await getRecentPostsForGiveawaySelector(userId, 2);
      expect(result).toHaveLength(2);
    });
  });
});
