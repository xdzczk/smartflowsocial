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

// Mock Prisma - use vi.hoisted to allow top-level variables in mocks
const { mockPrisma } = vi.hoisted(() => {
  const mockPrisma = {
    longFormPost: {
      create: vi.fn(),
      delete: vi.fn(),
      update: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      count: vi.fn(),
    },
    queueType: {
      findFirst: vi.fn(),
    },
  };
  return { mockPrisma };
});

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

      (
        mockPrisma.longFormPost.create as ReturnType<typeof vi.fn>
      ).mockResolvedValue(mockLongFormPost);

      const result = await createLongFormPost(postData);

      expect(
        mockPrisma.longFormPost.create as ReturnType<typeof vi.fn>
      ).toHaveBeenCalledWith({
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- Jest expect matchers have complex types
        data: expect.objectContaining({
          title: "Test Article",
          content: "Article content",
          summary: "Article summary",
          image: "https://example.com/image.jpg",
          tags: ["article", "longform"],
          isPublished: false,
          queueTypeId: TEST_QUEUE_TYPE_ID,
          status: "DRAFT",
          draft: true,
          isScheduled: false,
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

      (
        mockPrisma.longFormPost.create as ReturnType<typeof vi.fn>
      ).mockResolvedValue({
        id: TEST_LONGFORM_ID,
        ...postData,
      });

      const result = await createLongFormPost(postData);

      expect(
        mockPrisma.longFormPost.create as ReturnType<typeof vi.fn>
      ).toHaveBeenCalledWith({
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- Jest expect matchers have complex types
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

      (
        mockPrisma.longFormPost.create as ReturnType<typeof vi.fn>
      ).mockResolvedValue({
        id: TEST_LONGFORM_ID,
        ...postData,
      });

      const result = await createLongFormPost(postData);

      expect(
        mockPrisma.longFormPost.create as ReturnType<typeof vi.fn>
      ).toHaveBeenCalledWith({
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- Jest expect matchers have complex types
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

      (
        mockPrisma.longFormPost.delete as ReturnType<typeof vi.fn>
      ).mockResolvedValue(mockLongFormPost);

      const result = await deleteLongFormPost({
        id: TEST_LONGFORM_ID,
        userId: TEST_USER_ID,
      });

      expect(
        mockPrisma.longFormPost.delete as ReturnType<typeof vi.fn>
      ).toHaveBeenCalledWith({
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
      const mockUpdatedPost = {
        id: TEST_LONGFORM_ID,
        userId: TEST_USER_ID,
        title: "Updated Article",
        content: "Updated content",
        summary: "Updated summary",
      };

      (
        mockPrisma.longFormPost.update as ReturnType<typeof vi.fn>
      ).mockResolvedValue(mockUpdatedPost);

      const result = await updateLongFormPost({
        id: TEST_LONGFORM_ID,
        userId: TEST_USER_ID,
        title: "Updated Article",
        content: "Updated content",
        summary: "Updated summary",
      });

      expect(
        mockPrisma.longFormPost.update as ReturnType<typeof vi.fn>
      ).toHaveBeenCalledWith({
        where: {
          id: TEST_LONGFORM_ID,
          userId: TEST_USER_ID,
        },
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- Jest expect matchers have complex types
        data: expect.objectContaining({
          title: "Updated Article",
          content: "Updated content",
          summary: "Updated summary",
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- Jest expect matchers have complex types
          updatedAt: expect.any(Date),
        }),
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

      (
        mockPrisma.longFormPost.findFirst as ReturnType<typeof vi.fn>
      ).mockResolvedValue(mockLongFormPost);

      const result = await getLongFormPost({
        id: TEST_LONGFORM_ID,
        userId: TEST_USER_ID,
      });

      expect(
        mockPrisma.longFormPost.findFirst as ReturnType<typeof vi.fn>
      ).toHaveBeenCalledWith({
        where: {
          id: TEST_LONGFORM_ID,
          userId: TEST_USER_ID,
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

      (
        mockPrisma.longFormPost.findMany as ReturnType<typeof vi.fn>
      ).mockResolvedValue(mockPosts);

      const result = await getDraftLongFormPosts({
        userId: TEST_USER_ID,
      });

      expect(
        mockPrisma.longFormPost.findMany as ReturnType<typeof vi.fn>
      ).toHaveBeenCalledWith({
        where: {
          userId: TEST_USER_ID,
          isPublished: false,
          draft: true,
        },
        include: {
          queueType: true,
        },
        orderBy: {
          updatedAt: "desc",
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

      (
        mockPrisma.longFormPost.findMany as ReturnType<typeof vi.fn>
      ).mockResolvedValue(mockPosts);

      const result = await getPublishedLongFormPosts({
        userId: TEST_USER_ID,
        page: 1,
        limit: 50,
      });

      expect(
        mockPrisma.longFormPost.findMany as ReturnType<typeof vi.fn>
      ).toHaveBeenCalledWith({
        where: {
          userId: TEST_USER_ID,
          isPublished: true,
        },
        orderBy: {
          publishedAt: "desc",
        },
        skip: 0,
        take: 50,
      });
      expect(
        mockPrisma.longFormPost.count as ReturnType<typeof vi.fn>
      ).toHaveBeenCalledWith({
        where: {
          userId: TEST_USER_ID,
          isPublished: true,
        },
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

      (
        mockPrisma.longFormPost.findMany as ReturnType<typeof vi.fn>
      ).mockResolvedValue(mockPosts);

      const result = await getScheduledLongFormPosts({
        userId: TEST_USER_ID,
      });

      expect(
        mockPrisma.longFormPost.findMany as ReturnType<typeof vi.fn>
      ).toHaveBeenCalledWith({
        where: {
          userId: TEST_USER_ID,
          status: "SCHEDULED",
        },
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

      (
        mockPrisma.longFormPost.update as ReturnType<typeof vi.fn>
      ).mockResolvedValue(mockUpdatedPost);

      const result = await updateLongFormPostStatus({
        id: TEST_LONGFORM_ID,
        userId: TEST_USER_ID,
        isPublished: true,
      });

      expect(
        mockPrisma.longFormPost.update as ReturnType<typeof vi.fn>
      ).toHaveBeenCalledWith({
        where: {
          id: TEST_LONGFORM_ID,
          userId: TEST_USER_ID,
        },
        data: {
          isPublished: true,
          status: "ACTIVE",
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- Jest expect matchers have complex types
          postedAt: expect.any(Date),
        },
      });
      expect(result).toEqual(mockUpdatedPost);
    });
  });
});
