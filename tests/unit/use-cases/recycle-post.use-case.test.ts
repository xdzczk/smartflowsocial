/**
 * Unit tests for RecyclePostUseCase
 * Tests app/features/posts/use-cases/recycle-post.use-case.server.ts
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock dependencies (single mock so all used exports are available)
vi.mock("~/features/posts/server", () => ({
  getPostById: vi.fn(),
  createPostWithOutbox: vi.fn(),
  updatePost: vi.fn(),
}));

vi.mock("~/features/posts/services/queue-type-resolver.server", () => ({
  resolveQueueTypeId: vi.fn(),
}));

const mockTransition = vi.fn();
vi.mock("~/features/posts/state-machine/post-state-machine.server", () => ({
  PostStateMachine: class {
    transition = mockTransition;
  },
}));

vi.mock("~/lib/idempotency.server", () => ({
  generateCreationIdempotencyKey: vi.fn(
    (userId: string, content: string, scheduledFor: string) =>
      `idempotency-${String(userId)}-${String(content)}-${String(scheduledFor)}`
  ),
}));

vi.mock("~/lib/prisma.server", () => ({
  prisma: {
    post: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
    },
    subscription: {
      findUnique: vi.fn().mockResolvedValue({
        planId: "basic",
        status: "ACTIVE",
        currentPeriodEnd: new Date(Date.now() + 86400000),
        Plan: { id: "basic", name: "Basic" },
      }),
    },
  },
}));

vi.mock("~/lib/correlation-context.server", () => ({
  getCorrelationId: vi.fn((id) => id ?? "test-correlation-id"),
}));

vi.mock("~/lib/error-logger.server", () => ({
  logInfo: vi.fn(),
  logError: vi.fn(),
}));

vi.mock("~/lib/metrics/business-metrics.server", () => ({
  recordPostRecycled: vi.fn(),
}));

import { TEST_USER_ID, TEST_POST_ID } from "../../utils/test-helpers";

import { RecyclePostUseCase } from "~/features/posts/publishing/index.server";
import { createPostWithOutbox, updatePost } from "~/features/posts/server";
import { getPostById } from "~/features/posts/server";
import { resolveQueueTypeId } from "~/features/posts/services/queue-type-resolver.server";
import { recordPostRecycled } from "~/lib/metrics/business-metrics.server";
import { prisma } from "~/lib/prisma.server";

describe("RecyclePostUseCase", () => {
  let useCase: RecyclePostUseCase;

  beforeEach(() => {
    vi.clearAllMocks();
    mockTransition.mockResolvedValue(undefined);
    useCase = new RecyclePostUseCase();
  });

  describe("execute", () => {
    const mockOriginalPost = {
      id: TEST_POST_ID,
      userId: TEST_USER_ID,
      isRecyclable: true,
      currentState: "PUBLISHED",
      postType: "IMAGE",
      content: "Original content",
      caption: "Original caption",
      fileUrl: ["https://example.com/image.jpg"],
      queueTypeId: "queue-123",
      hashTagPresetId: "preset-123",
      signedEvent: {
        id: "event-123",
        pubkey: "pk-123",
        created_at: 1234567890,
        kind: 1,
        content: "test",
        tags: [],
        sig: "sig-123",
      },
      nostrEvent: {
        id: "event-123",
        pubkey: "pk-123",
        created_at: 1234567890,
        kind: 1,
        content: "test",
        tags: [],
      },
      tags: ["tag1", "tag2"],
      repost: false,
      isQuotedPost: false,
    };

    it("should recycle a post successfully without scheduling", async () => {
      const newPostId = "new-post-id";
      const mockNewPost = {
        id: newPostId,
        userId: TEST_USER_ID,
        currentState: "DRAFT",
      };

      (getPostById as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockOriginalPost
      );
      (resolveQueueTypeId as ReturnType<typeof vi.fn>).mockResolvedValue(
        "queue-123"
      );
      (prisma.post.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(
        null
      ); // No existing recycled post
      (createPostWithOutbox as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockNewPost
      );
      (updatePost as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockOriginalPost
      );

      const result = await useCase.execute({
        originalPostId: TEST_POST_ID,
        userId: TEST_USER_ID,
      });

      expect(result.newPostId).toBe(newPostId);
      expect(result.scheduled).toBe(false);
      expect(getPostById).toHaveBeenCalledWith({
        id: TEST_POST_ID,
        userId: TEST_USER_ID,
      });
      expect(createPostWithOutbox).toHaveBeenCalled();
      expect(updatePost).toHaveBeenCalledWith({
        id: TEST_POST_ID,
        userId: TEST_USER_ID,
        data: { isRecyclable: false },
      });
      expect(mockTransition).toHaveBeenCalledWith(
        newPostId,
        TEST_USER_ID,
        "DRAFT",
        "Post recycled as draft"
      );
      expect(recordPostRecycled).toHaveBeenCalledWith("IMAGE");
    });

    it("should recycle a post with scheduling", async () => {
      const newPostId = "new-post-id";
      const scheduledFor = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now
      const mockNewPost = {
        id: newPostId,
        userId: TEST_USER_ID,
        currentState: "SCHEDULED",
      };

      (getPostById as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockOriginalPost
      );
      (resolveQueueTypeId as ReturnType<typeof vi.fn>).mockResolvedValue(
        "queue-123"
      );
      (prisma.post.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(
        null
      );
      (createPostWithOutbox as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockNewPost
      );
      (updatePost as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockOriginalPost
      );

      const result = await useCase.execute({
        originalPostId: TEST_POST_ID,
        userId: TEST_USER_ID,
        scheduledFor,
      });

      expect(result.newPostId).toBe(newPostId);
      expect(result.scheduled).toBe(true);
      expect(mockTransition).toHaveBeenCalledWith(
        newPostId,
        TEST_USER_ID,
        "SCHEDULED",
        expect.stringContaining("Post recycled and scheduled")
      );
    });

    it("should return existing post if idempotency key matches", async () => {
      const existingPostId = "existing-post-id";
      const existingPost = {
        id: existingPostId,
        userId: TEST_USER_ID,
        currentState: "SCHEDULED",
      };

      (getPostById as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockOriginalPost
      );
      (resolveQueueTypeId as ReturnType<typeof vi.fn>).mockResolvedValue(
        "queue-123"
      );
      (prisma.post.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(
        existingPost
      );

      const result = await useCase.execute({
        originalPostId: TEST_POST_ID,
        userId: TEST_USER_ID,
        scheduledFor: 1234567890,
      });

      expect(result.newPostId).toBe(existingPostId);
      expect(result.scheduled).toBe(true);
      expect(createPostWithOutbox).not.toHaveBeenCalled();
    });

    it("should throw error if post is not recyclable", async () => {
      const nonRecyclablePost = {
        ...mockOriginalPost,
        isRecyclable: false,
      };

      (getPostById as ReturnType<typeof vi.fn>).mockResolvedValue(
        nonRecyclablePost
      );
      // Ensure no existing post is found (idempotency check)
      (prisma.post.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(
        null
      );

      await expect(
        useCase.execute({
          originalPostId: TEST_POST_ID,
          userId: TEST_USER_ID,
        })
      ).rejects.toThrow(`Post ${TEST_POST_ID} is not marked as recyclable`);
    });

    it("should throw error if post is not published", async () => {
      const unpublishedPost = {
        ...mockOriginalPost,
        currentState: "DRAFT",
      };

      (getPostById as ReturnType<typeof vi.fn>).mockResolvedValue(
        unpublishedPost
      );

      await expect(
        useCase.execute({
          originalPostId: TEST_POST_ID,
          userId: TEST_USER_ID,
        })
      ).rejects.toThrow(
        `Post ${TEST_POST_ID} must be published before recycling`
      );
    });

    it("should throw error if post not found", async () => {
      (getPostById as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      await expect(
        useCase.execute({
          originalPostId: TEST_POST_ID,
          userId: TEST_USER_ID,
        })
      ).rejects.toThrow(
        `Post ${TEST_POST_ID} not found for user ${TEST_USER_ID}`
      );
    });

    it("should handle marking original as non-recyclable failure gracefully", async () => {
      const newPostId = "new-post-id";
      const mockNewPost = {
        id: newPostId,
        userId: TEST_USER_ID,
        currentState: "DRAFT",
      };

      (getPostById as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockOriginalPost
      );
      (resolveQueueTypeId as ReturnType<typeof vi.fn>).mockResolvedValue(
        "queue-123"
      );
      // Ensure no existing post is found (idempotency check)
      (prisma.post.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(
        null
      );
      (createPostWithOutbox as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockNewPost
      );
      (updatePost as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error("Update failed")
      );

      // Should still succeed even if marking as non-recyclable fails
      const result = await useCase.execute({
        originalPostId: TEST_POST_ID,
        userId: TEST_USER_ID,
      });

      expect(result.newPostId).toBe(newPostId);
      expect(createPostWithOutbox).toHaveBeenCalled();
    });
  });
});
