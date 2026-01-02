/**
 * Integration tests for post command operations
 * Tests app/models/post.commands.server.ts
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock Prisma
vi.mock("~/lib/prisma.server", () => ({
  prisma: {
    post: {
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

import { prisma } from "~/lib/prisma.server";
import {
  createPost,
  updatePost,
  reschedulePost,
  updatePostStatus,
  deletePost,
} from "~/models/post.commands.server";

import { TEST_USER_ID, TEST_POST_ID } from "../../utils/test-helpers";

describe("Post Commands", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("createPost", () => {
    it("should create a post with all fields", async () => {
      const mockPost = {
        id: TEST_POST_ID,
        userId: TEST_USER_ID,
        content: "Test content",
      };
      (prisma.post.create as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockPost,
      );

      const postData = {
        userId: TEST_USER_ID,
        content: "Test content",
        fileUrl: ["https://example.com/image.jpg"],
        postType: "IMAGE" as const,
        tags: ["tag1", "tag2"],
        isScheduled: false,
        isPosted: true,
        caption: "Test caption",
      };

      const result = await createPost(postData);

      expect(prisma.post.create).toHaveBeenCalledWith(
        expect.objectContaining({
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          data: expect.objectContaining({
            content: "Test content",
            fileUrl: ["https://example.com/image.jpg"],
            postType: "IMAGE",
            tags: ["tag1", "tag2"],
            isScheduled: false,
            isPosted: true,
            caption: "Test caption",
            draft: false,
            repost: false,
            isQuotedPost: false,
            isRecyclable: false,
            manual_override: false,
          }),
        }),
      );
      expect(result).toEqual(mockPost);
    });

    it("should create a post with queue type connection", async () => {
      const mockPost = { id: TEST_POST_ID, userId: TEST_USER_ID };
      (prisma.post.create as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockPost,
      );

      const postData = {
        userId: TEST_USER_ID,
        content: "Test",
        fileUrl: [],
        postType: "TEXT" as const,
        tags: [],
        isScheduled: false,
        isPosted: false,
        queueTypeId: "queue-123",
      };

      await createPost(postData);

      expect(prisma.post.create).toHaveBeenCalledWith(
        expect.objectContaining({
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          data: expect.objectContaining({
            queueType: {
              connect: { id: "queue-123" },
            },
          }),
        }),
      );
    });

    it("should create a post with hashtag preset connection", async () => {
      const mockPost = { id: TEST_POST_ID, userId: TEST_USER_ID };
      (prisma.post.create as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockPost,
      );

      const postData = {
        userId: TEST_USER_ID,
        content: "Test",
        fileUrl: [],
        postType: "TEXT" as const,
        tags: [],
        isScheduled: false,
        isPosted: false,
        hashTagPresetId: "preset-123",
      };

      await createPost(postData);

      expect(prisma.post.create).toHaveBeenCalledWith(
        expect.objectContaining({
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          data: expect.objectContaining({
            hashTagPreset: {
              connect: { id: "preset-123" },
            },
          }),
        }),
      );
    });

    it("should handle scheduled post with scheduledFor", async () => {
      const mockPost = { id: TEST_POST_ID, userId: TEST_USER_ID };
      (prisma.post.create as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockPost,
      );

      const scheduledFor = new Date("2024-12-31T12:00:00Z");
      const postData = {
        userId: TEST_USER_ID,
        content: "Test",
        fileUrl: [],
        postType: "TEXT" as const,
        tags: [],
        isScheduled: true,
        isPosted: false,
        scheduledFor: scheduledFor.toString(),
      };

      await createPost(postData);

      expect(prisma.post.create).toHaveBeenCalledWith(
        expect.objectContaining({
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          data: expect.objectContaining({
            scheduledFor: scheduledFor.toString(),
            isScheduled: true,
          }),
        }),
      );
    });
  });

  describe("updatePostStatus", () => {
    it("should update post status to posted", async () => {
      const mockPost = {
        id: TEST_POST_ID,
        isPosted: true,
        postedAt: new Date(),
      };
      (prisma.post.update as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockPost,
      );

      const result = await updatePostStatus({
        id: TEST_POST_ID,
        userId: TEST_USER_ID,
        isPosted: true,
      });

      expect(prisma.post.update).toHaveBeenCalledWith({
        where: {
          id: TEST_POST_ID,
          userId: TEST_USER_ID,
        },
        data: {
          isPosted: true,
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          postedAt: expect.any(Date),
        },
      });
      expect(result).toEqual(mockPost);
    });

    it("should update post status to not posted", async () => {
      const mockPost = {
        id: TEST_POST_ID,
        isPosted: false,
        postedAt: new Date(),
      };
      (prisma.post.update as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockPost,
      );

      await updatePostStatus({
        id: TEST_POST_ID,
        userId: TEST_USER_ID,
        isPosted: false,
      });

      expect(prisma.post.update).toHaveBeenCalledWith({
        where: {
          id: TEST_POST_ID,
          userId: TEST_USER_ID,
        },
        data: {
          isPosted: false,
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          postedAt: expect.any(Date),
        },
      });
    });
  });

  describe("reschedulePost", () => {
    it("should reschedule post with new time", async () => {
      const mockPost = { id: TEST_POST_ID, scheduledFor: "1234567890" };
      (prisma.post.update as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockPost,
      );

      const result = await reschedulePost({
        id: TEST_POST_ID,
        userId: TEST_USER_ID,
        newScheduledFor: "1234567890",
        overrideQueue: false,
      });

      expect(prisma.post.update).toHaveBeenCalledWith({
        where: {
          id: TEST_POST_ID,
          userId: TEST_USER_ID,
        },
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        data: expect.objectContaining({
          scheduledFor: "1234567890",
          manual_override: false,
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          updatedAt: expect.any(Date),
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          signedEvent: expect.anything(),
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          nostrEvent: expect.anything(),
          nostrEventId: null,
        }),
      });
      expect(result).toEqual(mockPost);
    });

    it("should update signed events when provided", async () => {
      const mockPost = { id: TEST_POST_ID };
      (prisma.post.update as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockPost,
      );

      const signedEvent = {
        id: "event-123",
        pubkey: "pk-123",
        created_at: 1234567890,
        kind: 1,
        content: "test",
        tags: [],
        sig: "sig-123",
      };
      const nostrEvent = {
        id: "event-123",
        pubkey: "pk-123",
        created_at: 1234567890,
        kind: 1,
        content: "test",
        tags: [],
      };

      await reschedulePost({
        id: TEST_POST_ID,
        userId: TEST_USER_ID,
        newScheduledFor: "1234567890",
        overrideQueue: true,
        signedEvent,
        nostrEvent,
      });

      expect(prisma.post.update).toHaveBeenCalledWith({
        where: {
          id: TEST_POST_ID,
          userId: TEST_USER_ID,
        },
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        data: expect.objectContaining({
          signedEvent,
          nostrEvent,
          nostrEventId: "event-123",
        }),
      });
    });

    it("should connect queue type when queueTypeId is provided", async () => {
      const mockPost = { id: TEST_POST_ID };
      (prisma.post.update as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockPost,
      );

      await reschedulePost({
        id: TEST_POST_ID,
        userId: TEST_USER_ID,
        newScheduledFor: "1234567890",
        overrideQueue: false,
        queueTypeId: "queue-123",
      });

      expect(prisma.post.update).toHaveBeenCalledWith({
        where: {
          id: TEST_POST_ID,
          userId: TEST_USER_ID,
        },
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        data: expect.objectContaining({
          queueType: {
            connect: { id: "queue-123" },
          },
        }),
      });
    });

    it("should disconnect queue type when queueTypeId is null", async () => {
      const mockPost = { id: TEST_POST_ID };
      (prisma.post.update as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockPost,
      );

      await reschedulePost({
        id: TEST_POST_ID,
        userId: TEST_USER_ID,
        newScheduledFor: "1234567890",
        overrideQueue: false,
        queueTypeId: null,
      });

      expect(prisma.post.update).toHaveBeenCalledWith({
        where: {
          id: TEST_POST_ID,
          userId: TEST_USER_ID,
        },
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        data: expect.objectContaining({
          queueType: {
            disconnect: true,
          },
        }),
      });
    });
  });

  describe("updatePost", () => {
    it("should update post with partial data", async () => {
      const mockPost = { id: TEST_POST_ID, content: "Updated content" };
      (prisma.post.update as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockPost,
      );

      const result = await updatePost({
        id: TEST_POST_ID,
        userId: TEST_USER_ID,
        data: {
          content: "Updated content",
          caption: "Updated caption",
        },
      });

      expect(prisma.post.update).toHaveBeenCalledWith({
        where: {
          id: TEST_POST_ID,
          userId: TEST_USER_ID,
        },
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        data: expect.objectContaining({
          content: "Updated content",
          caption: "Updated caption",
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          updatedAt: expect.any(Date),
        }),
      });
      expect(result).toEqual(mockPost);
    });

    it("should handle queue type connection", async () => {
      const mockPost = { id: TEST_POST_ID };
      (prisma.post.update as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockPost,
      );

      await updatePost({
        id: TEST_POST_ID,
        userId: TEST_USER_ID,
        data: {
          queueTypeId: "queue-123",
        },
      });

      expect(prisma.post.update).toHaveBeenCalledWith({
        where: {
          id: TEST_POST_ID,
          userId: TEST_USER_ID,
        },
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        data: expect.objectContaining({
          queueType: {
            connect: { id: "queue-123" },
          },
        }),
      });
    });

    it("should handle queue type disconnection", async () => {
      const mockPost = { id: TEST_POST_ID };
      (prisma.post.update as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockPost,
      );

      await updatePost({
        id: TEST_POST_ID,
        userId: TEST_USER_ID,
        data: {
          queueTypeId: null,
        },
      });

      expect(prisma.post.update).toHaveBeenCalledWith({
        where: {
          id: TEST_POST_ID,
          userId: TEST_USER_ID,
        },
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        data: expect.objectContaining({
          queueType: {
            disconnect: true,
          },
        }),
      });
    });

    it("should handle hashtag preset connection", async () => {
      const mockPost = { id: TEST_POST_ID };
      (prisma.post.update as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockPost,
      );

      await updatePost({
        id: TEST_POST_ID,
        userId: TEST_USER_ID,
        data: {
          hashTagPresetId: "preset-123",
        },
      });

      expect(prisma.post.update).toHaveBeenCalledWith({
        where: {
          id: TEST_POST_ID,
          userId: TEST_USER_ID,
        },
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        data: expect.objectContaining({
          hashTagPreset: {
            connect: { id: "preset-123" },
          },
        }),
      });
    });
  });

  describe("deletePost", () => {
    it("should delete a post", async () => {
      const mockPost = { id: TEST_POST_ID, userId: TEST_USER_ID };
      (prisma.post.delete as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockPost,
      );

      const result = await deletePost({
        id: TEST_POST_ID,
        userId: TEST_USER_ID,
      });

      expect(prisma.post.delete).toHaveBeenCalledWith({
        where: {
          id: TEST_POST_ID,
          userId: TEST_USER_ID,
        },
      });
      expect(result).toEqual(mockPost);
    });
  });
});
