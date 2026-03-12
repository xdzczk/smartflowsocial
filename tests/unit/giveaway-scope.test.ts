/**
 * Unit tests for giveaway scope (getPostsInScope).
 * Tests app/features/giveaway/giveaway-scope.server.ts
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const mockGetRecentPublishedPosts = vi.fn();
const mockGetPostById = vi.fn();
const mockFindQueueTypeByIdAndUser = vi.fn();
const mockFindQueueTypeFullByIdAndUser = vi.fn();

vi.mock("~/models/post.queries.server", () => ({
  getRecentPublishedPosts: (...args: unknown[]) =>
    mockGetRecentPublishedPosts(...args),
  getPostById: (...args: unknown[]) => mockGetPostById(...args),
}));

vi.mock("~/features/giveaway/repositories/giveaway-scope-data.server", () => ({
  findQueueTypeByIdAndUser: (...args: unknown[]) =>
    mockFindQueueTypeByIdAndUser(...args),
  findQueueTypeFullByIdAndUser: (...args: unknown[]) =>
    mockFindQueueTypeFullByIdAndUser(...args),
}));

import { getPostsInScope } from "~/features/giveaway/giveaway-scope.server";
import type { GiveawayScope } from "~/features/giveaway/types";

describe("giveaway-scope", () => {
  const userId = "user-1";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getPostsInScope", () => {
    describe("PERIOD", () => {
      it("calls getRecentPublishedPosts with days, no queue when queueId omitted", async () => {
        mockGetRecentPublishedPosts.mockResolvedValue([]);
        const scope: GiveawayScope = {
          type: "PERIOD",
          reference: { days: 14 },
        };
        await getPostsInScope(userId, scope);
        expect(mockGetRecentPublishedPosts).toHaveBeenCalledWith({
          userId,
          days: 14,
          queueTypeId: undefined,
          publishedFrom: undefined,
          publishedTo: undefined,
        });
      });

      it("resolves queueTypeId when queueId present and queue found", async () => {
        mockFindQueueTypeByIdAndUser.mockResolvedValue({ id: "qt-1" });
        mockGetRecentPublishedPosts.mockResolvedValue([]);
        const scope: GiveawayScope = {
          type: "PERIOD",
          reference: {
            days: 7,
            queueId: "queue-1",
            from: new Date("2025-01-01"),
            to: new Date("2025-01-31"),
          },
        };
        await getPostsInScope(userId, scope);
        expect(mockFindQueueTypeByIdAndUser).toHaveBeenCalledWith(
          userId,
          "queue-1"
        );
        expect(mockGetRecentPublishedPosts).toHaveBeenCalledWith(
          expect.objectContaining({
            queueTypeId: "qt-1",
            days: 7,
            publishedFrom: new Date("2025-01-01"),
            publishedTo: new Date("2025-01-31"),
          })
        );
      });

      it("uses default days 7 when reference.days omitted", async () => {
        mockGetRecentPublishedPosts.mockResolvedValue([]);
        const scope: GiveawayScope = {
          type: "PERIOD",
          reference: {},
        };
        await getPostsInScope(userId, scope);
        expect(mockGetRecentPublishedPosts).toHaveBeenCalledWith(
          expect.objectContaining({ days: 7 })
        );
      });
    });

    describe("SINGLE_POST", () => {
      it("returns [post] when post exists and is PUBLISHED", async () => {
        const post = {
          id: "post-1",
          currentState: "PUBLISHED",
          queueType: {},
        };
        mockGetPostById.mockResolvedValue(post);
        const scope: GiveawayScope = {
          type: "SINGLE_POST",
          reference: { postId: "post-1" },
        };
        const result = await getPostsInScope(userId, scope);
        expect(mockGetPostById).toHaveBeenCalledWith({
          id: "post-1",
          userId,
        });
        expect(result).toHaveLength(1);
        expect(result[0]).toEqual(post);
      });

      it("returns [] when post not found", async () => {
        mockGetPostById.mockResolvedValue(null);
        const scope: GiveawayScope = {
          type: "SINGLE_POST",
          reference: { postId: "post-missing" },
        };
        const result = await getPostsInScope(userId, scope);
        expect(result).toEqual([]);
      });

      it("returns [] when post is not PUBLISHED", async () => {
        mockGetPostById.mockResolvedValue({
          id: "post-1",
          currentState: "DRAFT",
          queueType: {},
        });
        const scope: GiveawayScope = {
          type: "SINGLE_POST",
          reference: { postId: "post-1" },
        };
        const result = await getPostsInScope(userId, scope);
        expect(result).toEqual([]);
      });
    });

    describe("QUEUE", () => {
      it("returns getRecentPublishedPosts result when queue found", async () => {
        const queue = { id: "qt-1" };
        const posts = [{ id: "p1", currentState: "PUBLISHED", queueType: {} }];
        mockFindQueueTypeFullByIdAndUser.mockResolvedValue(queue);
        mockGetRecentPublishedPosts.mockResolvedValue(posts);
        const scope: GiveawayScope = {
          type: "QUEUE",
          reference: { queueId: "queue-1" },
        };
        const result = await getPostsInScope(userId, scope);
        expect(mockFindQueueTypeFullByIdAndUser).toHaveBeenCalledWith(
          userId,
          "queue-1"
        );
        expect(mockGetRecentPublishedPosts).toHaveBeenCalledWith(
          expect.objectContaining({
            queueTypeId: "qt-1",
            days: 30,
          })
        );
        expect(result).toEqual(posts);
      });

      it("uses days 0 when from and to both set", async () => {
        mockFindQueueTypeFullByIdAndUser.mockResolvedValue({ id: "qt-1" });
        mockGetRecentPublishedPosts.mockResolvedValue([]);
        const scope: GiveawayScope = {
          type: "QUEUE",
          reference: {
            queueId: "queue-1",
            from: new Date("2025-01-01"),
            to: new Date("2025-01-31"),
          },
        };
        await getPostsInScope(userId, scope);
        expect(mockGetRecentPublishedPosts).toHaveBeenCalledWith(
          expect.objectContaining({
            days: 0,
            publishedFrom: new Date("2025-01-01"),
            publishedTo: new Date("2025-01-31"),
          })
        );
      });

      it("returns [] when queue not found", async () => {
        mockFindQueueTypeFullByIdAndUser.mockResolvedValue(null);
        const scope: GiveawayScope = {
          type: "QUEUE",
          reference: { queueId: "queue-missing" },
        };
        const result = await getPostsInScope(userId, scope);
        expect(result).toEqual([]);
        expect(mockGetRecentPublishedPosts).not.toHaveBeenCalled();
      });
    });

    describe("FOLLOWERS / FOLLOWING", () => {
      it("returns [] for FOLLOWERS", async () => {
        const scope: GiveawayScope = {
          type: "FOLLOWERS",
          reference: {},
        };
        const result = await getPostsInScope(userId, scope);
        expect(result).toEqual([]);
      });

      it("returns [] for FOLLOWING", async () => {
        const scope: GiveawayScope = {
          type: "FOLLOWING",
          reference: {},
        };
        const result = await getPostsInScope(userId, scope);
        expect(result).toEqual([]);
      });
    });
  });
});
