/**
 * Integration tests for post query operations
 * Tests app/features/posts/data post queries
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock Prisma
vi.mock("~/lib/prisma.server", () => ({
  prisma: {
    post: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      count: vi.fn(),
    },
    queueType: {
      findFirst: vi.fn(),
    },
    $queryRawUnsafe: vi.fn(),
  },
}));

import { TEST_USER_ID } from "../../utils/test-helpers";

import {
  getPostStatistics,
  getLastPostTimeForQueue,
  getPostsByIds,
  getRecentPublishedPosts,
  getCronDueScheduledPosts,
} from "~/features/posts/server";
import { prisma } from "~/lib/prisma.server";

describe("Post Queries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getPostStatistics", () => {
    it("should return post statistics", async () => {
      (prisma.post.count as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce(5) // scheduledCount
        .mockResolvedValueOnce(10); // successCount

      const result = await getPostStatistics({ userId: TEST_USER_ID });

      expect(prisma.post.count).toHaveBeenCalledTimes(2);
      expect(result).toEqual({
        scheduledCount: 5,
        successCount: 10,
      });
    });

    it("should count scheduled posts correctly", async () => {
      (prisma.post.count as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce(3)
        .mockResolvedValueOnce(7);

      const result = await getPostStatistics({ userId: TEST_USER_ID });

      const firstCall = (prisma.post.count as ReturnType<typeof vi.fn>).mock
        .calls[0]?.[0] as
        | {
            where?: {
              userId?: string;
              currentState?: string;
              queueHoldStatus?: { not: string };
            };
          }
        | undefined;
      expect(firstCall?.where?.userId).toBe(TEST_USER_ID);
      expect(firstCall?.where?.currentState).toBe("SCHEDULED");
      expect(firstCall?.where?.queueHoldStatus).toEqual({
        not: "HELD_BY_QUEUE",
      });
      expect(result.scheduledCount).toBe(3);
    });

    it("should count posted posts correctly", async () => {
      (prisma.post.count as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce(2)
        .mockResolvedValueOnce(8);

      const result = await getPostStatistics({ userId: TEST_USER_ID });

      expect(prisma.post.count).toHaveBeenNthCalledWith(2, {
        where: {
          userId: TEST_USER_ID,
          currentState: "PUBLISHED",
          repost: false,
        },
      });
      expect(result.successCount).toBe(8);
    });
  });

  describe("getLastPostTimeForQueue", () => {
    it("should return last post time for queue by ID", async () => {
      const mockQueueType = {
        id: "queue-123",
        scheduleType: "INTERVAL" as const,
        name: "Test Queue",
      };
      const expectedDate = new Date(1234567890 * 1000);

      (
        prisma.queueType.findFirst as ReturnType<typeof vi.fn>
      ).mockResolvedValue(mockQueueType);
      (prisma.$queryRawUnsafe as ReturnType<typeof vi.fn>).mockResolvedValue([
        { effective_at: expectedDate },
      ]);

      const result = await getLastPostTimeForQueue({
        userId: TEST_USER_ID,
        queueTypeId: "queue-123",
      });

      expect(prisma.queueType.findFirst).toHaveBeenCalledWith({
        where: {
          id: "queue-123",
          userId: TEST_USER_ID,
        },
        select: {
          id: true,
          scheduleType: true,
          name: true,
        },
      });
      expect(prisma.$queryRawUnsafe).toHaveBeenCalled();
      expect(result).toEqual(expectedDate);
    });

    it("should scope raw query to the requested queue type ID", async () => {
      const mockQueueType = {
        id: "queue-123",
        scheduleType: "FIXED_SLOTS" as const,
        name: "Queue A",
      };
      const expectedDate = new Date(1234567890 * 1000);

      (
        prisma.queueType.findFirst as ReturnType<typeof vi.fn>
      ).mockResolvedValue(mockQueueType);
      (prisma.$queryRawUnsafe as ReturnType<typeof vi.fn>).mockResolvedValue([
        { effective_at: expectedDate },
      ]);

      await getLastPostTimeForQueue({
        userId: TEST_USER_ID,
        queueTypeId: "queue-123",
      });

      expect(prisma.$queryRawUnsafe).toHaveBeenCalledTimes(1);
      const rawArgs = (prisma.$queryRawUnsafe as ReturnType<typeof vi.fn>).mock
        .calls[0] as unknown[] | undefined;
      const sql = rawArgs?.[0] as string | undefined;
      const passedUserId = rawArgs?.[1] as string | undefined;
      const passedQueueTypeId = rawArgs?.[2] as string | undefined;

      expect(sql).toContain(`"queueTypeId" = $2`);
      expect(passedUserId).toBe(TEST_USER_ID);
      expect(passedQueueTypeId).toBe("queue-123");
    });

    it("should return last post time for queue by name", async () => {
      const mockQueueType = {
        id: "queue-123",
        scheduleType: "FIXED_SLOTS" as const,
        name: "Test Queue",
      };
      const expectedDate = new Date(1234567890 * 1000);

      (
        prisma.queueType.findFirst as ReturnType<typeof vi.fn>
      ).mockResolvedValue(mockQueueType);
      (prisma.$queryRawUnsafe as ReturnType<typeof vi.fn>).mockResolvedValue([
        { effective_at: expectedDate },
      ]);

      const result = await getLastPostTimeForQueue({
        userId: TEST_USER_ID,
        queueTypeName: "Test Queue",
      });

      expect(prisma.queueType.findFirst).toHaveBeenCalledWith({
        where: {
          userId: TEST_USER_ID,
          name: "Test Queue",
        },
        select: {
          id: true,
          scheduleType: true,
          name: true,
        },
      });
      expect(prisma.$queryRawUnsafe).toHaveBeenCalled();
      expect(result).toEqual(expectedDate);
    });

    it("should return null if queue type doesn't exist", async () => {
      (
        prisma.queueType.findFirst as ReturnType<typeof vi.fn>
      ).mockResolvedValue(null);

      const result = await getLastPostTimeForQueue({
        userId: TEST_USER_ID,
        queueTypeId: "nonexistent",
      });

      expect(result).toBeNull();
      expect(prisma.$queryRawUnsafe).not.toHaveBeenCalled();
    });

    it("should filter by currentState for INTERVAL schedule type", async () => {
      const mockQueueType = {
        id: "queue-123",
        scheduleType: "INTERVAL" as const,
        name: "Test Queue",
      };
      (
        prisma.queueType.findFirst as ReturnType<typeof vi.fn>
      ).mockResolvedValue(mockQueueType);
      (prisma.$queryRawUnsafe as ReturnType<typeof vi.fn>).mockResolvedValue(
        []
      );

      await getLastPostTimeForQueue({
        userId: TEST_USER_ID,
        queueTypeId: "queue-123",
      });

      const rawCall = (prisma.$queryRawUnsafe as ReturnType<typeof vi.fn>).mock
        .calls[0]?.[0] as string | undefined;
      expect(rawCall).toBeDefined();
      expect(rawCall).toContain("SCHEDULED");
      expect(rawCall).not.toContain("PUBLISHED");
      expect(rawCall).toContain(`"dependencyMode" = 'standalone'`);
    });

    it("should include both SCHEDULED and PUBLISHED for FIXED_SLOTS schedule type", async () => {
      const mockQueueType = {
        id: "queue-123",
        scheduleType: "FIXED_SLOTS" as const,
        name: "Test Queue",
      };
      (
        prisma.queueType.findFirst as ReturnType<typeof vi.fn>
      ).mockResolvedValue(mockQueueType);
      (prisma.$queryRawUnsafe as ReturnType<typeof vi.fn>).mockResolvedValue(
        []
      );

      await getLastPostTimeForQueue({
        userId: TEST_USER_ID,
        queueTypeId: "queue-123",
      });

      const rawCall = (prisma.$queryRawUnsafe as ReturnType<typeof vi.fn>).mock
        .calls[0]?.[0] as string | undefined;
      expect(rawCall).toBeDefined();
      expect(rawCall).toContain("SCHEDULED");
      expect(rawCall).toContain("PUBLISHED");
      expect(rawCall).toContain(`"dependencyMode" = 'standalone'`);
    });

    it("should return null if no post found", async () => {
      const mockQueueType = {
        id: "queue-123",
        scheduleType: "INTERVAL" as const,
        name: "Test Queue",
      };
      (
        prisma.queueType.findFirst as ReturnType<typeof vi.fn>
      ).mockResolvedValue(mockQueueType);
      (prisma.$queryRawUnsafe as ReturnType<typeof vi.fn>).mockResolvedValue(
        []
      );

      const result = await getLastPostTimeForQueue({
        userId: TEST_USER_ID,
        queueTypeId: "queue-123",
      });

      expect(result).toBeNull();
    });
  });

  describe("getPostsByIds", () => {
    it("should get posts by IDs", async () => {
      const mockPosts = [
        { id: "post-1", userId: TEST_USER_ID },
        { id: "post-2", userId: TEST_USER_ID },
      ];
      (prisma.post.findMany as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockPosts
      );

      const result = await getPostsByIds({
        ids: ["post-1", "post-2"],
        userId: TEST_USER_ID,
      });

      expect(prisma.post.findMany).toHaveBeenCalledWith({
        where: {
          id: { in: ["post-1", "post-2"] },
          userId: TEST_USER_ID,
        },
        include: {
          queueType: true,
          hashTagPreset: true,
          template: true,
        },
      });
      expect(result).toEqual(mockPosts);
    });

    it("should handle empty IDs array", async () => {
      (prisma.post.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      const result = await getPostsByIds({
        ids: [],
        userId: TEST_USER_ID,
      });

      expect(prisma.post.findMany).toHaveBeenCalledWith({
        where: {
          id: { in: [] },
          userId: TEST_USER_ID,
        },
        include: {
          queueType: true,
          hashTagPreset: true,
          template: true,
        },
      });
      expect(result).toEqual([]);
    });
  });

  describe("getRecentPublishedPosts", () => {
    it("should get recent posted posts", async () => {
      const mockPosts = [
        { id: "post-1", currentState: "PUBLISHED" },
        { id: "post-2", currentState: "PUBLISHED" },
      ];
      (prisma.post.findMany as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockPosts
      );

      const result = await getRecentPublishedPosts({
        userId: TEST_USER_ID,
        days: 7,
      });

      const callArgs = (prisma.post.findMany as ReturnType<typeof vi.fn>).mock
        .calls[0]?.[0] as
        | {
            where?: {
              userId?: string;
              currentState?: string;
              publishedAt?: unknown;
            };
          }
        | undefined;
      expect(callArgs?.where?.userId).toBe(TEST_USER_ID);
      expect(callArgs?.where?.currentState).toBe("PUBLISHED");
      expect(callArgs?.where?.publishedAt).toBeDefined();
      expect(result).toEqual(mockPosts);
    });

    it("should filter by queue type when provided", async () => {
      (prisma.post.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      await getRecentPublishedPosts({
        userId: TEST_USER_ID,
        days: 7,
        queueType: "queue1",
      });

      const callArgs = (prisma.post.findMany as ReturnType<typeof vi.fn>).mock
        .calls[0]?.[0] as
        | { where?: { queueType?: { name?: string } } }
        | undefined;
      expect(callArgs?.where?.queueType).toEqual({ name: "queue1" });
    });
  });

  describe("getCronDueScheduledPosts", () => {
    it("should get posts that are due for posting", async () => {
      const now = Math.floor(Date.now() / 1000);
      const mockPosts = [
        { id: "post-1", scheduledFor: String(now - 100) },
        { id: "post-2", scheduledFor: String(now - 50) },
      ];
      (prisma.post.findMany as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockPosts
      );

      const result = await getCronDueScheduledPosts();

      expect(prisma.post.findMany).toHaveBeenCalledWith({
        where: {
          currentState: "SCHEDULED",
          queueHoldStatus: "NONE",
          OR: [
            { queueTypeId: null },
            { queueType: { status: { not: "PAUSED" } } },
          ],
          scheduledAtUtc: {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- Jest expect matchers have complex types
            lte: expect.any(Date),
          },
        },
      });
      expect(result).toEqual(mockPosts);
    });
  });
});
