/**
 * Integration tests for Post model functions
 * 
 * Tests the database operations in app/models/post.server.ts
 * Uses mocked Prisma to test business logic without requiring a real database.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createPost,
  deletePost,
  updatePost,
  getScheduledPosts,
  getPostedPosts,
  getPostById,
  getPostStatistics,
  updatePostStatus,
} from "~/models/post.server";

// Mock Prisma - use vi.hoisted to allow top-level variables in mocks
const { mockPrisma } = vi.hoisted(() => {
  const mockPrisma = {
    post: {
      create: vi.fn(),
      delete: vi.fn(),
      update: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      count: vi.fn(),
    },
    queueType: {
      findFirst: vi.fn(),
    },
    longFormPost: {
      findFirst: vi.fn(),
    },
  };
  return { mockPrisma };
});

vi.mock("~/lib/prisma.server", () => ({
  prisma: mockPrisma,
}));

import { TEST_USER_ID, TEST_POST_ID, TEST_QUEUE_TYPE_ID } from "../utils/test-helpers";

describe("Post Model Functions", () => {

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("createPost", () => {
    it("should create a post with all fields", async () => {
      const postData = {
        userId: TEST_USER_ID,
        content: "Test content",
        caption: "Test caption",
        fileUrl: ["https://example.com/image.jpg"],
        postType: "IMAGE" as const,
        tags: ["tag1", "tag2"],
        isScheduled: true,
        isPosted: false,
        queueTypeId: TEST_QUEUE_TYPE_ID,
      };

      const mockPost = {
        id: TEST_POST_ID,
        ...postData,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrisma.post.create.mockResolvedValue(mockPost);

      const result = await createPost(postData);

      expect(mockPrisma.post.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          content: "Test content",
          caption: "Test caption",
          fileUrl: ["https://example.com/image.jpg"],
          postType: "IMAGE",
          tags: ["tag1", "tag2"],
          isScheduled: true,
          isPosted: false,
          queueType: {
            connect: {
              id: TEST_QUEUE_TYPE_ID,
            },
          },
        }),
      });
      expect(result).toEqual(mockPost);
    });

    it("should create a post with queueTypeId directly (preferred pattern)", async () => {
      const postData = {
        userId: TEST_USER_ID,
        content: "Test content",
        postType: "TEXT" as const,
        tags: [],
        isScheduled: false,
        isPosted: false,
        queueTypeId: TEST_QUEUE_TYPE_ID,
      };

      const mockPost = {
        id: TEST_POST_ID,
        ...postData,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrisma.post.create.mockResolvedValue(mockPost);

      const result = await createPost(postData);

      // Should NOT call queueType.findFirst when queueTypeId is provided
      expect(mockPrisma.queueType.findFirst).not.toHaveBeenCalled();
      
      expect(mockPrisma.post.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          content: "Test content",
          postType: "TEXT",
          isScheduled: false,
          isPosted: false,
          queueType: {
            connect: {
              id: TEST_QUEUE_TYPE_ID,
            },
          },
        }),
      });
      expect(result).toEqual(mockPost);
    });

    it("should not connect queue type when queueTypeId is null", async () => {
      const postData = {
        userId: TEST_USER_ID,
        content: "Test content",
        postType: "TEXT" as const,
        tags: [],
        isScheduled: false,
        isPosted: false,
        queueTypeId: null,
      };

      const mockPost = {
        id: TEST_POST_ID,
        ...postData,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrisma.post.create.mockResolvedValue(mockPost);

      const result = await createPost(postData);

      // Should NOT call queueType.findFirst when queueTypeId is null
      expect(mockPrisma.queueType.findFirst).not.toHaveBeenCalled();
      expect(mockPrisma.post.create).toHaveBeenCalledWith({
        data: expect.not.objectContaining({
          queueType: expect.anything(),
        }),
      });
    });

    it("should convert scheduledFor to string", async () => {
      const scheduledDate = new Date("2024-01-15T10:00:00Z");
      const postData = {
        userId: TEST_USER_ID,
        content: "Test content",
        postType: "TEXT" as const,
        tags: [],
        isScheduled: true,
        isPosted: false,
        scheduledFor: scheduledDate,
      };

      mockPrisma.post.create.mockResolvedValue({
        id: TEST_POST_ID,
        ...postData,
      });

      await createPost(postData);

      expect(mockPrisma.post.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          scheduledFor: scheduledDate.toString(),
        }),
      });
    });

    it("should handle draft posts", async () => {
      const postData = {
        userId: TEST_USER_ID,
        content: "Draft content",
        postType: "TEXT" as const,
        tags: [],
        isScheduled: false,
        isPosted: false,
        draft: true,
      };

      mockPrisma.post.create.mockResolvedValue({
        id: TEST_POST_ID,
        ...postData,
      });

      const result = await createPost(postData);

      expect(mockPrisma.post.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          draft: true,
        }),
      });
      expect(result).toBeDefined();
    });
  });

  describe("deletePost", () => {
    it("should delete a post by id and userId", async () => {
      const mockPost = {
        id: TEST_POST_ID,
        userId: TEST_USER_ID,
        content: "Test content",
      };

      mockPrisma.post.delete.mockResolvedValue(mockPost);

      const result = await deletePost({
        id: TEST_POST_ID,
        userId: TEST_USER_ID,
      });

      expect(mockPrisma.post.delete).toHaveBeenCalledWith({
        where: {
          id: TEST_POST_ID,
          userId: TEST_USER_ID,
        },
      });
      expect(result).toEqual(mockPost);
    });
  });

  describe("updatePost", () => {
    it("should update a post with new data", async () => {
      const updateData = {
        content: "Updated content",
        caption: "Updated caption",
        isScheduled: true,
      };

      const mockUpdatedPost = {
        id: TEST_POST_ID,
        userId: TEST_USER_ID,
        ...updateData,
      };

      mockPrisma.post.update.mockResolvedValue(mockUpdatedPost);

      const result = await updatePost({
        id: TEST_POST_ID,
        userId: TEST_USER_ID,
        data: updateData,
      });

      expect(mockPrisma.post.update).toHaveBeenCalledWith({
        where: {
          id: TEST_POST_ID,
          userId: TEST_USER_ID,
        },
        data: expect.objectContaining({
          content: "Updated content",
          caption: "Updated caption",
          isScheduled: true,
          updatedAt: expect.any(Date),
        }),
      });
      expect(result).toEqual(mockUpdatedPost);
    });
  });

  describe("getScheduledPosts", () => {
    it("should get scheduled posts for a user", async () => {
      const mockPosts = [
        {
          id: "post-1",
          userId: TEST_USER_ID,
          isScheduled: true,
          isPosted: false,
          queueType: { name: "posts" },
        },
        {
          id: "post-2",
          userId: TEST_USER_ID,
          isScheduled: true,
          isPosted: false,
          queueType: { name: "posts" },
        },
      ];

      mockPrisma.post.findMany.mockResolvedValue(mockPosts);

      const result = await getScheduledPosts({
        userId: TEST_USER_ID,
        queueType: "posts",
      });

      expect(mockPrisma.post.findMany).toHaveBeenCalledWith({
        where: expect.objectContaining({
          userId: TEST_USER_ID,
          isScheduled: true,
          isPosted: false,
          draft: false,
          queueType: {
            name: "posts",
          },
        }),
        include: {
          queueType: true,
          hashTagPreset: true,
          template: true,
        },
        orderBy: {
          scheduledFor: "asc",
        },
      });
      expect(result).toEqual(mockPosts);
    });

    it("should get all scheduled posts when queueType is 'all'", async () => {
      const mockPosts = [
        {
          id: "post-1",
          userId: TEST_USER_ID,
          isScheduled: true,
          isPosted: false,
          queueType: { name: "posts" },
        },
      ];

      mockPrisma.post.findMany.mockResolvedValue(mockPosts);

      const result = await getScheduledPosts({
        userId: TEST_USER_ID,
        queueType: "all",
      });

      expect(mockPrisma.post.findMany).toHaveBeenCalledWith({
        where: expect.objectContaining({
          userId: TEST_USER_ID,
          isScheduled: true,
          isPosted: false,
          draft: false,
        }),
        include: {
          queueType: true,
          hashTagPreset: true,
          template: true,
        },
        orderBy: {
          scheduledFor: "asc",
        },
      });
      expect(result).toEqual(mockPosts);
    });
  });

  describe("getPostedPosts", () => {
    it("should get posted posts with pagination", async () => {
      const mockPosts = [
        {
          id: "post-1",
          userId: TEST_USER_ID,
          isPosted: true,
          postedAt: new Date(),
          queueType: { name: "posts" },
        },
      ];

      mockPrisma.post.findMany.mockResolvedValue(mockPosts);
      mockPrisma.post.count.mockResolvedValue(1);

      const result = await getPostedPosts({
        userId: TEST_USER_ID,
        page: 1,
        limit: 50,
        queueType: "posts",
      });

      expect(mockPrisma.post.findMany).toHaveBeenCalledWith({
        where: expect.objectContaining({
          userId: TEST_USER_ID,
          isPosted: true,
          queueType: {
            name: "posts",
          },
        }),
        include: {
          queueType: true,
        },
        orderBy: {
          postedAt: "desc",
        },
        skip: 0,
        take: 50,
      });
      expect(result).toEqual({
        posts: mockPosts,
        pagination: {
          total: 1,
          pages: 1,
          currentPage: 1,
          limit: 50,
        },
      });
    });

    it("should handle pagination correctly", async () => {
      mockPrisma.post.findMany.mockResolvedValue([]);
      mockPrisma.post.count.mockResolvedValue(100);

      const result = await getPostedPosts({
        userId: TEST_USER_ID,
        page: 2,
        limit: 25,
      });

      expect(mockPrisma.post.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 25,
          take: 25,
        }),
      );
      expect(result.pagination).toEqual({
        total: 100,
        pages: 4,
        currentPage: 2,
        limit: 25,
      });
    });
  });

  describe("getPostById", () => {
    it("should get a post by id", async () => {
      const mockPost = {
        id: TEST_POST_ID,
        userId: TEST_USER_ID,
        content: "Test content",
        queueType: { name: "posts" },
      };

      mockPrisma.post.findFirst.mockResolvedValue(mockPost);

      const result = await getPostById({
        id: TEST_POST_ID,
        userId: TEST_USER_ID,
      });

      expect(mockPrisma.post.findFirst).toHaveBeenCalledWith({
        include: {
          queueType: true,
          hashTagPreset: true,
          template: true,
        },
        where: {
          id: TEST_POST_ID,
          userId: TEST_USER_ID,
        },
      });
      expect(result).toEqual(mockPost);
    });
  });

  describe("updatePostStatus", () => {
    it("should update post status to posted", async () => {
      const mockUpdatedPost = {
        id: TEST_POST_ID,
        userId: TEST_USER_ID,
        isPosted: true,
        postedAt: new Date(),
      };

      mockPrisma.post.update.mockResolvedValue(mockUpdatedPost);

      const result = await updatePostStatus({
        id: TEST_POST_ID,
        userId: TEST_USER_ID,
        isPosted: true,
      });

      expect(mockPrisma.post.update).toHaveBeenCalledWith({
        where: {
          id: TEST_POST_ID,
          userId: TEST_USER_ID,
        },
        data: {
          isPosted: true,
          postedAt: expect.any(Date),
        },
      });
      expect(result).toEqual(mockUpdatedPost);
    });
  });

  describe("getPostStatistics", () => {
    it("should get post statistics for a user", async () => {
      mockPrisma.post.count
        .mockResolvedValueOnce(10) // scheduledCount
        .mockResolvedValueOnce(5); // successCount

      const result = await getPostStatistics({ userId: TEST_USER_ID });

      expect(mockPrisma.post.count).toHaveBeenCalledTimes(2);
      expect(result).toEqual({
        scheduledCount: 10,
        successCount: 5,
      });
    });
  });
});

