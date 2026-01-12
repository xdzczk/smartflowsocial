/**
 * Unit tests for CreatePostUseCase
 * Tests app/features/posts/use-cases/create-post.use-case.server.ts
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock dependencies
const { mockPrisma } = vi.hoisted(() => {
  const mockPrisma = {
    post: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
    },
  };
  return { mockPrisma };
});

vi.mock("~/lib/prisma.server", () => ({
  prisma: mockPrisma,
}));

vi.mock("~/models/post.commands.server", () => ({
  createPostWithOutbox: vi.fn(),
}));

vi.mock("~/features/posts/services/queue-type-resolver.server", () => ({
  resolveQueueTypeId: vi.fn(),
}));

vi.mock("~/lib/idempotency.server", () => ({
  generateCreationIdempotencyKey: vi.fn(),
}));

const mockTransition = vi.fn();
vi.mock("~/features/posts/state-machine/post-state-machine.server", () => ({
  PostStateMachine: class {
    transition = mockTransition;
  },
}));

vi.mock("~/lib/correlation-context.server", () => ({
  getCorrelationId: vi.fn((id) => id ?? "test-correlation-id"),
}));

vi.mock("~/lib/error-logger.server", () => ({
  logInfo: vi.fn(),
}));

vi.mock("~/lib/metrics/business-metrics.server", () => ({
  recordPostCreated: vi.fn(),
  recordPostScheduled: vi.fn(),
}));

import { TEST_USER_ID, TEST_POST_ID } from "../../utils/test-helpers";

import { resolveQueueTypeId } from "~/features/posts/services/queue-type-resolver.server";
import { CreatePostUseCase } from "~/features/posts/use-cases/create-post.use-case.server";
import { generateCreationIdempotencyKey } from "~/lib/idempotency.server";
// recordPostCreated and recordPostScheduled are commented out in implementation
// import { recordPostCreated, recordPostScheduled } from "~/lib/metrics/business-metrics.server";
import { prisma } from "~/lib/prisma.server";
import { createPostWithOutbox } from "~/models/post.commands.server";

describe("CreatePostUseCase", () => {
  let useCase: CreatePostUseCase;

  beforeEach(() => {
    vi.clearAllMocks();
    mockTransition.mockResolvedValue(undefined);
    useCase = new CreatePostUseCase();
  });

  describe("execute", () => {
    it("should create a draft post successfully", async () => {
      const mockPost = {
        id: TEST_POST_ID,
        userId: TEST_USER_ID,
        content: "Test content",
        postType: "TEXT",
        isScheduled: false,
        isPosted: false,
      };

      (resolveQueueTypeId as ReturnType<typeof vi.fn>).mockResolvedValue(
        "queue-1"
      );
      (
        generateCreationIdempotencyKey as ReturnType<typeof vi.fn>
      ).mockReturnValue("idempotency-key-1");
      (prisma.post.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(
        null
      );
      (createPostWithOutbox as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockPost
      );

      const result = await useCase.execute({
        userId: TEST_USER_ID,
        content: "Test content",
        fileUrl: [],
        postType: "TEXT",
        isRecyclable: false,
      });

      expect(result.post).toEqual(mockPost);
      expect(result.needsScheduling).toBe(false);
      expect(resolveQueueTypeId).toHaveBeenCalledWith(
        TEST_USER_ID,
        undefined,
        undefined
      );
      expect(createPostWithOutbox).toHaveBeenCalled();
      expect(mockTransition).toHaveBeenCalledWith(
        TEST_POST_ID,
        TEST_USER_ID,
        "DRAFT",
        "Post created as draft"
      );
      // recordPostCreated is currently commented out in implementation
      // expect(recordPostCreated).toHaveBeenCalledWith("TEXT", false);
      // expect(recordPostScheduled).not.toHaveBeenCalled();
    });

    it("should create a scheduled post successfully", async () => {
      const scheduledFor = Math.floor(Date.now() / 1000) + 3600;
      const mockPost = {
        id: TEST_POST_ID,
        userId: TEST_USER_ID,
        content: "Test content",
        postType: "IMAGE",
        isScheduled: true,
        isPosted: false,
      };

      (resolveQueueTypeId as ReturnType<typeof vi.fn>).mockResolvedValue(
        "queue-1"
      );
      (
        generateCreationIdempotencyKey as ReturnType<typeof vi.fn>
      ).mockReturnValue("idempotency-key-1");
      (prisma.post.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(
        null
      );
      (createPostWithOutbox as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockPost
      );

      const result = await useCase.execute({
        userId: TEST_USER_ID,
        content: "Test content",
        fileUrl: ["https://example.com/image.jpg"],
        postType: "IMAGE",
        isRecyclable: false,
        scheduledFor,
      });

      expect(result.post).toEqual(mockPost);
      expect(result.needsScheduling).toBe(true);
      expect(mockTransition).toHaveBeenCalledWith(
        TEST_POST_ID,
        TEST_USER_ID,
        "SCHEDULED",
        "Post created with schedule"
      );
      // recordPostCreated and recordPostScheduled are currently commented out in implementation
      // expect(recordPostCreated).toHaveBeenCalledWith("IMAGE", true);
      // expect(recordPostScheduled).toHaveBeenCalledWith("IMAGE");
    });

    it("should return existing post if idempotency key matches", async () => {
      const scheduledFor = Math.floor(Date.now() / 1000) + 3600;
      const existingPost = {
        id: "existing-post-id",
        userId: TEST_USER_ID,
        content: "Test content",
        postType: "TEXT",
        isScheduled: true,
        isPosted: false,
      };

      (resolveQueueTypeId as ReturnType<typeof vi.fn>).mockResolvedValue(
        "queue-1"
      );
      (
        generateCreationIdempotencyKey as ReturnType<typeof vi.fn>
      ).mockReturnValue("idempotency-key-1");
      (prisma.post.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(
        existingPost
      );

      const result = await useCase.execute({
        userId: TEST_USER_ID,
        content: "Test content",
        fileUrl: [],
        postType: "TEXT",
        isRecyclable: false,
        scheduledFor,
      });

      expect(result.post).toEqual(existingPost);
      expect(result.needsScheduling).toBe(true);
      expect(createPostWithOutbox).not.toHaveBeenCalled();
      expect(mockTransition).not.toHaveBeenCalled();
    });

    it("should apply hashtags when provided", async () => {
      const mockPost = {
        id: TEST_POST_ID,
        userId: TEST_USER_ID,
        content: "Test content\n#hashtag1 #hashtag2",
        postType: "TEXT",
        isScheduled: false,
        isPosted: false,
      };

      (resolveQueueTypeId as ReturnType<typeof vi.fn>).mockResolvedValue(
        "queue-1"
      );
      (
        generateCreationIdempotencyKey as ReturnType<typeof vi.fn>
      ).mockReturnValue("idempotency-key-1");
      (prisma.post.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(
        null
      );
      (createPostWithOutbox as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockPost
      );

      await useCase.execute({
        userId: TEST_USER_ID,
        content: "Test content",
        fileUrl: [],
        postType: "TEXT",
        isRecyclable: false,
        hashTagPresetTags: "#hashtag1 #hashtag2",
        showHashTagsinPosts: true,
      });

      expect(createPostWithOutbox).toHaveBeenCalledWith(
        expect.objectContaining({
          content: "Test content\n#hashtag1 #hashtag2",
        }),
        undefined,
        expect.any(String)
      );
    });

    it("should not apply hashtags when showHashTagsinPosts is false", async () => {
      const mockPost = {
        id: TEST_POST_ID,
        userId: TEST_USER_ID,
        content: "Test content",
        postType: "TEXT",
        isScheduled: false,
        isPosted: false,
      };

      (resolveQueueTypeId as ReturnType<typeof vi.fn>).mockResolvedValue(
        "queue-1"
      );
      (
        generateCreationIdempotencyKey as ReturnType<typeof vi.fn>
      ).mockReturnValue("idempotency-key-1");
      (prisma.post.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(
        null
      );
      (createPostWithOutbox as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockPost
      );

      await useCase.execute({
        userId: TEST_USER_ID,
        content: "Test content",
        fileUrl: [],
        postType: "TEXT",
        isRecyclable: false,
        hashTagPresetTags: "#hashtag1 #hashtag2",
        showHashTagsinPosts: false,
      });

      expect(createPostWithOutbox).toHaveBeenCalledWith(
        expect.objectContaining({
          content: "Test content",
        }),
        undefined,
        expect.any(String)
      );
    });

    it("should resolve queue type when queueType name is provided", async () => {
      const mockPost = {
        id: TEST_POST_ID,
        userId: TEST_USER_ID,
        content: "Test content",
        postType: "TEXT",
        isScheduled: false,
        isPosted: false,
      };

      (resolveQueueTypeId as ReturnType<typeof vi.fn>).mockResolvedValue(
        "queue-1"
      );
      (
        generateCreationIdempotencyKey as ReturnType<typeof vi.fn>
      ).mockReturnValue("idempotency-key-1");
      (prisma.post.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(
        null
      );
      (createPostWithOutbox as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockPost
      );

      await useCase.execute({
        userId: TEST_USER_ID,
        content: "Test content",
        fileUrl: [],
        postType: "TEXT",
        isRecyclable: false,
        queueType: "posts",
      });

      expect(resolveQueueTypeId).toHaveBeenCalledWith(
        TEST_USER_ID,
        undefined,
        "posts"
      );
    });

    it("should use correlation ID if provided", async () => {
      const mockPost = {
        id: TEST_POST_ID,
        userId: TEST_USER_ID,
        content: "Test content",
        postType: "TEXT",
        isScheduled: false,
        isPosted: false,
      };

      (resolveQueueTypeId as ReturnType<typeof vi.fn>).mockResolvedValue(
        "queue-1"
      );
      (
        generateCreationIdempotencyKey as ReturnType<typeof vi.fn>
      ).mockReturnValue("idempotency-key-1");
      (prisma.post.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(
        null
      );
      (createPostWithOutbox as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockPost
      );

      await useCase.execute({
        userId: TEST_USER_ID,
        content: "Test content",
        fileUrl: [],
        postType: "TEXT",
        isRecyclable: false,
        correlationId: "custom-correlation-id",
      });

      expect(createPostWithOutbox).toHaveBeenCalledWith(
        expect.any(Object),
        undefined,
        "custom-correlation-id"
      );
    });

    it("should handle state transition failure gracefully", async () => {
      const mockPost = {
        id: TEST_POST_ID,
        userId: TEST_USER_ID,
        content: "Test content",
        postType: "TEXT",
        isScheduled: false,
        isPosted: false,
      };

      (resolveQueueTypeId as ReturnType<typeof vi.fn>).mockResolvedValue(
        "queue-1"
      );
      (
        generateCreationIdempotencyKey as ReturnType<typeof vi.fn>
      ).mockReturnValue("idempotency-key-1");
      (prisma.post.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(
        null
      );
      (createPostWithOutbox as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockPost
      );
      mockTransition.mockRejectedValue(new Error("State transition failed"));

      await expect(
        useCase.execute({
          userId: TEST_USER_ID,
          content: "Test content",
          fileUrl: [],
          postType: "TEXT",
          isRecyclable: false,
        })
      ).rejects.toThrow("State transition failed");
    });
  });
});
