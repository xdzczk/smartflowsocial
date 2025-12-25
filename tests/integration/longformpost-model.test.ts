/**
 * Integration tests for LongFormPost model functions
 * 
 * Tests the database operations in app/models/longformpost.server.ts
 * Uses mocked Prisma to test business logic without requiring a real database.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createLongFormPost,
  deleteLongFormPost,
  updateLongFormPost,
  getLongFormPost,
  getDraftLongFormPosts,
  getPublishedLongFormPosts,
  getScheduledLongFormPosts,
  updateLongFormPostStatus,
} from "~/models/longformpost.server";

// Mock Prisma
const mockPrisma = {
  longFormPost: {
    create: vi.fn(),
    delete: vi.fn(),
    update: vi.fn(),
    findUnique: vi.fn(),
    findMany: vi.fn(),
  },
  queueType: {
    findFirst: vi.fn(),
  },
};

vi.mock("~/lib/prisma.server", () => ({
  prisma: mockPrisma,
}));

describe("LongFormPost Model Functions", () => {
  const TEST_USER_ID = "user-123";
  const TEST_LONGFORM_ID = "longform-123";
  const TEST_QUEUE_TYPE_ID = "queue-123";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("createLongFormPost", () => {
    it("should create a longform post with all fields", async () => {
      const postData = {
        userId: TEST_USER_ID,
        title: "Test Article",
        content: "Article content",
        summary: "Article summary",
        image: "https://example.com/image.jpg",
        tags: ["article", "longform"],
        isPublished: false,
        queueTypeId: TEST_QUEUE_TYPE_ID,
      };

      const mockLongFormPost = {
        id: TEST_LONGFORM_ID,
        ...postData,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrisma.longFormPost.create.mockResolvedValue(mockLongFormPost);

      const result = await createLongFormPost(postData);

      expect(mockPrisma.longFormPost.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          title: "Test Article",
          content: "Article content",
          summary: "Article summary",
          image: "https://example.com/image.jpg",
          tags: ["article", "longform"],
          isPublished: false,
          queueType: {
            connect: {
              id: TEST_QUEUE_TYPE_ID,
            },
          },
        }),
      });
      expect(result).toEqual(mockLongFormPost);
    });

    it("should handle draft longform posts", async () => {
      const postData = {
        userId: TEST_USER_ID,
        title: "Draft Article",
        content: "Draft content",
        tags: [],
        draft: true,
        isPublished: false,
      };

      mockPrisma.longFormPost.create.mockResolvedValue({
        id: TEST_LONGFORM_ID,
        ...postData,
      });

      const result = await createLongFormPost(postData);

      expect(mockPrisma.longFormPost.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          draft: true,
        }),
      });
      expect(result).toBeDefined();
    });

    it("should handle scheduled longform posts", async () => {
      const scheduledDate = new Date("2024-01-15T10:00:00Z");
      const postData = {
        userId: TEST_USER_ID,
        title: "Scheduled Article",
        content: "Scheduled content",
        tags: [],
        isScheduled: true,
        isPublished: false,
        scheduledFor: scheduledDate.toString(),
      };

      mockPrisma.longFormPost.create.mockResolvedValue({
        id: TEST_LONGFORM_ID,
        ...postData,
      });

      const result = await createLongFormPost(postData);

      expect(mockPrisma.longFormPost.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          isScheduled: true,
          scheduledFor: scheduledDate.toString(),
        }),
      });
      expect(result).toBeDefined();
    });
  });

  describe("deleteLongFormPost", () => {
    it("should delete a longform post by id and userId", async () => {
      const mockLongFormPost = {
        id: TEST_LONGFORM_ID,
        userId: TEST_USER_ID,
        title: "Test Article",
      };

      mockPrisma.longFormPost.delete.mockResolvedValue(mockLongFormPost);

      const result = await deleteLongFormPost({
        id: TEST_LONGFORM_ID,
        userId: TEST_USER_ID,
      });

      expect(mockPrisma.longFormPost.delete).toHaveBeenCalledWith({
        where: {
          id: TEST_LONGFORM_ID,
          userId: TEST_USER_ID,
        },
      });
      expect(result).toEqual(mockLongFormPost);
    });
  });

  describe("updateLongFormPost", () => {
    it("should update a longform post with new data", async () => {
      const updateData = {
        title: "Updated Article",
        content: "Updated content",
        summary: "Updated summary",
      };

      const mockUpdatedPost = {
        id: TEST_LONGFORM_ID,
        userId: TEST_USER_ID,
        ...updateData,
      };

      mockPrisma.longFormPost.update.mockResolvedValue(mockUpdatedPost);

      const result = await updateLongFormPost({
        id: TEST_LONGFORM_ID,
        userId: TEST_USER_ID,
        data: updateData,
      });

      expect(mockPrisma.longFormPost.update).toHaveBeenCalledWith({
        where: {
          id: TEST_LONGFORM_ID,
          userId: TEST_USER_ID,
        },
        data: updateData,
      });
      expect(result).toEqual(mockUpdatedPost);
    });
  });

  describe("getLongFormPost", () => {
    it("should get a longform post by id", async () => {
      const mockLongFormPost = {
        id: TEST_LONGFORM_ID,
        userId: TEST_USER_ID,
        title: "Test Article",
        queueType: { name: "articles" },
      };

      mockPrisma.longFormPost.findUnique.mockResolvedValue(mockLongFormPost);

      const result = await getLongFormPost(TEST_LONGFORM_ID);

      expect(mockPrisma.longFormPost.findUnique).toHaveBeenCalledWith({
        where: {
          id: TEST_LONGFORM_ID,
        },
        include: {
          queueType: true,
        },
      });
      expect(result).toEqual(mockLongFormPost);
    });
  });

  describe("getDraftLongFormPosts", () => {
    it("should get draft longform posts for a user", async () => {
      const mockPosts = [
        {
          id: "longform-1",
          userId: TEST_USER_ID,
          draft: true,
          isPublished: false,
          queueType: { name: "articles" },
        },
      ];

      mockPrisma.longFormPost.findMany.mockResolvedValue(mockPosts);

      const result = await getDraftLongFormPosts({
        userId: TEST_USER_ID,
        queueType: "articles",
      });

      expect(mockPrisma.longFormPost.findMany).toHaveBeenCalledWith({
        where: expect.objectContaining({
          userId: TEST_USER_ID,
          draft: true,
          queueType: {
            name: "articles",
          },
        }),
        include: {
          queueType: true,
        },
        orderBy: {
          createdAt: "desc",
        },
      });
      expect(result).toEqual(mockPosts);
    });
  });

  describe("getPublishedLongFormPosts", () => {
    it("should get published longform posts with pagination", async () => {
      const mockPosts = [
        {
          id: "longform-1",
          userId: TEST_USER_ID,
          isPublished: true,
          publishedAt: new Date(),
          queueType: { name: "articles" },
        },
      ];

      mockPrisma.longFormPost.findMany.mockResolvedValue(mockPosts);

      const result = await getPublishedLongFormPosts({
        userId: TEST_USER_ID,
        page: 1,
        limit: 50,
      });

      expect(mockPrisma.longFormPost.findMany).toHaveBeenCalledWith({
        where: expect.objectContaining({
          userId: TEST_USER_ID,
          isPublished: true,
        }),
        include: {
          queueType: true,
        },
        orderBy: {
          publishedAt: "desc",
        },
        skip: 0,
        take: 50,
      });
      expect(result.posts).toEqual(mockPosts);
    });
  });

  describe("getScheduledLongFormPosts", () => {
    it("should get scheduled longform posts for a user", async () => {
      const mockPosts = [
        {
          id: "longform-1",
          userId: TEST_USER_ID,
          isScheduled: true,
          isPublished: false,
          queueType: { name: "articles" },
        },
      ];

      mockPrisma.longFormPost.findMany.mockResolvedValue(mockPosts);

      const result = await getScheduledLongFormPosts({
        userId: TEST_USER_ID,
      });

      expect(mockPrisma.longFormPost.findMany).toHaveBeenCalledWith({
        where: expect.objectContaining({
          userId: TEST_USER_ID,
          isScheduled: true,
          isPublished: false,
        }),
        include: {
          queueType: true,
        },
        orderBy: {
          scheduledFor: "asc",
        },
      });
      expect(result).toEqual(mockPosts);
    });
  });

  describe("updateLongFormPostStatus", () => {
    it("should update longform post status to published", async () => {
      const mockUpdatedPost = {
        id: TEST_LONGFORM_ID,
        userId: TEST_USER_ID,
        isPublished: true,
        publishedAt: new Date(),
      };

      mockPrisma.longFormPost.update.mockResolvedValue(mockUpdatedPost);

      const result = await updateLongFormPostStatus({
        id: TEST_LONGFORM_ID,
        userId: TEST_USER_ID,
        isPublished: true,
      });

      expect(mockPrisma.longFormPost.update).toHaveBeenCalledWith({
        where: {
          id: TEST_LONGFORM_ID,
          userId: TEST_USER_ID,
        },
        data: {
          isPublished: true,
          publishedAt: expect.any(Date),
        },
      });
      expect(result).toEqual(mockUpdatedPost);
    });
  });
});

