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
          queueTypeId: TEST_QUEUE_TYPE_ID,
          currentState: "DRAFT",
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
        isPublished: false, // Parameter kept for backward compatibility
      };

      (
        mockPrisma.longFormPost.create as ReturnType<typeof vi.fn>
      ).mockResolvedValue({
        id: TEST_LONGFORM_ID,
        currentState: "DRAFT",
        ...postData,
      });

      const result = await createLongFormPost(postData);

      expect(
        mockPrisma.longFormPost.create as ReturnType<typeof vi.fn>
      ).toHaveBeenCalledWith({
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- Jest expect matchers have complex types
        data: expect.objectContaining({
          currentState: "DRAFT",
        }),
      });
      expect(result).toBeDefined();
    });

    it("should handle scheduled longform posts", async () => {
      const scheduledDate = new Date("2024-01-15T10:00:00Z");
      const scheduledForUnix = Math.floor(scheduledDate.getTime() / 1000);
      const postData = {
        userId: TEST_USER_ID,
        title: "Scheduled Article",
        content: "Scheduled content",
        tags: [],
        isPublished: false, // Parameter kept for backward compatibility
        scheduledFor: String(scheduledForUnix),
      };

      (
        mockPrisma.longFormPost.create as ReturnType<typeof vi.fn>
      ).mockResolvedValue({
        id: TEST_LONGFORM_ID,
        currentState: "SCHEDULED",
        ...postData,
      });

      const result = await createLongFormPost(postData);

      expect(
        mockPrisma.longFormPost.create as ReturnType<typeof vi.fn>
      ).toHaveBeenCalledWith({
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- Jest expect matchers have complex types
        data: expect.objectContaining({
          currentState: "SCHEDULED",
          scheduledAtUtc: scheduledDate,
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
          currentState: "DRAFT",
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
          currentState: "DRAFT",
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
          currentState: "PUBLISHED",
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
          currentState: "PUBLISHED",
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
          currentState: "PUBLISHED",
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
          currentState: "SCHEDULED",
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
          currentState: "SCHEDULED",
        },
        include: {
          queueType: true,
        },
        orderBy: {
          scheduledAtUtc: "asc",
        },
      });
      expect(result).toEqual(mockPosts);
    });
  });

  // updateLongFormPostStatus was removed - state transitions now use LongFormPostStateMachine
  // Tests for state transitions should be in longform-post-state-machine.integration.test.ts
});
