/**
 * Integration tests for scheduling algorithms
 * 
 * Tests the core scheduling logic in app/features/posts/schedulers.ts
 * This includes:
 * - INTERVAL-based scheduling (global and queue-specific)
 * - FIXED_SLOTS-based scheduling
 * - Timezone handling
 * - Edge cases and error handling
 */

import type { QueueType } from "@prisma/client";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { calculateNextScheduleTime } from "~/features/posts/schedulers";

import {
  TEST_USER_ID,
  BASE_TIME,
  createQueueType,
  createIntervalQueueType,
  createFixedSlotsQueueType,
  createTestDate,
  createDateAtTime,
} from "../utils/scheduling-test-helpers";

// Mock dependencies
vi.mock("~/models/post.queries.server", () => ({
  getLastPostTimeForQueue: vi.fn(),
}));

vi.mock("~/models/user.server", () => ({
  getScheduleInterval: vi.fn(),
}));

import { getLastPostTimeForQueue } from "~/models/post.queries.server";
import { getScheduleInterval } from "~/models/user.server";

describe("Scheduling Algorithms", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("INTERVAL-based Scheduling", () => {
    describe("Queue-specific Interval", () => {
      it("should schedule next post using queue-specific interval when no last post exists", async () => {
        (getLastPostTimeForQueue as ReturnType<typeof vi.fn>).mockResolvedValue(null);

        const queueType = createIntervalQueueType(6, {
          id: "queue-1",
          name: "posts",
        });

        const result = await calculateNextScheduleTime({
          queueType,
          userId: TEST_USER_ID,
          baseTime: BASE_TIME,
        });

        // When no last post exists, scheduler returns baseTime + 1000ms as fallback
        expect(result.getTime()).toBe(BASE_TIME.getTime() + 1000);
        expect(getLastPostTimeForQueue).toHaveBeenCalledWith({
          userId: TEST_USER_ID,
          queueTypeId: "queue-1",
          queueTypeName: "posts",
        });
      });

      it("should schedule next post by adding interval to last post time", async () => {
        const lastPostTime = createTestDate(-2); // 2 hours before BASE_TIME
        (getLastPostTimeForQueue as ReturnType<typeof vi.fn>).mockResolvedValue(lastPostTime);

        const queueType = createIntervalQueueType(4, {
          id: "queue-1",
          name: "posts",
        });

        const result = await calculateNextScheduleTime({
          queueType,
          userId: TEST_USER_ID,
          baseTime: BASE_TIME,
        });

        const expectedTime = new Date(lastPostTime);
        expectedTime.setHours(expectedTime.getHours() + 4);
        expect(result).toEqual(expectedTime);
      });

      it("should return baseTime if calculated time is in the past", async () => {
        const lastPostTime = createTestDate(-1); // 1 hour ago
        (getLastPostTimeForQueue as ReturnType<typeof vi.fn>).mockResolvedValue(lastPostTime);

        const queueType = createIntervalQueueType(0.5, { // 30 minutes
          id: "queue-1",
          name: "posts",
        });

        const result = await calculateNextScheduleTime({
          queueType,
          userId: TEST_USER_ID,
          baseTime: BASE_TIME,
        });

        // 09:00 + 30 min = 09:30, which is before baseTime (10:00)
        // So should return baseTime
        expect(result.getTime()).toBeGreaterThanOrEqual(BASE_TIME.getTime());
      });

      it("should use default interval of 4 hours when not specified", async () => {
        const lastPostTime = createTestDate(-2); // 2 hours before BASE_TIME
        (getLastPostTimeForQueue as ReturnType<typeof vi.fn>).mockResolvedValue(lastPostTime);

        const queueType = createIntervalQueueType(4, {
          id: "queue-1",
          name: "posts",
          scheduleConfig: {}, // No intervalHours specified - will use default
        });

        const result = await calculateNextScheduleTime({
          queueType,
          userId: TEST_USER_ID,
          baseTime: BASE_TIME,
        });

        const expectedTime = new Date(lastPostTime);
        expectedTime.setHours(expectedTime.getHours() + 4); // Default 4 hours
        expect(result).toEqual(expectedTime);
      });
    });

    describe("Global Interval", () => {
      it("should use global interval when useGlobalInterval is true", async () => {
        const lastPostTime = createTestDate(-2); // 2 hours before BASE_TIME
        (getLastPostTimeForQueue as ReturnType<typeof vi.fn>).mockResolvedValue(lastPostTime);
        (getScheduleInterval as ReturnType<typeof vi.fn>).mockResolvedValue(["2"]); // 2 hours

        const queueType = createIntervalQueueType(4, {
          id: "queue-1",
          name: "posts",
          scheduleConfig: { useGlobalInterval: true },
        });

        const result = await calculateNextScheduleTime({
          queueType,
          userId: TEST_USER_ID,
          baseTime: BASE_TIME,
        });

        expect(getScheduleInterval).toHaveBeenCalledWith(TEST_USER_ID);
        const expectedTime = new Date(lastPostTime);
        expectedTime.setHours(expectedTime.getHours() + 2); // Global interval
        // The function checks if nextTime > now, and if not, returns now
        // BASE_TIME is 2024-01-15T10:00:00Z, lastPostTime is 2 hours before
        // expectedTime would be 2024-01-15T10:00:00Z, which equals BASE_TIME
        // So the function should return BASE_TIME (now)
        expect(result.getTime()).toBe(BASE_TIME.getTime());
      });

      it("should default to 4 hours when global interval is not available", async () => {
        const lastPostTime = createTestDate(-2); // 2 hours before BASE_TIME
        (getLastPostTimeForQueue as ReturnType<typeof vi.fn>).mockResolvedValue(lastPostTime);
        (getScheduleInterval as ReturnType<typeof vi.fn>).mockResolvedValue(null);

        const queueType = createIntervalQueueType(4, {
          id: "queue-1",
          name: "posts",
          scheduleConfig: { useGlobalInterval: true },
        });

        const result = await calculateNextScheduleTime({
          queueType,
          userId: TEST_USER_ID,
          baseTime: BASE_TIME,
        });

        const expectedTime = new Date(lastPostTime);
        expectedTime.setHours(expectedTime.getHours() + 4); // Default 4 hours
        expect(result).toEqual(expectedTime);
      });

      it("should use first interval from scheduleIntervals array", async () => {
        const lastPostTime = createTestDate(-2); // 2 hours before BASE_TIME
        (getLastPostTimeForQueue as ReturnType<typeof vi.fn>).mockResolvedValue(lastPostTime);
        (getScheduleInterval as ReturnType<typeof vi.fn>).mockResolvedValue(["3", "6", "9"]);

        const queueType = createIntervalQueueType(4, {
          id: "queue-1",
          name: "posts",
          scheduleConfig: { useGlobalInterval: true },
        });

        const result = await calculateNextScheduleTime({
          queueType,
          userId: TEST_USER_ID,
          baseTime: BASE_TIME,
        });

        const expectedTime = new Date(lastPostTime);
        expectedTime.setHours(expectedTime.getHours() + 3); // First interval (3 hours)
        // The function checks if nextTime > now, and if not, returns now
        // baseTime is 2024-01-15T10:00:00Z, lastPostTime is 2024-01-15T08:00:00Z
        // expectedTime would be 2024-01-15T11:00:00Z, which is > baseTime
        // So the function should return expectedTime
        expect(result.getTime()).toBe(expectedTime.getTime());
      });
    });
  });

  describe("FIXED_SLOTS-based Scheduling", () => {
    describe("No Previous Posts", () => {
      it("should return next available slot today when no last post exists", async () => {
        (getLastPostTimeForQueue as ReturnType<typeof vi.fn>).mockResolvedValue(null);

        const queueType = createFixedSlotsQueueType(
          [
            { hour: 9, minute: 0 },
            { hour: 12, minute: 0 },
            { hour: 15, minute: 0 },
            { hour: 18, minute: 0 },
          ],
          {
            id: "queue-1",
            name: "posts",
          },
        );

        const result = await calculateNextScheduleTime({
          queueType,
          userId: TEST_USER_ID,
          userTimezone: "UTC",
          baseTime: BASE_TIME, // 10:00 UTC
        });

        // Should return 12:00 (next slot after 10:00)
        expect(result.getUTCHours()).toBe(12);
        expect(result.getUTCMinutes()).toBe(0);
      });

      it("should return first slot tomorrow if all today slots are in the past", async () => {
        (getLastPostTimeForQueue as ReturnType<typeof vi.fn>).mockResolvedValue(null);

        const queueType = createFixedSlotsQueueType(
          ["08:00", "09:00"], // Both in the past
          {
            id: "queue-1",
            name: "posts",
          },
        );

        const result = await calculateNextScheduleTime({
          queueType,
          userId: TEST_USER_ID,
          userTimezone: "UTC",
          baseTime: BASE_TIME, // 10:00 UTC
        });

        // Should return first slot tomorrow
        expect(result.getUTCDate()).toBe(16); // Next day
        expect(result.getUTCHours()).toBe(8);
        expect(result.getUTCMinutes()).toBe(0);
      });

      it("should handle empty slots array by returning baseTime", async () => {
        (getLastPostTimeForQueue as ReturnType<typeof vi.fn>).mockResolvedValue(null);

        const queueType = createFixedSlotsQueueType([], {
          id: "queue-1",
          name: "posts",
        });

        const result = await calculateNextScheduleTime({
          queueType,
          userId: TEST_USER_ID,
          baseTime: BASE_TIME,
        });

        // When empty slots array, scheduler returns baseTime + 1000ms as fallback
        expect(result.getTime()).toBe(BASE_TIME.getTime() + 1000);
      });
    });

    describe("With Previous Posts", () => {
      it("should find next slot after last post time", async () => {
        const lastPostTime = createDateAtTime(2024, 1, 15, 12, 0);
        (getLastPostTimeForQueue as ReturnType<typeof vi.fn>).mockResolvedValue(lastPostTime);

        const queueType = createFixedSlotsQueueType(
          ["09:00", "12:00", "15:00", "18:00"],
          {
            id: "queue-1",
            name: "posts",
          },
        );

        const result = await calculateNextScheduleTime({
          queueType,
          userId: TEST_USER_ID,
          userTimezone: "UTC",
          baseTime: BASE_TIME, // 10:00 UTC
        });

        // Should return 15:00 (next slot after 12:00)
        expect(result.getUTCHours()).toBe(15);
        expect(result.getUTCMinutes()).toBe(0);
      });

      it("should find next slot on next day if all slots today are in the past", async () => {
        const lastPostTime = createDateAtTime(2024, 1, 15, 18, 0);
        (getLastPostTimeForQueue as ReturnType<typeof vi.fn>).mockResolvedValue(lastPostTime);

        const queueType = createFixedSlotsQueueType(
          ["09:00", "12:00", "15:00", "18:00"],
          {
            id: "queue-1",
            name: "posts",
          },
        );

        const result = await calculateNextScheduleTime({
          queueType,
          userId: TEST_USER_ID,
          userTimezone: "UTC",
          baseTime: createDateAtTime(2024, 1, 15, 20, 0), // After all slots
        });

        // Should return first slot tomorrow
        expect(result.getUTCDate()).toBe(16);
        expect(result.getUTCHours()).toBe(9);
        expect(result.getUTCMinutes()).toBe(0);
      });

      it("should handle slots sorted correctly", async () => {
        const lastPostTime = createDateAtTime(2024, 1, 15, 10, 0);
        (getLastPostTimeForQueue as ReturnType<typeof vi.fn>).mockResolvedValue(lastPostTime);

        const queueType = createFixedSlotsQueueType(
          ["18:00", "09:00", "15:00", "12:00"], // Unsorted
          {
            id: "queue-1",
            name: "posts",
          },
        );

        const result = await calculateNextScheduleTime({
          queueType,
          userId: TEST_USER_ID,
          userTimezone: "UTC",
          baseTime: BASE_TIME,
        });

        // Should return 12:00 (next chronological slot after 10:00)
        expect(result.getUTCHours()).toBe(12);
        expect(result.getUTCMinutes()).toBe(0);
      });
    });
  });

  describe("Timezone Handling", () => {
    it("should handle UTC timezone correctly", async () => {
      (getLastPostTimeForQueue as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const queueType = createFixedSlotsQueueType(
        ["14:00"],
        {
          id: "queue-1",
          name: "posts",
        },
      );

      const result = await calculateNextScheduleTime({
        queueType,
        userId: TEST_USER_ID,
        userTimezone: "UTC",
        baseTime: BASE_TIME,
      });

      expect(result.getUTCHours()).toBe(14);
      expect(result.getUTCMinutes()).toBe(0);
    });

    it("should convert slots to user timezone (America/New_York)", async () => {
      (getLastPostTimeForQueue as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const queueType = createFixedSlotsQueueType(
        ["09:00"],
        {
          id: "queue-1",
          name: "posts",
        },
      );

      // January 15, 2024 - New York is in EST (UTC-5)
      const result = await calculateNextScheduleTime({
        queueType,
        userId: TEST_USER_ID,
        userTimezone: "America/New_York",
        baseTime: createDateAtTime(2024, 1, 15, 10, 0), // 5:00 AM EST
      });

      // 09:00 EST should be 14:00 UTC
      expect(result.getUTCHours()).toBe(14);
      expect(result.getUTCMinutes()).toBe(0);
    });

    it("should handle Etc/GMT timezone same as UTC", async () => {
      (getLastPostTimeForQueue as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const queueType = createFixedSlotsQueueType(
        ["12:00"],
        {
          id: "queue-1",
          name: "posts",
        },
      );

      const result = await calculateNextScheduleTime({
        queueType,
        userId: TEST_USER_ID,
        userTimezone: "Etc/GMT",
        baseTime: BASE_TIME,
      });

      expect(result.getUTCHours()).toBe(12);
      expect(result.getUTCMinutes()).toBe(0);
    });
  });

  describe("Edge Cases", () => {
    it("should handle invalid scheduleType by returning baseTime", async () => {
      (getLastPostTimeForQueue as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const queueType = createQueueType({
        id: "queue-1",
        name: "posts",
        scheduleType: "INVALID" as any,
        scheduleConfig: {},
      });

      const result = await calculateNextScheduleTime({
        queueType,
        userId: TEST_USER_ID,
        baseTime: BASE_TIME,
      });

      // When invalid scheduleType, scheduler returns baseTime + 1000ms as fallback
      expect(result.getTime()).toBe(BASE_TIME.getTime() + 1000);
    });

    it("should handle missing scheduleConfig", async () => {
      (getLastPostTimeForQueue as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const queueType = createIntervalQueueType(4, {
        id: "queue-1",
        name: "posts",
        scheduleConfig: null as any,
      });

      const result = await calculateNextScheduleTime({
        queueType,
        userId: TEST_USER_ID,
        baseTime: BASE_TIME,
      });

      // Should fallback to default behavior
      expect(result).toBeDefined();
      expect(result).toBeInstanceOf(Date);
      expect(!isNaN(result.getTime())).toBe(true);
      expect(result.getTime()).toBeGreaterThan(0);
    });

    it("should handle database errors gracefully", async () => {
      (getLastPostTimeForQueue as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error("Database error"),
      );

      const queueType = createIntervalQueueType(4, {
        id: "queue-1",
        name: "posts",
      });

      // Function should handle errors gracefully and return baseTime
      const result = await calculateNextScheduleTime({
        queueType,
        userId: TEST_USER_ID,
        baseTime: BASE_TIME,
      });

      // Should return baseTime + 1000ms when database error occurs (fallback ensures future time)
      expect(result.getTime()).toBe(BASE_TIME.getTime() + 1000);
    });
  });

  describe("Complex Scenarios", () => {
    it("should handle multiple slots with last post in the middle", async () => {
      const lastPostTime = createDateAtTime(2024, 1, 15, 13, 0);
      (getLastPostTimeForQueue as ReturnType<typeof vi.fn>).mockResolvedValue(lastPostTime);

      const queueType = createFixedSlotsQueueType(
        ["08:00", "10:00", "12:00", "14:00", "16:00", "18:00"],
        {
          id: "queue-1",
          name: "posts",
        },
      );

      const result = await calculateNextScheduleTime({
        queueType,
        userId: TEST_USER_ID,
        userTimezone: "UTC",
        baseTime: createDateAtTime(2024, 1, 15, 13, 30),
      });

      // Should return 14:00 (next slot after 13:00)
      expect(result.getUTCHours()).toBe(14);
      expect(result.getUTCMinutes()).toBe(0);
    });

    it("should handle interval scheduling with large intervals", async () => {
      const lastPostTime = createTestDate(-2); // 2 hours before BASE_TIME
      (getLastPostTimeForQueue as ReturnType<typeof vi.fn>).mockResolvedValue(lastPostTime);

      const queueType = createIntervalQueueType(24, { // Daily
        id: "queue-1",
        name: "posts",
      });

      const result = await calculateNextScheduleTime({
        queueType,
        userId: TEST_USER_ID,
        baseTime: BASE_TIME,
      });

      const expectedTime = new Date(lastPostTime);
      expectedTime.setHours(expectedTime.getHours() + 24);
      expect(result).toEqual(expectedTime);
    });
  });
});

