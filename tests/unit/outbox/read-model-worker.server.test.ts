/**
 * Unit tests for Read Model Worker
 * Tests app/infra/outbox/read-model-worker.server.ts
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock dependencies
const { mockPrisma } = vi.hoisted(() => {
  const mockPrisma = {
    post: {
      findUnique: vi.fn(),
    },
    scheduledPostRead: {
      upsert: vi.fn(),
      deleteMany: vi.fn(),
    },
    publishedPostRead: {
      upsert: vi.fn(),
      deleteMany: vi.fn(),
    },
  };
  return { mockPrisma };
});

vi.mock("~/lib/prisma.server", () => ({
  prisma: mockPrisma,
}));

vi.mock("~/lib/error-logger.server", () => ({
  logInfo: vi.fn(),
  logError: vi.fn(),
}));

import { updateReadModels } from "~/infra/outbox/read-model-worker.server";
import { prisma } from "~/lib/prisma.server";

describe("Read Model Worker", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("updateReadModels", () => {
    it("should update scheduled post read model for POST_CREATED", async () => {
      const mockPost = {
        id: "post-1",
        userId: "user-1",
        caption: "Test caption",
        scheduledAtUtc: new Date("2024-01-01T12:00:00Z"),
        currentState: "SCHEDULED",
        queueType: {
          name: "posts",
          color: "#000000",
        },
        hashTagPresetId: "preset-1",
        templateId: "template-1",
        createdAt: new Date("2024-01-01T10:00:00Z"),
        updatedAt: new Date("2024-01-01T10:00:00Z"),
      };

      (prisma.post.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockPost
      );
      (
        prisma.scheduledPostRead.upsert as ReturnType<typeof vi.fn>
      ).mockResolvedValue({});

      await updateReadModels({
        id: "event-1",
        eventType: "POST_CREATED",
        aggregateId: "post-1",
        aggregateType: "Post",
        payload: {},
      });

      expect(prisma.post.findUnique).toHaveBeenCalledWith({
        where: { id: "post-1" },
        include: { queueType: true },
      });
      expect(prisma.scheduledPostRead.upsert).toHaveBeenCalledWith({
        where: { postId: "post-1" },
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- Jest expect matchers have complex types
        create: expect.objectContaining({
          id: "post-1",
          userId: "user-1",
          postId: "post-1",
          caption: "Test caption",
          scheduledAtUtc: mockPost.scheduledAtUtc,
          queueTypeName: "posts",
          queueTypeColor: "#000000",
          queueTypeColorToken: null,
        }),
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- Jest expect matchers have complex types
        update: expect.objectContaining({
          caption: "Test caption",
          scheduledAtUtc: mockPost.scheduledAtUtc,
          queueTypeName: "posts",
          queueTypeColor: "#000000",
          queueTypeColorToken: null,
        }),
      });
    });

    it("should remove from scheduled read model if post is not scheduled", async () => {
      const mockPost = {
        id: "post-1",
        userId: "user-1",
        currentState: "DRAFT",
        scheduledAtUtc: null,
        queueType: null,
      };

      (prisma.post.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockPost
      );
      (
        prisma.scheduledPostRead.deleteMany as ReturnType<typeof vi.fn>
      ).mockResolvedValue({});

      await updateReadModels({
        id: "event-1",
        eventType: "POST_UPDATED",
        aggregateId: "post-1",
        aggregateType: "Post",
        payload: {},
      });

      expect(prisma.scheduledPostRead.deleteMany).toHaveBeenCalledWith({
        where: { postId: "post-1" },
      });
      expect(prisma.scheduledPostRead.upsert).not.toHaveBeenCalled();
    });

    it("should move post to published read model for POST_PUBLISHED", async () => {
      const mockPost = {
        id: "post-1",
        userId: "user-1",
        caption: "Test caption",
        publishedAt: new Date("2024-01-01T12:00:00Z"),
        currentState: "PUBLISHED",
        queueType: {
          name: "posts",
          color: "#000000",
        },
        createdAt: new Date("2024-01-01T10:00:00Z"),
        updatedAt: new Date("2024-01-01T12:00:00Z"),
      };

      (prisma.post.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockPost
      );
      (
        prisma.scheduledPostRead.deleteMany as ReturnType<typeof vi.fn>
      ).mockResolvedValue({});
      (
        prisma.publishedPostRead.upsert as ReturnType<typeof vi.fn>
      ).mockResolvedValue({});

      await updateReadModels({
        id: "event-1",
        eventType: "POST_PUBLISHED",
        aggregateId: "post-1",
        aggregateType: "Post",
        payload: {},
      });

      expect(prisma.scheduledPostRead.deleteMany).toHaveBeenCalledWith({
        where: { postId: "post-1" },
      });
      expect(prisma.publishedPostRead.upsert).toHaveBeenCalledWith({
        where: { postId: "post-1" },
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- Jest expect matchers have complex types
        create: expect.objectContaining({
          id: "post-1",
          userId: "user-1",
          postId: "post-1",
          caption: "Test caption",
          publishedAt: mockPost.publishedAt,
          queueTypeName: "posts",
          queueTypeColor: "#000000",
          queueTypeColorToken: null,
        }),
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- Jest expect matchers have complex types
        update: expect.objectContaining({
          publishedAt: mockPost.publishedAt,
          queueTypeColorToken: null,
        }),
      });
    });

    it("should delete post from all read models for POST_DELETED", async () => {
      (
        prisma.scheduledPostRead.deleteMany as ReturnType<typeof vi.fn>
      ).mockResolvedValue({});
      (
        prisma.publishedPostRead.deleteMany as ReturnType<typeof vi.fn>
      ).mockResolvedValue({});

      await updateReadModels({
        id: "event-1",
        eventType: "POST_DELETED",
        aggregateId: "post-1",
        aggregateType: "Post",
        payload: {},
      });

      expect(prisma.scheduledPostRead.deleteMany).toHaveBeenCalledWith({
        where: { postId: "post-1" },
      });
      expect(prisma.publishedPostRead.deleteMany).toHaveBeenCalledWith({
        where: { postId: "post-1" },
      });
    });

    it("should skip longform events", async () => {
      await updateReadModels({
        id: "event-1",
        eventType: "LONGFORM_CREATED",
        aggregateId: "longform-1",
        aggregateType: "LongFormPost",
        payload: {},
      });

      expect(prisma.post.findUnique).not.toHaveBeenCalled();
      expect(prisma.scheduledPostRead.upsert).not.toHaveBeenCalled();
    });

    it("should handle post not found gracefully", async () => {
      (prisma.post.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(
        null
      );

      await updateReadModels({
        id: "event-1",
        eventType: "POST_CREATED",
        aggregateId: "post-1",
        aggregateType: "Post",
        payload: {},
      });

      expect(prisma.scheduledPostRead.upsert).not.toHaveBeenCalled();
    });

    it("should handle errors gracefully without throwing", async () => {
      const error = new Error("Database error");
      (prisma.post.findUnique as ReturnType<typeof vi.fn>).mockRejectedValue(
        error
      );

      // Should not throw
      await expect(
        updateReadModels({
          id: "event-1",
          eventType: "POST_CREATED",
          aggregateId: "post-1",
          aggregateType: "Post",
          payload: {},
        })
      ).resolves.not.toThrow();
    });

    it("should ignore job-related events", async () => {
      await updateReadModels({
        id: "event-1",
        eventType: "POST_SCHEDULED",
        aggregateId: "post-1",
        aggregateType: "Post",
        payload: {},
      });

      expect(prisma.post.findUnique).not.toHaveBeenCalled();
    });
  });
});
