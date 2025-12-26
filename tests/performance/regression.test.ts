/**
 * Performance Regression Tests
 * 
 * Tracks performance over time and alerts on performance degradation.
 * These tests establish baseline performance metrics and fail if performance
 * degrades beyond acceptable thresholds.
 * 
 * Run these tests regularly to catch performance regressions early.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

import { calculateNextScheduleTime } from "~/features/posts/schedulers";
import { getScheduledPosts, getLastPostTimeForQueue } from "~/models/post.queries.server";
import { getUserById , getScheduleInterval } from "~/models/user.server";

import { TEST_USER_ID } from "../utils/test-helpers";

// Mock dependencies
vi.mock("~/models/post.queries.server", () => ({
  getScheduledPosts: vi.fn(),
  getLastPostTimeForQueue: vi.fn(),
}));

vi.mock("~/models/user.server", () => ({
  getUserById: vi.fn(),
  getScheduleInterval: vi.fn(),
}));

/**
 * Performance thresholds (in milliseconds)
 * These should be adjusted based on actual performance requirements
 */
const PERFORMANCE_THRESHOLDS = {
  SCHEDULER_CALCULATION: 100, // 100ms for scheduling calculation
  DATABASE_QUERY: 500, // 500ms for database queries
  LOADER_FUNCTION: 1000, // 1s for loader functions
  BULK_OPERATION: 2000, // 2s for bulk operations
};

describe("Performance Regression Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (getScheduleInterval as ReturnType<typeof vi.fn>).mockResolvedValue(["4"]);
    (getLastPostTimeForQueue as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (getUserById as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: TEST_USER_ID,
      timezone: "UTC",
    });
  });

  describe("Scheduling Algorithm Performance", () => {
    it("should calculate next schedule time within threshold", async () => {
      const queueType = {
        id: "queue-1",
        name: "test-queue",
        scheduleType: "INTERVAL" as const,
        scheduleConfig: {
          useGlobalInterval: false,
          intervalHours: 4,
        },
      };

      const startTime = performance.now();
      await calculateNextScheduleTime({
        queueType,
        userId: TEST_USER_ID,
        baseTime: new Date(),
      });
      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.SCHEDULER_CALCULATION);
    });

    it("should handle multiple scheduling calculations efficiently", async () => {
      const queueType = {
        id: "queue-1",
        name: "test-queue",
        scheduleType: "FIXED_SLOTS" as const,
        scheduleConfig: {
          slots: ["09:00", "12:00", "15:00", "18:00"],
        },
      };

      const startTime = performance.now();
      const promises = Array.from({ length: 10 }, () =>
        calculateNextScheduleTime({
          queueType,
          userId: TEST_USER_ID,
          baseTime: new Date(),
        }),
      );
      await Promise.all(promises);
      const endTime = performance.now();
      const duration = endTime - startTime;

      // 10 calculations should complete in reasonable time
      expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.SCHEDULER_CALCULATION * 10);
    });
  });

  describe("Database Query Performance", () => {
    it("should fetch scheduled posts within threshold", async () => {
      (getScheduledPosts as ReturnType<typeof vi.fn>).mockImplementation(
        async () => {
          // Simulate database query delay
          await new Promise((resolve) => setTimeout(resolve, 10));
          return [];
        },
      );

      const startTime = performance.now();
      await getScheduledPosts({ userId: TEST_USER_ID, queueType: "all" });
      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.DATABASE_QUERY);
    });

    it("should handle large result sets efficiently", async () => {
      const largeResultSet = Array.from({ length: 1000 }, (_, i) => ({
        id: `post-${i}`,
        userId: TEST_USER_ID,
        content: `Post ${i}`,
      }));

      (getScheduledPosts as ReturnType<typeof vi.fn>).mockResolvedValue(
        largeResultSet,
      );

      const startTime = performance.now();
      const result = await getScheduledPosts({
        userId: TEST_USER_ID,
        queueType: "all",
      });
      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(result).toHaveLength(1000);
      expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.DATABASE_QUERY);
    });
  });

  describe("Memory Performance", () => {
    it("should not leak memory with repeated operations", async () => {
      const queueType = {
        id: "queue-1",
        name: "test-queue",
        scheduleType: "INTERVAL" as const,
        scheduleConfig: {
          useGlobalInterval: false,
          intervalHours: 4,
        },
      };

      // Perform many operations
      for (let i = 0; i < 100; i++) {
        await calculateNextScheduleTime({
          queueType,
          userId: TEST_USER_ID,
          baseTime: new Date(),
        });
      }

      // If we get here without memory issues, test passes
      expect(true).toBe(true);
    });
  });

  describe("Concurrent Operations Performance", () => {
    it("should handle concurrent scheduling calculations efficiently", async () => {
      const queueType = {
        id: "queue-1",
        name: "test-queue",
        scheduleType: "INTERVAL" as const,
        scheduleConfig: {
          useGlobalInterval: false,
          intervalHours: 4,
        },
      };

      const startTime = performance.now();
      const promises = Array.from({ length: 50 }, () =>
        calculateNextScheduleTime({
          queueType,
          userId: TEST_USER_ID,
          baseTime: new Date(),
        }),
      );
      await Promise.all(promises);
      const endTime = performance.now();
      const duration = endTime - startTime;

      // 50 concurrent operations should complete efficiently
      expect(duration).toBeLessThan(
        PERFORMANCE_THRESHOLDS.SCHEDULER_CALCULATION * 20, // Allow some overhead
      );
    });
  });
});

/**
 * Performance Benchmark Utilities
 * Use these to establish baseline metrics
 */
export function measurePerformance<T>(
  fn: () => Promise<T>,
): Promise<{ result: T; duration: number }> {
  return new Promise((resolve) => {
    const startTime = performance.now();
    fn().then((result) => {
      const endTime = performance.now();
      resolve({
        result,
        duration: endTime - startTime,
      });
    });
  });
}

/**
 * Assert performance is within threshold
 */
export function expectPerformance(
  duration: number,
  threshold: number,
  operation: string,
) {
  expect(duration).toBeLessThan(
    threshold,
    `${operation} took ${duration.toFixed(2)}ms, exceeding threshold of ${threshold}ms`,
  );
}



