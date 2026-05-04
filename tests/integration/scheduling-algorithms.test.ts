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

import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock dependencies
vi.mock("~/features/posts/server", () => ({
  getLastPostTimeForQueue: vi.fn(),
}));

vi.mock("~/features/user", () => ({
  getScheduleInterval: vi.fn(),
}));

// Import after vi.mock() for dynamic import pattern
import {
  TEST_USER_ID,
  BASE_TIME,
  createQueueType,
  createIntervalQueueType,
  createFixedSlotsQueueType,
  createWeeklySlotsQueueType,
  createTestDate,
  createDateAtTime,
} from "../utils/scheduling-test-helpers";

import { getLastPostTimeForQueue } from "~/features/posts/server";
import { calculateNextScheduleTime } from "~/features/posts/server/scheduling";
import { getScheduleInterval } from "~/features/user";

describe("Scheduling Algorithms", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("INTERVAL-based Scheduling", () => {
    describe("Queue-specific Interval", () => {
      it("should schedule next post using queue-specific interval when no last post exists", async () => {
        (getLastPostTimeForQueue as ReturnType<typeof vi.fn>).mockResolvedValue(
          null
        );

        const queueType = createIntervalQueueType(6, {
          id: "queue-1",
          name: "posts",
        });

        const result = await calculateNextScheduleTime({
          queueType,
          userId: TEST_USER_ID,
          baseTime: BASE_TIME,
        });

        // For interval queues, first slot defaults to baseTime + 15 minutes
        expect(result.getTime()).toBe(BASE_TIME.getTime() + 15 * 60 * 1000);
        expect(getLastPostTimeForQueue).toHaveBeenCalledWith({
          userId: TEST_USER_ID,
          queueTypeId: "queue-1",
          queueTypeName: "posts",
        });
      });

      it("should schedule next post by adding interval to last post time", async () => {
        const lastPostTime = createTestDate(-2); // 2 hours before BASE_TIME
        (getLastPostTimeForQueue as ReturnType<typeof vi.fn>).mockResolvedValue(
          lastPostTime
        );

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

      it("should preserve cadence and jump to next valid slot after long idle period", async () => {
        // Queue cadence anchored at 2024-01-10 10:00 UTC with 12h interval.
        // Base time is 2024-01-15 10:00 UTC, so next valid slot must be 2024-01-15 22:00 UTC.
        const lastPostTime = createDateAtTime(2024, 1, 10, 10, 0);
        (getLastPostTimeForQueue as ReturnType<typeof vi.fn>).mockResolvedValue(
          lastPostTime
        );

        const queueType = createIntervalQueueType(12, {
          id: "queue-1",
          name: "posts",
        });

        const result = await calculateNextScheduleTime({
          queueType,
          userId: TEST_USER_ID,
          baseTime: BASE_TIME, // 2024-01-15 10:00 UTC
        });

        expect(result.getUTCHours()).toBe(22);
        expect(result.getUTCMinutes()).toBe(0);
        expect(result.getTime()).toBeGreaterThan(BASE_TIME.getTime());
      });

      it("should return a slot strictly after baseTime when cadence lands exactly on baseTime", async () => {
        const lastPostTime = createDateAtTime(2024, 1, 15, 8, 0);
        (getLastPostTimeForQueue as ReturnType<typeof vi.fn>).mockResolvedValue(
          lastPostTime
        );

        const queueType = createIntervalQueueType(2, {
          id: "queue-1",
          name: "posts",
        });

        const result = await calculateNextScheduleTime({
          queueType,
          userId: TEST_USER_ID,
          baseTime: BASE_TIME, // 10:00 UTC
        });

        // Next cadence slots are 10:00 then 12:00; must choose strictly-after slot.
        expect(result.getUTCHours()).toBe(12);
        expect(result.getUTCMinutes()).toBe(0);
      });

      it("should return baseTime if calculated time is in the past", async () => {
        const lastPostTime = createTestDate(-1); // 1 hour ago
        (getLastPostTimeForQueue as ReturnType<typeof vi.fn>).mockResolvedValue(
          lastPostTime
        );

        const queueType = createIntervalQueueType(0.5, {
          // 30 minutes
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
        (getLastPostTimeForQueue as ReturnType<typeof vi.fn>).mockResolvedValue(
          lastPostTime
        );

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

      it("should schedule next post 15 minutes later when interval is 0.25 hours", async () => {
        const lastPostTime = createDateAtTime(2024, 1, 15, 9, 45); // 09:45 UTC
        (getLastPostTimeForQueue as ReturnType<typeof vi.fn>).mockResolvedValue(
          lastPostTime
        );

        const queueType = createIntervalQueueType(0.25, {
          id: "queue-1",
          name: "posts",
        });

        const result = await calculateNextScheduleTime({
          queueType,
          userId: TEST_USER_ID,
          baseTime: BASE_TIME, // 10:00 UTC
        });

        // 09:45 + 15 min lands at "now", so interval fallback shifts first slot to now+15.
        expect(result.getUTCHours()).toBe(10);
        expect(result.getUTCMinutes()).toBe(15);
        expect(result.getTime()).toBe(BASE_TIME.getTime() + 15 * 60 * 1000);
      });
    });

    describe("Global Interval", () => {
      it("should use global interval when useGlobalInterval is true", async () => {
        const lastPostTime = createTestDate(-2); // 2 hours before BASE_TIME
        (getLastPostTimeForQueue as ReturnType<typeof vi.fn>).mockResolvedValue(
          lastPostTime
        );
        (getScheduleInterval as ReturnType<typeof vi.fn>).mockResolvedValue([
          "2",
        ]); // 2 hours

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
        // lastPost + 2h lands exactly on baseTime, so cadence must advance to the next slot.
        expect(result.getTime()).toBe(BASE_TIME.getTime() + 2 * 60 * 60 * 1000);
      });

      it("should default to 4 hours when global interval is not available", async () => {
        const lastPostTime = createTestDate(-2); // 2 hours before BASE_TIME
        (getLastPostTimeForQueue as ReturnType<typeof vi.fn>).mockResolvedValue(
          lastPostTime
        );
        (getScheduleInterval as ReturnType<typeof vi.fn>).mockResolvedValue(
          null
        );

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
        (getLastPostTimeForQueue as ReturnType<typeof vi.fn>).mockResolvedValue(
          lastPostTime
        );
        (getScheduleInterval as ReturnType<typeof vi.fn>).mockResolvedValue([
          "3",
          "6",
          "9",
        ]);

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

      it("should use fractional global interval (0.25 = 15 min)", async () => {
        const lastPostTime = createDateAtTime(2024, 1, 15, 9, 50); // 09:50 UTC
        (getLastPostTimeForQueue as ReturnType<typeof vi.fn>).mockResolvedValue(
          lastPostTime
        );
        (getScheduleInterval as ReturnType<typeof vi.fn>).mockResolvedValue([
          "0.25",
        ]);

        const queueType = createIntervalQueueType(4, {
          id: "queue-1",
          name: "posts",
          scheduleConfig: { useGlobalInterval: true },
        });

        const result = await calculateNextScheduleTime({
          queueType,
          userId: TEST_USER_ID,
          baseTime: BASE_TIME, // 10:00 UTC
        });

        // 09:50 + 15 min = 10:05 UTC
        expect(result.getUTCHours()).toBe(10);
        expect(result.getUTCMinutes()).toBe(5);
        expect(result.getTime()).toBe(lastPostTime.getTime() + 15 * 60 * 1000);
      });
    });
  });

  describe("FIXED_SLOTS-based Scheduling", () => {
    describe("No Previous Posts", () => {
      it("should return next available slot today when no last post exists", async () => {
        (getLastPostTimeForQueue as ReturnType<typeof vi.fn>).mockResolvedValue(
          null
        );

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
          }
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
        (getLastPostTimeForQueue as ReturnType<typeof vi.fn>).mockResolvedValue(
          null
        );

        const queueType = createFixedSlotsQueueType(
          ["08:00", "09:00"], // Both in the past
          {
            id: "queue-1",
            name: "posts",
          }
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
        (getLastPostTimeForQueue as ReturnType<typeof vi.fn>).mockResolvedValue(
          null
        );

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
        (getLastPostTimeForQueue as ReturnType<typeof vi.fn>).mockResolvedValue(
          lastPostTime
        );

        const queueType = createFixedSlotsQueueType(
          ["09:00", "12:00", "15:00", "18:00"],
          {
            id: "queue-1",
            name: "posts",
          }
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
        (getLastPostTimeForQueue as ReturnType<typeof vi.fn>).mockResolvedValue(
          lastPostTime
        );

        const queueType = createFixedSlotsQueueType(
          ["09:00", "12:00", "15:00", "18:00"],
          {
            id: "queue-1",
            name: "posts",
          }
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
        (getLastPostTimeForQueue as ReturnType<typeof vi.fn>).mockResolvedValue(
          lastPostTime
        );

        const queueType = createFixedSlotsQueueType(
          ["18:00", "09:00", "15:00", "12:00"], // Unsorted
          {
            id: "queue-1",
            name: "posts",
          }
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
      (getLastPostTimeForQueue as ReturnType<typeof vi.fn>).mockResolvedValue(
        null
      );

      const queueType = createFixedSlotsQueueType(["14:00"], {
        id: "queue-1",
        name: "posts",
      });

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
      (getLastPostTimeForQueue as ReturnType<typeof vi.fn>).mockResolvedValue(
        null
      );

      const queueType = createFixedSlotsQueueType(["09:00"], {
        id: "queue-1",
        name: "posts",
      });

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
      (getLastPostTimeForQueue as ReturnType<typeof vi.fn>).mockResolvedValue(
        null
      );

      const queueType = createFixedSlotsQueueType(["12:00"], {
        id: "queue-1",
        name: "posts",
      });

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

  describe("WEEKLY_SLOTS-based Scheduling", () => {
    it("should schedule next post at next matching day and time (Monday 12:00 UTC)", async () => {
      (getLastPostTimeForQueue as ReturnType<typeof vi.fn>).mockResolvedValue(
        null
      );

      // BASE_TIME is Monday Jan 15, 2024 10:00 UTC; next Monday 12:00 is same day 12:00 UTC
      const queueType = createWeeklySlotsQueueType(
        [{ dayOfWeek: 1, time: "12:00" }],
        { id: "queue-1", name: "posts" }
      );

      const result = await calculateNextScheduleTime({
        queueType,
        userId: TEST_USER_ID,
        userTimezone: "UTC",
        baseTime: BASE_TIME,
      });

      expect(result.getUTCDay()).toBe(1); // Monday
      expect(result.getUTCHours()).toBe(12);
      expect(result.getUTCMinutes()).toBe(0);
    });

    it("should schedule next post at Thursday 19:45 when base is Monday", async () => {
      (getLastPostTimeForQueue as ReturnType<typeof vi.fn>).mockResolvedValue(
        null
      );

      // BASE_TIME is Monday Jan 15, 2024 10:00 UTC; Thursday = dayOfWeek 4
      const queueType = createWeeklySlotsQueueType(
        [{ dayOfWeek: 4, time: "19:45" }],
        { id: "queue-1", name: "posts" }
      );

      const result = await calculateNextScheduleTime({
        queueType,
        userId: TEST_USER_ID,
        userTimezone: "UTC",
        baseTime: BASE_TIME,
      });

      expect(result.getUTCDay()).toBe(4); // Thursday
      expect(result.getUTCHours()).toBe(19);
      expect(result.getUTCMinutes()).toBe(45);
    });

    it("should return next slot after last post when last post exists", async () => {
      const lastPostTime = createDateAtTime(2024, 1, 15, 12, 0); // Monday 12:00 UTC
      (getLastPostTimeForQueue as ReturnType<typeof vi.fn>).mockResolvedValue(
        lastPostTime
      );

      const queueType = createWeeklySlotsQueueType(
        [
          { dayOfWeek: 1, time: "09:00" },
          { dayOfWeek: 1, time: "12:00" },
          { dayOfWeek: 4, time: "19:45" },
        ],
        { id: "queue-1", name: "posts" }
      );

      const result = await calculateNextScheduleTime({
        queueType,
        userId: TEST_USER_ID,
        userTimezone: "UTC",
        baseTime: BASE_TIME,
      });

      // Next slot after Monday 12:00 is Thursday 19:45
      expect(result.getUTCDay()).toBe(4);
      expect(result.getUTCHours()).toBe(19);
      expect(result.getUTCMinutes()).toBe(45);
    });

    it("should return the following week's slot when last post already consumed this week's occurrence (single weekday)", async () => {
      const lastPostTime = createDateAtTime(2024, 1, 17, 9, 0); // Wed Jan 17 09:00 UTC
      (getLastPostTimeForQueue as ReturnType<typeof vi.fn>).mockResolvedValue(
        lastPostTime
      );

      const queueType = createWeeklySlotsQueueType(
        [{ dayOfWeek: 3, time: "09:00" }],
        { id: "queue-1", name: "posts" }
      );

      const result = await calculateNextScheduleTime({
        queueType,
        userId: TEST_USER_ID,
        userTimezone: "UTC",
        baseTime: BASE_TIME,
      });

      expect(result.getUTCFullYear()).toBe(2024);
      expect(result.getUTCMonth()).toBe(0);
      expect(result.getUTCDate()).toBe(24);
      expect(result.getUTCDay()).toBe(3);
      expect(result.getUTCHours()).toBe(9);
      expect(result.getUTCMinutes()).toBe(0);
    });

    it("should ignore duplicate weekly slot entries", async () => {
      const lastPostTime = createDateAtTime(2024, 1, 15, 12, 0); // Monday 12:00 UTC
      (getLastPostTimeForQueue as ReturnType<typeof vi.fn>).mockResolvedValue(
        lastPostTime
      );

      const queueType = createWeeklySlotsQueueType(
        [
          { dayOfWeek: 4, time: "19:45" },
          { dayOfWeek: 4, time: "19:45" }, // duplicate config row
          { dayOfWeek: 1, time: "09:00" },
        ],
        { id: "queue-1", name: "posts" }
      );

      const result = await calculateNextScheduleTime({
        queueType,
        userId: TEST_USER_ID,
        userTimezone: "UTC",
        baseTime: BASE_TIME,
      });

      // Without dedupe this could repeatedly return the same slot for successive posts.
      // With dedupe the next slot after Monday 12:00 is Thursday 19:45.
      expect(result.getUTCDay()).toBe(4);
      expect(result.getUTCHours()).toBe(19);
      expect(result.getUTCMinutes()).toBe(45);
    });
  });

  describe("Edge Cases", () => {
    it("should handle invalid scheduleType by returning baseTime", async () => {
      (getLastPostTimeForQueue as ReturnType<typeof vi.fn>).mockResolvedValue(
        null
      );

      const queueType = createQueueType({
        id: "queue-1",
        name: "posts",
        // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment -- Testing edge case with invalid scheduleType
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
      (getLastPostTimeForQueue as ReturnType<typeof vi.fn>).mockResolvedValue(
        null
      );

      const queueType = createIntervalQueueType(4, {
        id: "queue-1",
        name: "posts",
        // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment -- Testing edge case with null scheduleConfig
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
        new Error("Database error")
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

      // For interval queues, DB fallback still uses "first slot = now + 15 minutes".
      expect(result.getTime()).toBe(BASE_TIME.getTime() + 15 * 60 * 1000);
    });

    it("should return default future time when queueType has no scheduleType", async () => {
      (getLastPostTimeForQueue as ReturnType<typeof vi.fn>).mockResolvedValue(
        null
      );

      const queueType = {
        id: "queue-1",
        name: "posts",
      };

      const result = await calculateNextScheduleTime({
        // Minimal queueType without scheduleType to hit invalid-queueType path
        queueType: queueType as Parameters<
          typeof calculateNextScheduleTime
        >[0]["queueType"],
        userId: TEST_USER_ID,
        baseTime: BASE_TIME,
      });

      expect(result).toBeInstanceOf(Date);
      expect(result.getTime()).toBe(BASE_TIME.getTime() + 1000);
    });

    it("should return valid date when baseTime is invalid (fallback to now)", async () => {
      (getLastPostTimeForQueue as ReturnType<typeof vi.fn>).mockResolvedValue(
        null
      );

      const queueType = createIntervalQueueType(4, {
        id: "queue-1",
        name: "posts",
      });

      const result = await calculateNextScheduleTime({
        queueType,
        userId: TEST_USER_ID,
        baseTime: new Date("invalid") as unknown as Date,
      });

      expect(result).toBeInstanceOf(Date);
      expect(!isNaN(result.getTime())).toBe(true);
    });
  });

  describe("Complex Scenarios", () => {
    it("should handle multiple slots with last post in the middle", async () => {
      const lastPostTime = createDateAtTime(2024, 1, 15, 13, 0);
      (getLastPostTimeForQueue as ReturnType<typeof vi.fn>).mockResolvedValue(
        lastPostTime
      );

      const queueType = createFixedSlotsQueueType(
        ["08:00", "10:00", "12:00", "14:00", "16:00", "18:00"],
        {
          id: "queue-1",
          name: "posts",
        }
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
      (getLastPostTimeForQueue as ReturnType<typeof vi.fn>).mockResolvedValue(
        lastPostTime
      );

      const queueType = createIntervalQueueType(24, {
        // Daily
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
