/**
 * Integration tests for batch posts service
 * Tests app/features/posts/services/batch-posts.server.ts
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock dependencies
vi.mock("~/models/post.queries.server", () => ({
  getPostsByIds: vi.fn(),
}));

vi.mock("~/lib/error-handler.server", () => ({
  createSuccessResponse: vi.fn((data: unknown) => ({ success: true, data })),
}));

vi.mock("~/lib/errors", () => ({
  ValidationError: class extends Error {
    constructor(
      message: string,
      public details?: unknown,
    ) {
      super(message);
      this.name = "ValidationError";
    }
  },
  DatabaseError: class extends Error {
    constructor(
      message: string,
      public details?: unknown,
    ) {
      super(message);
      this.name = "DatabaseError";
    }
  },
}));

import {
  getBatchPosts,
  parseBatchPostsRequest,
} from "~/features/posts/services/batch-posts.server";
import { ValidationError } from "~/lib/errors";
import { getPostsByIds } from "~/models/post.queries.server";

import { TEST_USER_ID } from "../../utils/test-helpers";

describe("Batch Posts Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getBatchPosts", () => {
    it("should fetch posts by IDs", async () => {
      const mockPosts = [
        { id: "post-1", content: "Post 1" },
        { id: "post-2", content: "Post 2" },
      ];
      (getPostsByIds as ReturnType<typeof vi.fn>).mockResolvedValue(mockPosts);

      const result = await getBatchPosts(TEST_USER_ID, ["post-1", "post-2"]);

      expect(getPostsByIds).toHaveBeenCalledWith({
        ids: ["post-1", "post-2"],
        userId: TEST_USER_ID,
      });
      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockPosts);
    });

    it("should throw ValidationError for non-array postIds", async () => {
      await expect(
        getBatchPosts(TEST_USER_ID, "not-an-array" as unknown as string[]),
      ).rejects.toThrow(ValidationError);
      expect(getPostsByIds).not.toHaveBeenCalled();
    });

    it("should throw ValidationError for null postIds", async () => {
      await expect(
        getBatchPosts(TEST_USER_ID, null as unknown as string[]),
      ).rejects.toThrow(ValidationError);
      expect(getPostsByIds).not.toHaveBeenCalled();
    });

    it("should handle database errors", async () => {
      (getPostsByIds as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error("Database connection failed"),
      );

      await expect(getBatchPosts(TEST_USER_ID, ["post-1"])).rejects.toThrow(
        "Failed to fetch posts",
      );
    });

    it("should handle empty array", async () => {
      (getPostsByIds as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      const result = await getBatchPosts(TEST_USER_ID, []);

      expect(getPostsByIds).toHaveBeenCalledWith({
        ids: [],
        userId: TEST_USER_ID,
      });
      expect(result.success).toBe(true);
      expect(result.data).toEqual([]);
    });
  });

  describe("parseBatchPostsRequest", () => {
    it("should parse valid request body", () => {
      const body = { postIds: ["post-1", "post-2", "post-3"] };

      const result = parseBatchPostsRequest(body);

      expect(result).toEqual({
        postIds: ["post-1", "post-2", "post-3"],
      });
    });

    it("should throw ValidationError for non-object body", () => {
      expect(() => parseBatchPostsRequest("not-an-object")).toThrow(
        ValidationError,
      );
      expect(() => parseBatchPostsRequest(null)).toThrow(ValidationError);
      expect(() => parseBatchPostsRequest(123)).toThrow(ValidationError);
    });

    it("should throw ValidationError for missing postIds", () => {
      expect(() => parseBatchPostsRequest({})).toThrow(ValidationError);
    });

    it("should throw ValidationError for non-array postIds", () => {
      expect(() => parseBatchPostsRequest({ postIds: "not-an-array" })).toThrow(
        ValidationError,
      );
      expect(() => parseBatchPostsRequest({ postIds: null })).toThrow(
        ValidationError,
      );
      expect(() => parseBatchPostsRequest({ postIds: 123 })).toThrow(
        ValidationError,
      );
    });

    it("should handle empty postIds array", () => {
      const result = parseBatchPostsRequest({ postIds: [] });

      expect(result).toEqual({ postIds: [] });
    });
  });
});
