/**
 * Integration tests for recyclable posts service
 * Tests app/features/posts/services/recyclable-posts.server.ts
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock dependencies
vi.mock("~/features/user", () => ({
  getUserById: vi.fn(),
  getQueueTypes: vi.fn(),
}));

vi.mock("~/models/post.commands.server", () => ({
  deletePost: vi.fn(),
}));

vi.mock("~/models/post.queries.server", () => ({
  getRecyclablePosts: vi.fn(),
  getPostsByIds: vi.fn(),
}));

vi.mock("~/features/posts/stats.server", () => ({
  getPostStats: vi.fn(),
}));

import { getRecyclableDashboardData, handleRecyclablePostAction } from "~/features/posts/services/recyclable-posts.server";
import { getPostStats } from "~/features/posts/stats.server";
import { getUserById, getQueueTypes } from "~/features/user";
import { deletePost } from "~/models/post.commands.server";
import { getRecyclablePosts, getPostsByIds } from "~/models/post.queries.server";

import { TEST_USER_ID, TEST_POST_ID } from "../../utils/test-helpers";

describe("Recyclable Posts Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getRecyclableDashboardData", () => {
    it("should get recyclable dashboard data", async () => {
      const mockPosts = {
        posts: [
          {
            id: "post-1",
            queueType: { id: "queue-1", name: "Queue 1" },
            signedEvent: { id: "event-123", pubkey: "pk-123", created_at: 1234567890, kind: 1, content: "test", tags: [], sig: "sig-123" },
          },
        ],
        pagination: { total: 1, pages: 1, currentPage: 1 },
      };
      const mockUser = { id: TEST_USER_ID };
      const mockQueueTypes = [
        { id: "queue-1", name: "Queue 1", isEnabled: true },
        { id: "queue-2", name: "Queue 2", isEnabled: false },
      ];
      const mockStats = { "event-123": { likes: 5, reposts: 2 } };

      (getRecyclablePosts as ReturnType<typeof vi.fn>).mockResolvedValue(mockPosts);
      (getUserById as ReturnType<typeof vi.fn>).mockResolvedValue(mockUser);
      (getQueueTypes as ReturnType<typeof vi.fn>).mockResolvedValue(mockQueueTypes);
      (getPostStats as ReturnType<typeof vi.fn>).mockResolvedValue(mockStats);

      const url = new URL("http://localhost:3000/dashboard/recyclables?page=1");
      const result = await getRecyclableDashboardData({
        userId: TEST_USER_ID,
        params: { queueType: "all" },
        url,
      });

      expect(result.posts).toEqual(mockPosts.posts);
      expect(result.pagination).toEqual(mockPosts.pagination);
      expect(result.stats).toEqual(mockStats);
      expect(result.user).toEqual(mockUser);
      expect(result.queueTypes).toHaveLength(1); // Only enabled
      expect(result.selectedQueueType).toBe("all");
    });

    it("should extract event IDs from signed events", async () => {
      const mockPosts = {
        posts: [
          {
            id: "post-1",
            signedEvent: { id: "event-1", pubkey: "pk-1", created_at: 1234567890, kind: 1, content: "test", tags: [], sig: "sig-1" },
          },
          {
            id: "post-2",
            signedEvent: { id: "event-2", pubkey: "pk-2", created_at: 1234567890, kind: 1, content: "test", tags: [], sig: "sig-2" },
          },
          {
            id: "post-3",
            signedEvent: null,
          },
        ],
        pagination: { total: 3, pages: 1, currentPage: 1 },
      };

      (getRecyclablePosts as ReturnType<typeof vi.fn>).mockResolvedValue(mockPosts);
      (getUserById as ReturnType<typeof vi.fn>).mockResolvedValue({ id: TEST_USER_ID });
      (getQueueTypes as ReturnType<typeof vi.fn>).mockResolvedValue([]);
      (getPostStats as ReturnType<typeof vi.fn>).mockResolvedValue({});

      const url = new URL("http://localhost:3000/dashboard/recyclables");
      await getRecyclableDashboardData({
        userId: TEST_USER_ID,
        params: {},
        url,
      });

      expect(getPostStats).toHaveBeenCalledWith(["event-1", "event-2"]);
    });

    it("should throw error if user not found", async () => {
      (getRecyclablePosts as ReturnType<typeof vi.fn>).mockResolvedValue({
        posts: [],
        pagination: { total: 0, pages: 0, currentPage: 1 },
      });
      (getUserById as ReturnType<typeof vi.fn>).mockResolvedValue(null);
      (getQueueTypes as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      const url = new URL("http://localhost:3000/dashboard/recyclables");
      await expect(
        getRecyclableDashboardData({
          userId: TEST_USER_ID,
          params: {},
          url,
        }),
      ).rejects.toThrow("User not found");
    });

    it("should handle pagination from URL", async () => {
      (getRecyclablePosts as ReturnType<typeof vi.fn>).mockResolvedValue({
        posts: [],
        pagination: { total: 0, pages: 0, currentPage: 2 },
      });
      (getUserById as ReturnType<typeof vi.fn>).mockResolvedValue({ id: TEST_USER_ID });
      (getQueueTypes as ReturnType<typeof vi.fn>).mockResolvedValue([]);
      (getPostStats as ReturnType<typeof vi.fn>).mockResolvedValue({});

      const url = new URL("http://localhost:3000/dashboard/recyclables?page=2");
      await getRecyclableDashboardData({
        userId: TEST_USER_ID,
        params: {},
        url,
      });

      expect(getRecyclablePosts).toHaveBeenCalledWith({
        userId: TEST_USER_ID,
        page: 2,
        limit: 50,
        queueType: "all",
      });
    });
  });

  describe("handleRecyclablePostAction", () => {
    it("should handle delete action", async () => {
      (deletePost as ReturnType<typeof vi.fn>).mockResolvedValue({ id: TEST_POST_ID });

      const formData = new FormData();
      formData.append("_action", "delete");
      formData.append("postId", TEST_POST_ID);

      const result = await handleRecyclablePostAction(formData, TEST_USER_ID);

      expect(deletePost).toHaveBeenCalledWith({ id: TEST_POST_ID, userId: TEST_USER_ID });
      const responseObj = result instanceof Response ? result : new Response(JSON.stringify(result));
      const jsonResultRaw: unknown = await responseObj.json();
      const jsonResult = jsonResultRaw && typeof jsonResultRaw === "object" && !Array.isArray(jsonResultRaw) ? jsonResultRaw as { success?: boolean; error?: string; repostData?: unknown; quotePostData?: unknown; repostEventData?: { kind?: number } } : {};
      expect(jsonResult.success).toBe(true);
    });

    it("should handle bulkDelete action", async () => {
      (deletePost as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "post-1" });

      const formData = new FormData();
      formData.append("_action", "bulkDelete");
      formData.append("postIds", JSON.stringify(["post-1", "post-2"]));

      const result = await handleRecyclablePostAction(formData, TEST_USER_ID);

      expect(deletePost).toHaveBeenCalledTimes(2);
      const responseObj = result instanceof Response ? result : new Response(JSON.stringify(result));
      const jsonResultRaw: unknown = await responseObj.json();
      const jsonResult = jsonResultRaw && typeof jsonResultRaw === "object" && !Array.isArray(jsonResultRaw) ? jsonResultRaw as { success?: boolean; error?: string; repostData?: unknown; quotePostData?: unknown; repostEventData?: { kind?: number } } : {};
      expect(jsonResult.success).toBe(true);
    });

    it("should handle bulkRepost action", async () => {
      const mockPosts = [
        { id: "post-1", signedEvent: { id: "event-1", pubkey: "pk-1", created_at: 1234567890, kind: 1, content: "test", tags: [], sig: "sig-1" } },
        { id: "post-2", signedEvent: { id: "event-2", pubkey: "pk-2", created_at: 1234567890, kind: 1, content: "test", tags: [], sig: "sig-2" } },
      ];
      (getPostsByIds as ReturnType<typeof vi.fn>).mockResolvedValue(mockPosts);

      const formData = new FormData();
      formData.append("_action", "bulkRepost");
      formData.append("postIds", JSON.stringify(["post-1", "post-2"]));

      const result = await handleRecyclablePostAction(formData, TEST_USER_ID);

      const responseObj = result instanceof Response ? result : new Response(JSON.stringify(result));
      const jsonResultRaw: unknown = await responseObj.json();
      const jsonResult = jsonResultRaw && typeof jsonResultRaw === "object" && !Array.isArray(jsonResultRaw) ? jsonResultRaw as { success?: boolean; error?: string; repostData?: unknown; quotePostData?: unknown; repostEventData?: { kind?: number } } : {};
      expect(jsonResult.repostData).toEqual(mockPosts);
    });

    it("should handle bulkQuote action", async () => {
      const mockPosts = [
        {
          id: "post-1",
          fileUrl: ["https://example.com/image.jpg"],
          caption: "Caption",
          queueType: { name: "Queue 1" },
          signedEvent: { id: "event-1", pubkey: "pk-1", created_at: 1234567890, kind: 1, content: "test", tags: [], sig: "sig-1" },
        },
      ];
      (getPostsByIds as ReturnType<typeof vi.fn>).mockResolvedValue(mockPosts);

      const formData = new FormData();
      formData.append("_action", "bulkQuote");
      formData.append("postIds", JSON.stringify(["post-1"]));

      const result = await handleRecyclablePostAction(formData, TEST_USER_ID);

      const responseObj = result instanceof Response ? result : new Response(JSON.stringify(result));
      const jsonResultRaw: unknown = await responseObj.json();
      const jsonResult = jsonResultRaw && typeof jsonResultRaw === "object" && !Array.isArray(jsonResultRaw) ? jsonResultRaw as { success?: boolean; error?: string; repostData?: unknown; quotePostData?: unknown; repostEventData?: { kind?: number } } : {};
      expect(jsonResult.quotePostData).toBeDefined();
      expect(Array.isArray(jsonResult.quotePostData)).toBe(true);
    });

    it("should handle repost action", async () => {
      const mockPost = {
        id: "post-1",
        content: "Test content",
        signedEvent: { id: "event-123", pubkey: "pk-123", created_at: 1234567890, kind: 1, content: "test", tags: [], sig: "sig-123" },
      };
      (getPostsByIds as ReturnType<typeof vi.fn>).mockResolvedValue([mockPost]);

      const formData = new FormData();
      formData.append("_action", "repost");
      formData.append("postId", "post-1");

      const result = await handleRecyclablePostAction(formData, TEST_USER_ID);

      expect(getPostsByIds).toHaveBeenCalledWith({
        ids: ["post-1"],
        userId: TEST_USER_ID,
      });
      const responseObj = result instanceof Response ? result : new Response(JSON.stringify(result));
      const jsonResultRaw: unknown = await responseObj.json();
      const jsonResult = jsonResultRaw && typeof jsonResultRaw === "object" && !Array.isArray(jsonResultRaw) ? jsonResultRaw as { success?: boolean; error?: string; repostData?: unknown; quotePostData?: unknown; repostEventData?: { kind?: number } } : {};
      expect(jsonResult.repostEventData).toBeDefined();
      expect(jsonResult.repostEventData?.kind).toBe(6);
    });

    it("should handle quote action", async () => {
      const mockPost = {
        id: "post-1",
        content: "Test content",
        caption: "Test caption",
        fileUrl: ["https://example.com/image.jpg"],
        queueType: { name: "Queue 1" },
        signedEvent: { id: "event-123", pubkey: "pk-123", created_at: 1234567890, kind: 1, content: "test", tags: [], sig: "sig-123" },
      };
      (getPostsByIds as ReturnType<typeof vi.fn>).mockResolvedValue([mockPost]);

      const formData = new FormData();
      formData.append("_action", "quote");
      formData.append("postId", "post-1");

      const result = await handleRecyclablePostAction(formData, TEST_USER_ID);

      expect(getPostsByIds).toHaveBeenCalledWith({
        ids: ["post-1"],
        userId: TEST_USER_ID,
      });
      const responseObj = result instanceof Response ? result : new Response(JSON.stringify(result));
      const jsonResultRaw: unknown = await responseObj.json();
      const jsonResult = jsonResultRaw && typeof jsonResultRaw === "object" && !Array.isArray(jsonResultRaw) ? jsonResultRaw as { success?: boolean; error?: string; repostData?: unknown; quotePostData?: unknown; repostEventData?: { kind?: number } } : {};
      expect(jsonResult.quotePostData).toBeDefined();
      expect(Array.isArray(jsonResult.quotePostData)).toBe(true);
    });

    it("should return error for invalid action", async () => {
      const formData = new FormData();
      formData.append("_action", "invalidAction");

      const result = await handleRecyclablePostAction(formData, TEST_USER_ID);

      const responseObj = result instanceof Response ? result : new Response(JSON.stringify(result));
      const jsonResultRaw: unknown = await responseObj.json();
      const jsonResult = jsonResultRaw && typeof jsonResultRaw === "object" && !Array.isArray(jsonResultRaw) ? jsonResultRaw as { success?: boolean; error?: string; repostData?: unknown; quotePostData?: unknown; repostEventData?: { kind?: number } } : {};
      expect(jsonResult.error).toBe("Invalid action");
    });
  });
});

