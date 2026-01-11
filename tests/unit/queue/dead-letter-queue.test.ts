/**
 * Unit tests for Dead Letter Queue
 * Tests app/infra/queue/dead-letter-queue.server.ts
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock dependencies
const { mockPrisma } = vi.hoisted(() => {
  const mockPrisma = {
    deadLetterJob: {
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      delete: vi.fn(),
    },
  };
  return { mockPrisma };
});

vi.mock("~/lib/prisma.server", () => ({
  prisma: mockPrisma,
}));

vi.mock("~/lib/error-logger.server", () => ({
  logError: vi.fn(),
  logWarning: vi.fn(),
  logInfo: vi.fn(),
}));

vi.mock("~/lib/queue-metrics.server", () => ({
  recordDeadLetterJob: vi.fn(),
}));

vi.mock("~/infra/queue/queue-client.server", () => ({
  queueClient: {
    enqueue: vi.fn(),
  },
}));

import {
  createDeadLetterEntry,
  getDeadLetterEntries,
  retryDeadLetterJob,
  deleteDeadLetterEntry,
  getDeadLetterStats,
} from "~/infra/queue/dead-letter-queue.server";
import { queueClient } from "~/infra/queue/queue-client.server";
import type { PostJobData } from "~/infra/queue/queue-types";
import { prisma } from "~/lib/prisma.server";
import { recordDeadLetterJob } from "~/lib/queue-metrics.server";

describe("Dead Letter Queue", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("createDeadLetterEntry", () => {
    it("should create dead letter entry successfully", async () => {
      const jobData: PostJobData = {
        postId: "post-1",
        userId: "user-1",
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any -- Test mock with partial signed event
        signedEvent: { id: "event-1" } as any,
      };

      const error = new Error("Processing failed");
      error.stack = "Error: Processing failed\n    at test.ts:1:1";

      (
        prisma.deadLetterJob.create as ReturnType<typeof vi.fn>
      ).mockResolvedValue({
        id: "dlq-1",
        queueType: "scheduled-posts",
        jobId: "post-1",
        jobName: "publish-post",
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any -- Test mock with job data
        jobData: jobData as any,
        error: "Processing failed",
        errorStack: error.stack,
        attemptsMade: 3,
        correlationId: "corr-1",
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await createDeadLetterEntry(
        "scheduled-posts",
        "post-1",
        "publish-post",
        jobData,
        error,
        3,
        "corr-1"
      );

      expect(prisma.deadLetterJob.create).toHaveBeenCalledWith({
        data: {
          queueType: "scheduled-posts",
          jobId: "post-1",
          jobName: "publish-post",
          jobData: jobData,
          error: "Processing failed",
          errorStack: error.stack,
          attemptsMade: 3,
          correlationId: "corr-1",
        },
      });
      expect(recordDeadLetterJob).toHaveBeenCalledWith(
        "scheduled-posts",
        "Error"
      );
    });

    it("should handle database errors gracefully", async () => {
      const jobData: PostJobData = {
        postId: "post-1",
        userId: "user-1",
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any -- Test mock with partial signed event
        signedEvent: { id: "event-1" } as any,
      };

      const error = new Error("Processing failed");
      const dbError = new Error("Database connection failed");

      (
        prisma.deadLetterJob.create as ReturnType<typeof vi.fn>
      ).mockRejectedValue(dbError);

      // Should not throw
      await expect(
        createDeadLetterEntry(
          "scheduled-posts",
          "post-1",
          "publish-post",
          jobData,
          error,
          3
        )
      ).resolves.not.toThrow();
    });

    it("should handle error without stack trace", async () => {
      const jobData: PostJobData = {
        postId: "post-1",
        userId: "user-1",
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any -- Test mock with partial signed event
        signedEvent: { id: "event-1" } as any,
      };

      const error = new Error("Processing failed");
      delete error.stack;

      (
        prisma.deadLetterJob.create as ReturnType<typeof vi.fn>
      ).mockResolvedValue({});

      await createDeadLetterEntry(
        "scheduled-posts",
        "post-1",
        "publish-post",
        jobData,
        error,
        3
      );

      expect(prisma.deadLetterJob.create).toHaveBeenCalledWith({
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- Jest expect matchers have complex types
        data: expect.objectContaining({
          errorStack: null,
        }),
      });
    });
  });

  describe("getDeadLetterEntries", () => {
    it("should get all dead letter entries", async () => {
      const mockEntries = [
        {
          id: "dlq-1",
          queueType: "scheduled-posts",
          jobId: "post-1",
          jobName: "publish-post",
          jobData: { postId: "post-1" },
          error: "Error 1",
          errorStack: null,
          attemptsMade: 3,
          correlationId: null,
          createdAt: new Date("2024-01-01T10:00:00Z"),
          updatedAt: new Date("2024-01-01T10:00:00Z"),
        },
        {
          id: "dlq-2",
          queueType: "scheduled-posts",
          jobId: "post-2",
          jobName: "publish-post",
          jobData: { postId: "post-2" },
          error: "Error 2",
          errorStack: "Stack trace",
          attemptsMade: 5,
          correlationId: "corr-1",
          createdAt: new Date("2024-01-01T11:00:00Z"),
          updatedAt: new Date("2024-01-01T11:00:00Z"),
        },
      ];

      (
        prisma.deadLetterJob.findMany as ReturnType<typeof vi.fn>
      ).mockResolvedValue(mockEntries);

      const entries = await getDeadLetterEntries();

      expect(entries).toHaveLength(2);
      expect(entries[0]?.id).toBe("dlq-1");
      expect(entries[1]?.id).toBe("dlq-2");
      expect(prisma.deadLetterJob.findMany).toHaveBeenCalledWith({
        where: undefined,
        take: 50,
        orderBy: { createdAt: "desc" },
      });
    });

    it("should filter by queue type", async () => {
      (
        prisma.deadLetterJob.findMany as ReturnType<typeof vi.fn>
      ).mockResolvedValue([]);

      await getDeadLetterEntries("scheduled-posts", 10);

      expect(prisma.deadLetterJob.findMany).toHaveBeenCalledWith({
        where: { queueType: "scheduled-posts" },
        take: 10,
        orderBy: { createdAt: "desc" },
      });
    });

    it("should use default limit if not provided", async () => {
      (
        prisma.deadLetterJob.findMany as ReturnType<typeof vi.fn>
      ).mockResolvedValue([]);

      await getDeadLetterEntries();

      expect(prisma.deadLetterJob.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 50,
        })
      );
    });
  });

  describe("retryDeadLetterJob", () => {
    it("should retry dead letter job successfully", async () => {
      const mockEntry = {
        id: "dlq-1",
        queueType: "scheduled-posts",
        jobId: "post-1",
        jobName: "publish-post",
        jobData: { postId: "post-1", userId: "user-1" },
        error: "Error",
        errorStack: null,
        attemptsMade: 3,
        correlationId: "corr-1",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (
        prisma.deadLetterJob.findUnique as ReturnType<typeof vi.fn>
      ).mockResolvedValue(mockEntry);
      (queueClient.enqueue as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
      });
      (
        prisma.deadLetterJob.delete as ReturnType<typeof vi.fn>
      ).mockResolvedValue(mockEntry);

      const result = await retryDeadLetterJob("dlq-1");

      expect(result.success).toBe(true);
      expect(queueClient.enqueue).toHaveBeenCalledWith(
        "scheduled-posts",
        "publish-post",
        mockEntry.jobData,
        {}
      );
      expect(prisma.deadLetterJob.delete).toHaveBeenCalledWith({
        where: { id: "dlq-1" },
      });
    });

    it("should return error if entry not found", async () => {
      (
        prisma.deadLetterJob.findUnique as ReturnType<typeof vi.fn>
      ).mockResolvedValue(null);

      const result = await retryDeadLetterJob("non-existent");

      expect(result.success).toBe(false);
      expect(result.error).toContain("not found");
    });

    it("should return error if enqueue fails", async () => {
      const mockEntry = {
        id: "dlq-1",
        queueType: "scheduled-posts",
        jobId: "post-1",
        jobName: "publish-post",
        jobData: { postId: "post-1" },
        error: "Error",
        errorStack: null,
        attemptsMade: 3,
        correlationId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (
        prisma.deadLetterJob.findUnique as ReturnType<typeof vi.fn>
      ).mockResolvedValue(mockEntry);
      (queueClient.enqueue as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: false,
        error: "Queue full",
      });

      const result = await retryDeadLetterJob("dlq-1");

      expect(result.success).toBe(false);
      expect(result.error).toBe("Queue full");
      expect(prisma.deadLetterJob.delete).not.toHaveBeenCalled();
    });

    it("should handle errors during retry", async () => {
      const error = new Error("Database error");
      (
        prisma.deadLetterJob.findUnique as ReturnType<typeof vi.fn>
      ).mockRejectedValue(error);

      const result = await retryDeadLetterJob("dlq-1");

      expect(result.success).toBe(false);
      expect(result.error).toBe("Database error");
    });
  });

  describe("deleteDeadLetterEntry", () => {
    it("should delete dead letter entry successfully", async () => {
      (
        prisma.deadLetterJob.delete as ReturnType<typeof vi.fn>
      ).mockResolvedValue({});

      const result = await deleteDeadLetterEntry("dlq-1");

      expect(result.success).toBe(true);
      expect(prisma.deadLetterJob.delete).toHaveBeenCalledWith({
        where: { id: "dlq-1" },
      });
    });

    it("should handle deletion errors", async () => {
      const error = new Error("Database error");
      (
        prisma.deadLetterJob.delete as ReturnType<typeof vi.fn>
      ).mockRejectedValue(error);

      const result = await deleteDeadLetterEntry("dlq-1");

      expect(result.success).toBe(false);
      expect(result.error).toBe("Database error");
    });
  });

  describe("getDeadLetterStats", () => {
    it("should calculate statistics correctly", async () => {
      const mockEntries = [
        {
          queueType: "scheduled-posts",
          error: "Network timeout",
        },
        {
          queueType: "scheduled-posts",
          error: "Network timeout",
        },
        {
          queueType: "scheduled-longform-posts",
          error: "Database error",
        },
        {
          queueType: "scheduled-posts",
          error: "Database error",
        },
      ];

      (
        prisma.deadLetterJob.findMany as ReturnType<typeof vi.fn>
      ).mockResolvedValue(mockEntries);

      const stats = await getDeadLetterStats();

      expect(stats.total).toBe(4);
      expect(stats.byQueueType["scheduled-posts"]).toBe(3);
      expect(stats.byQueueType["scheduled-longform-posts"]).toBe(1);
      expect(stats.recentErrors).toHaveLength(2);
      expect(stats.recentErrors[0]?.error).toBe("Network timeout");
      expect(stats.recentErrors[0]?.count).toBe(2);
    });

    it("should return empty stats when no entries exist", async () => {
      (
        prisma.deadLetterJob.findMany as ReturnType<typeof vi.fn>
      ).mockResolvedValue([]);

      const stats = await getDeadLetterStats();

      expect(stats.total).toBe(0);
      expect(stats.byQueueType).toEqual({});
      expect(stats.recentErrors).toEqual([]);
    });

    it("should limit recent errors to top 10", async () => {
      const mockEntries = Array.from({ length: 15 }, (_, i) => ({
        queueType: "scheduled-posts",
        error: `Error ${i % 5}`, // 5 unique errors, each appearing 3 times
      }));

      (
        prisma.deadLetterJob.findMany as ReturnType<typeof vi.fn>
      ).mockResolvedValue(mockEntries);

      const stats = await getDeadLetterStats();

      expect(stats.recentErrors.length).toBeLessThanOrEqual(10);
    });
  });
});
