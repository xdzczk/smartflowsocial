/**
 * Integration tests for additional longform post queries
 * Tests app/models/longformpost.server.ts query functions
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock Prisma
vi.mock("~/lib/prisma.server", () => ({
  prisma: {
    longFormPost: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      delete: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
  },
}));

import { TEST_USER_ID, TEST_LONGFORM_ID } from "../../utils/test-helpers";

import { prisma } from "~/lib/prisma.server";
import {
  getUserLongFormPosts,
  deleteLongFormPost,
  publishLongFormPost,
  getDraftLongFormPosts,
  getPublishedLongFormPosts,
  getScheduledLongFormPosts,
  getLongFormPostsByIds,
  getCronDueScheduledLongFormPosts,
  updateLongFormPostStatus,
  getPastLongFormPosts,
} from "~/models/longformpost.server";

describe("Longform Post Queries - Extended", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getUserLongFormPosts", () => {
    it("should get user longform posts with pagination", async () => {
      const mockPosts = [
        { id: "longform-1", userId: TEST_USER_ID },
        { id: "longform-2", userId: TEST_USER_ID },
      ];
      (
        prisma.longFormPost.findMany as ReturnType<typeof vi.fn>
      ).mockResolvedValue(mockPosts);
      (prisma.longFormPost.count as ReturnType<typeof vi.fn>).mockResolvedValue(
        10
      );

      const result = await getUserLongFormPosts({
        userId: TEST_USER_ID,
        page: 1,
        limit: 10,
      });

      expect(prisma.longFormPost.findMany).toHaveBeenCalledWith({
        where: { userId: TEST_USER_ID },
        orderBy: { updatedAt: "desc" },
        skip: 0,
        take: 10,
      });
      expect(result.posts).toEqual(mockPosts);
      expect(result.total).toBe(10);
      expect(result.pages).toBe(1);
      expect(result.currentPage).toBe(1);
    });

    it("should filter by isPublished", async () => {
      (
        prisma.longFormPost.findMany as ReturnType<typeof vi.fn>
      ).mockResolvedValue([]);
      (prisma.longFormPost.count as ReturnType<typeof vi.fn>).mockResolvedValue(
        0
      );

      await getUserLongFormPosts({
        userId: TEST_USER_ID,
        isPublished: true,
        page: 1,
        limit: 10,
      });

      expect(prisma.longFormPost.findMany).toHaveBeenCalledWith({
        where: { userId: TEST_USER_ID, isPublished: true },
        orderBy: { updatedAt: "desc" },
        skip: 0,
        take: 10,
      });
    });

    it("should calculate pagination correctly", async () => {
      (
        prisma.longFormPost.findMany as ReturnType<typeof vi.fn>
      ).mockResolvedValue([]);
      (prisma.longFormPost.count as ReturnType<typeof vi.fn>).mockResolvedValue(
        25
      );

      const result = await getUserLongFormPosts({
        userId: TEST_USER_ID,
        page: 2,
        limit: 10,
      });

      expect(result.pages).toBe(3);
      expect(result.currentPage).toBe(2);
    });
  });

  describe("deleteLongFormPost", () => {
    it("should delete a longform post", async () => {
      const mockPost = { id: TEST_LONGFORM_ID, userId: TEST_USER_ID };
      (
        prisma.longFormPost.delete as ReturnType<typeof vi.fn>
      ).mockResolvedValue(mockPost);

      const result = await deleteLongFormPost({
        id: TEST_LONGFORM_ID,
        userId: TEST_USER_ID,
      });

      expect(prisma.longFormPost.delete).toHaveBeenCalledWith({
        where: { id: TEST_LONGFORM_ID, userId: TEST_USER_ID },
      });
      expect(result).toEqual(mockPost);
    });
  });

  describe("publishLongFormPost", () => {
    it("should publish a longform post", async () => {
      const mockPost = { id: TEST_LONGFORM_ID, isPublished: true };
      const signedEvent = {
        id: "event-123",
        pubkey: "pk-123",
        created_at: 1234567890,
        kind: 30023,
        content: "test",
        tags: [],
        sig: "sig-123",
      };
      const nostrEvent = {
        id: "event-123",
        pubkey: "pk-123",
        created_at: 1234567890,
        kind: 30023,
        content: "test",
        tags: [],
      };

      (
        prisma.longFormPost.update as ReturnType<typeof vi.fn>
      ).mockResolvedValue(mockPost);

      const result = await publishLongFormPost({
        id: TEST_LONGFORM_ID,
        userId: TEST_USER_ID,
        signedEvent,
        nostrEvent,
      });

      expect(prisma.longFormPost.update).toHaveBeenCalledWith({
        where: { id: TEST_LONGFORM_ID, userId: TEST_USER_ID },
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- Jest expect matchers have complex types
        data: expect.objectContaining({
          isPublished: true,
          status: "ACTIVE",
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- Jest expect matchers have complex types
          publishedAt: expect.any(Date),
          signedEvent,
          nostrEvent,
          nostrEventId: "event-123",
        }),
      });
      expect(result).toEqual(mockPost);
    });
  });

  describe("getDraftLongFormPosts", () => {
    it("should get draft longform posts", async () => {
      const mockPosts = [
        { id: "longform-1", userId: TEST_USER_ID, draft: true },
      ];
      (
        prisma.longFormPost.findMany as ReturnType<typeof vi.fn>
      ).mockResolvedValue(mockPosts);

      const result = await getDraftLongFormPosts({ userId: TEST_USER_ID });

      expect(prisma.longFormPost.findMany).toHaveBeenCalledWith({
        where: { userId: TEST_USER_ID, isPublished: false, draft: true },
        include: { queueType: true },
        orderBy: { updatedAt: "desc" },
      });
      expect(result).toEqual(mockPosts);
    });
  });

  describe("getPublishedLongFormPosts", () => {
    it("should get published longform posts with pagination", async () => {
      const mockPosts = [
        { id: "longform-1", userId: TEST_USER_ID, isPublished: true },
      ];
      (
        prisma.longFormPost.findMany as ReturnType<typeof vi.fn>
      ).mockResolvedValue(mockPosts);
      (prisma.longFormPost.count as ReturnType<typeof vi.fn>).mockResolvedValue(
        5
      );

      const result = await getPublishedLongFormPosts({
        userId: TEST_USER_ID,
        page: 1,
        limit: 10,
      });

      const callArgs = (
        prisma.longFormPost.findMany as ReturnType<typeof vi.fn>
      ).mock.calls[0]?.[0] as
        | { where?: { userId?: string; isPublished?: boolean } }
        | undefined;
      expect(callArgs?.where?.userId).toBe(TEST_USER_ID);
      expect(callArgs?.where?.isPublished).toBe(true);
      expect(result.posts).toEqual(mockPosts);
      expect(result.pagination.total).toBe(5);
      expect(result.pagination.currentPage).toBe(1);
    });
  });

  describe("getScheduledLongFormPosts", () => {
    it("should get scheduled longform posts", async () => {
      const mockPosts = [
        { id: "longform-1", userId: TEST_USER_ID, isScheduled: true },
      ];
      (
        prisma.longFormPost.findMany as ReturnType<typeof vi.fn>
      ).mockResolvedValue(mockPosts);

      const result = await getScheduledLongFormPosts({ userId: TEST_USER_ID });

      const callArgs = (
        prisma.longFormPost.findMany as ReturnType<typeof vi.fn>
      ).mock.calls[0]?.[0] as
        | { where?: { userId?: string; status?: string } }
        | undefined;
      expect(callArgs?.where?.userId).toBe(TEST_USER_ID);
      expect(callArgs?.where?.status).toBe("SCHEDULED");
      expect(result).toEqual(mockPosts);
    });
  });

  describe("getLongFormPostsByIds", () => {
    it("should get longform posts by IDs", async () => {
      const mockPosts = [
        { id: "longform-1", userId: TEST_USER_ID },
        { id: "longform-2", userId: TEST_USER_ID },
      ];
      (
        prisma.longFormPost.findMany as ReturnType<typeof vi.fn>
      ).mockResolvedValue(mockPosts);

      const result = await getLongFormPostsByIds({
        ids: ["longform-1", "longform-2"],
        userId: TEST_USER_ID,
      });

      const callArgs = (
        prisma.longFormPost.findMany as ReturnType<typeof vi.fn>
      ).mock.calls[0]?.[0] as
        | { where?: { id?: { in?: string[] }; userId?: string } }
        | undefined;
      expect(callArgs?.where?.id?.in).toEqual(["longform-1", "longform-2"]);
      expect(callArgs?.where?.userId).toBe(TEST_USER_ID);
      expect(result).toEqual(mockPosts);
    });
  });

  describe("getCronDueScheduledLongFormPosts", () => {
    it("should get longform posts due for posting", async () => {
      const now = Math.floor(Date.now() / 1000);
      const mockPosts = [{ id: "longform-1", scheduledFor: String(now - 100) }];
      (
        prisma.longFormPost.findMany as ReturnType<typeof vi.fn>
      ).mockResolvedValue(mockPosts);

      const result = await getCronDueScheduledLongFormPosts();

      const callArgs = (
        prisma.longFormPost.findMany as ReturnType<typeof vi.fn>
      ).mock.calls[0]?.[0] as
        | {
            where?: {
              status?: string;
              isScheduled?: boolean;
              isPublished?: boolean;
            };
          }
        | undefined;
      expect(callArgs?.where?.status).toBe("SCHEDULED");
      expect(callArgs?.where?.isScheduled).toBe(true);
      expect(callArgs?.where?.isPublished).toBe(false);
      expect(result).toEqual(mockPosts);
    });
  });

  describe("updateLongFormPostStatus", () => {
    it("should update longform post status to published", async () => {
      const mockPost = {
        id: TEST_LONGFORM_ID,
        status: "ACTIVE",
        isPublished: true,
      };
      (
        prisma.longFormPost.update as ReturnType<typeof vi.fn>
      ).mockResolvedValue(mockPost);

      const result = await updateLongFormPostStatus({
        id: TEST_LONGFORM_ID,
        userId: TEST_USER_ID,
        isPublished: true,
      });

      const callArgs = (prisma.longFormPost.update as ReturnType<typeof vi.fn>)
        .mock.calls[0]?.[0] as
        | {
            where?: { id?: string; userId?: string };
            data?: { isPublished?: boolean; status?: string };
          }
        | undefined;
      expect(callArgs?.where?.id).toBe(TEST_LONGFORM_ID);
      expect(callArgs?.where?.userId).toBe(TEST_USER_ID);
      expect(callArgs?.data?.isPublished).toBe(true);
      expect(callArgs?.data?.status).toBe("ACTIVE");
      expect(result).toEqual(mockPost);
    });

    it("should update longform post status to scheduled", async () => {
      const mockPost = {
        id: TEST_LONGFORM_ID,
        status: "SCHEDULED",
        isPublished: false,
      };
      (
        prisma.longFormPost.update as ReturnType<typeof vi.fn>
      ).mockResolvedValue(mockPost);

      const result = await updateLongFormPostStatus({
        id: TEST_LONGFORM_ID,
        userId: TEST_USER_ID,
        isPublished: false,
      });

      const callArgs = (prisma.longFormPost.update as ReturnType<typeof vi.fn>)
        .mock.calls[0]?.[0] as
        | { data?: { isPublished?: boolean; status?: string } }
        | undefined;
      expect(callArgs?.data?.isPublished).toBe(false);
      expect(callArgs?.data?.status).toBe("SCHEDULED");
      expect(result).toEqual(mockPost);
    });
  });

  describe("getPastLongFormPosts", () => {
    it("should get past longform posts", async () => {
      const startDate = new Date("2024-01-01");
      const endDate = new Date("2024-12-31");
      const mockPosts = [
        { id: "longform-1", userId: TEST_USER_ID, isPublished: true },
      ];
      (
        prisma.longFormPost.findMany as ReturnType<typeof vi.fn>
      ).mockResolvedValue(mockPosts);

      const result = await getPastLongFormPosts({
        userId: TEST_USER_ID,
        startDate,
        endDate,
      });

      const callArgs = (
        prisma.longFormPost.findMany as ReturnType<typeof vi.fn>
      ).mock.calls[0]?.[0] as
        | { where?: { userId?: string; AND?: unknown } }
        | undefined;
      expect(callArgs?.where?.userId).toBe(TEST_USER_ID);
      expect(callArgs?.where?.AND).toBeDefined();
      expect(result).toEqual(mockPosts);
    });

    it("should filter by queue type when provided", async () => {
      const startDate = new Date("2024-01-01");
      const endDate = new Date("2024-12-31");
      (
        prisma.longFormPost.findMany as ReturnType<typeof vi.fn>
      ).mockResolvedValue([]);

      await getPastLongFormPosts({
        userId: TEST_USER_ID,
        startDate,
        endDate,
        queueType: "Queue 1",
      });

      const callArgs = (
        prisma.longFormPost.findMany as ReturnType<typeof vi.fn>
      ).mock.calls[0]?.[0] as
        | { where?: { queueType?: { name?: string } } }
        | undefined;
      expect(callArgs?.where?.queueType).toEqual({ name: "Queue 1" });
    });
  });
});
