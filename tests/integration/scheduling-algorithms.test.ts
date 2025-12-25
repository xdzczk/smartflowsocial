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

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { QueueType } from "@prisma/client";
import { calculateNextScheduleTime } from "~/features/posts/schedulers";

// Mock dependencies
vi.mock("~/models/post.server", () => ({
  getLastPostTimeForQueue: vi.fn(),
}));

vi.mock("~/models/user.server", () => ({
  getScheduleInterval: vi.fn(),
}));

import { getLastPostTimeForQueue } from "~/models/post.server";
import { getScheduleInterval } from "~/models/user.server";

describe("Scheduling Algorithms", () => {
  const TEST_USER_ID = "user-123";
  const baseTime = new Date("2024-01-15T10:00:00Z"); // Monday, Jan 15, 2024, 10:00 UTC

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("INTERVAL-based Scheduling", () => {
    describe("Queue-specific Interval", () => {
      it("should schedule next post using queue-specific interval when no last post exists", async () => {
        (getLastPostTimeForQueue as ReturnType<typeof vi.fn>).mockResolvedValue(null);

        const queueType: QueueType = {
          id: "queue-1",
          name: "posts",
          scheduleType: "INTERVAL",
          scheduleConfig: { intervalHours: 6 },
          userId: TEST_USER_ID,
          isEnabled: true,
          createdAt: new Date(),
          updatedAt: new Date(),
          color: null,
          description: null,
          hashTagPresetId: null,
        };

        const result = await calculateNextScheduleTime({
          queueType,
          userId: TEST_USER_ID,
          baseTime,
        });

        expect(result).toEqual(baseTime);
        expect(getLastPostTimeForQueue).toHaveBeenCalledWith({
          userId: TEST_USER_ID,
          queueTypeId: "queue-1",
          queueTypeName: "posts",
        });
      });

      it("should schedule next post by adding interval to last post time", async () => {
        const lastPostTime = new Date("2024-01-15T08:00:00Z");
        (getLastPostTimeForQueue as ReturnType<typeof vi.fn>).mockResolvedValue(lastPostTime);

        const queueType: QueueType = {
          id: "queue-1",
          name: "posts",
          scheduleType: "INTERVAL",
          scheduleConfig: { intervalHours: 4 },
          userId: TEST_USER_ID,
          isEnabled: true,
          createdAt: new Date(),
          updatedAt: new Date(),
          color: null,
          description: null,
          hashTagPresetId: null,
        };

        const result = await calculateNextScheduleTime({
          queueType,
          userId: TEST_USER_ID,
          baseTime,
        });

        const expectedTime = new Date(lastPostTime);
        expectedTime.setHours(expectedTime.getHours() + 4);
        expect(result).toEqual(expectedTime);
      });

      it("should return baseTime if calculated time is in the past", async () => {
        const lastPostTime = new Date("2024-01-15T09:00:00Z"); // 1 hour ago
        (getLastPostTimeForQueue as ReturnType<typeof vi.fn>).mockResolvedValue(lastPostTime);

        const queueType: QueueType = {
          id: "queue-1",
          name: "posts",
          scheduleType: "INTERVAL",
          scheduleConfig: { intervalHours: 0.5 }, // 30 minutes
          userId: TEST_USER_ID,
          isEnabled: true,
          createdAt: new Date(),
          updatedAt: new Date(),
          color: null,
          description: null,
          hashTagPresetId: null,
        };

        const result = await calculateNextScheduleTime({
          queueType,
          userId: TEST_USER_ID,
          baseTime,
        });

        // 09:00 + 30 min = 09:30, which is before baseTime (10:00)
        // So should return baseTime
        expect(result.getTime()).toBeGreaterThanOrEqual(baseTime.getTime());
      });

      it("should use default interval of 4 hours when not specified", async () => {
        const lastPostTime = new Date("2024-01-15T08:00:00Z");
        (getLastPostTimeForQueue as ReturnType<typeof vi.fn>).mockResolvedValue(lastPostTime);

        const queueType: QueueType = {
          id: "queue-1",
          name: "posts",
          scheduleType: "INTERVAL",
          scheduleConfig: {}, // No intervalHours specified
          userId: TEST_USER_ID,
          isEnabled: true,
          createdAt: new Date(),
          updatedAt: new Date(),
          color: null,
          description: null,
          hashTagPresetId: null,
        };

        const result = await calculateNextScheduleTime({
          queueType,
          userId: TEST_USER_ID,
          baseTime,
        });

        const expectedTime = new Date(lastPostTime);
        expectedTime.setHours(expectedTime.getHours() + 4); // Default 4 hours
        expect(result).toEqual(expectedTime);
      });
    });

    describe("Global Interval", () => {
      it("should use global interval when useGlobalInterval is true", async () => {
        const lastPostTime = new Date("2024-01-15T08:00:00Z");
        (getLastPostTimeForQueue as ReturnType<typeof vi.fn>).mockResolvedValue(lastPostTime);
        (getScheduleInterval as ReturnType<typeof vi.fn>).mockResolvedValue(["2"]); // 2 hours

        const queueType: QueueType = {
          id: "queue-1",
          name: "posts",
          scheduleType: "INTERVAL",
          scheduleConfig: { useGlobalInterval: true },
          userId: TEST_USER_ID,
          isEnabled: true,
          createdAt: new Date(),
          updatedAt: new Date(),
          color: null,
          description: null,
          hashTagPresetId: null,
        };

        const result = await calculateNextScheduleTime({
          queueType,
          userId: TEST_USER_ID,
          baseTime,
        });

        expect(getScheduleInterval).toHaveBeenCalledWith(TEST_USER_ID);
        const expectedTime = new Date(lastPostTime);
        expectedTime.setHours(expectedTime.getHours() + 2); // Global interval
        expect(result).toEqual(expectedTime);
      });

      it("should default to 4 hours when global interval is not available", async () => {
        const lastPostTime = new Date("2024-01-15T08:00:00Z");
        (getLastPostTimeForQueue as ReturnType<typeof vi.fn>).mockResolvedValue(lastPostTime);
        (getScheduleInterval as ReturnType<typeof vi.fn>).mockResolvedValue(null);

        const queueType: QueueType = {
          id: "queue-1",
          name: "posts",
          scheduleType: "INTERVAL",
          scheduleConfig: { useGlobalInterval: true },
          userId: TEST_USER_ID,
          isEnabled: true,
          createdAt: new Date(),
          updatedAt: new Date(),
          color: null,
          description: null,
          hashTagPresetId: null,
        };

        const result = await calculateNextScheduleTime({
          queueType,
          userId: TEST_USER_ID,
          baseTime,
        });

        const expectedTime = new Date(lastPostTime);
        expectedTime.setHours(expectedTime.getHours() + 4); // Default 4 hours
        expect(result).toEqual(expectedTime);
      });

      it("should use first interval from scheduleIntervals array", async () => {
        const lastPostTime = new Date("2024-01-15T08:00:00Z");
        (getLastPostTimeForQueue as ReturnType<typeof vi.fn>).mockResolvedValue(lastPostTime);
        (getScheduleInterval as ReturnType<typeof vi.fn>).mockResolvedValue(["3", "6", "9"]);

        const queueType: QueueType = {
          id: "queue-1",
          name: "posts",
          scheduleType: "INTERVAL",
          scheduleConfig: { useGlobalInterval: true },
          userId: TEST_USER_ID,
          isEnabled: true,
          createdAt: new Date(),
          updatedAt: new Date(),
          color: null,
          description: null,
          hashTagPresetId: null,
        };

        const result = await calculateNextScheduleTime({
          queueType,
          userId: TEST_USER_ID,
          baseTime,
        });

        const expectedTime = new Date(lastPostTime);
        expectedTime.setHours(expectedTime.getHours() + 3); // First interval (3 hours)
        expect(result).toEqual(expectedTime);
      });
    });
  });

  describe("FIXED_SLOTS-based Scheduling", () => {
    describe("No Previous Posts", () => {
      it("should return next available slot today when no last post exists", async () => {
        (getLastPostTimeForQueue as ReturnType<typeof vi.fn>).mockResolvedValue(null);

        const queueType: QueueType = {
          id: "queue-1",
          name: "posts",
          scheduleType: "FIXED_SLOTS",
          scheduleConfig: { slots: ["09:00", "12:00", "15:00", "18:00"] },
          userId: TEST_USER_ID,
          isEnabled: true,
          createdAt: new Date(),
          updatedAt: new Date(),
          color: null,
          description: null,
          hashTagPresetId: null,
        };

        const result = await calculateNextScheduleTime({
          queueType,
          userId: TEST_USER_ID,
          userTimezone: "UTC",
          baseTime, // 10:00 UTC
        });

        // Should return 12:00 (next slot after 10:00)
        expect(result.getUTCHours()).toBe(12);
        expect(result.getUTCMinutes()).toBe(0);
      });

      it("should return first slot tomorrow if all today slots are in the past", async () => {
        (getLastPostTimeForQueue as ReturnType<typeof vi.fn>).mockResolvedValue(null);

        const queueType: QueueType = {
          id: "queue-1",
          name: "posts",
          scheduleType: "FIXED_SLOTS",
          scheduleConfig: { slots: ["08:00", "09:00"] }, // Both in the past
          userId: TEST_USER_ID,
          isEnabled: true,
          createdAt: new Date(),
          updatedAt: new Date(),
          color: null,
          description: null,
          hashTagPresetId: null,
        };

        const result = await calculateNextScheduleTime({
          queueType,
          userId: TEST_USER_ID,
          userTimezone: "UTC",
          baseTime, // 10:00 UTC
        });

        // Should return first slot tomorrow
        expect(result.getUTCDate()).toBe(16); // Next day
        expect(result.getUTCHours()).toBe(8);
        expect(result.getUTCMinutes()).toBe(0);
      });

      it("should handle empty slots array by returning baseTime", async () => {
        (getLastPostTimeForQueue as ReturnType<typeof vi.fn>).mockResolvedValue(null);

        const queueType: QueueType = {
          id: "queue-1",
          name: "posts",
          scheduleType: "FIXED_SLOTS",
          scheduleConfig: { slots: [] },
          userId: TEST_USER_ID,
          isEnabled: true,
          createdAt: new Date(),
          updatedAt: new Date(),
          color: null,
          description: null,
          hashTagPresetId: null,
        };

        const result = await calculateNextScheduleTime({
          queueType,
          userId: TEST_USER_ID,
          baseTime,
        });

        expect(result).toEqual(baseTime);
      });
    });

    describe("With Previous Posts", () => {
      it("should find next slot after last post time", async () => {
        const lastPostTime = new Date("2024-01-15T12:00:00Z");
        (getLastPostTimeForQueue as ReturnType<typeof vi.fn>).mockResolvedValue(lastPostTime);

        const queueType: QueueType = {
          id: "queue-1",
          name: "posts",
          scheduleType: "FIXED_SLOTS",
          scheduleConfig: { slots: ["09:00", "12:00", "15:00", "18:00"] },
          userId: TEST_USER_ID,
          isEnabled: true,
          createdAt: new Date(),
          updatedAt: new Date(),
          color: null,
          description: null,
          hashTagPresetId: null,
        };

        const result = await calculateNextScheduleTime({
          queueType,
          userId: TEST_USER_ID,
          userTimezone: "UTC",
          baseTime, // 10:00 UTC
        });

        // Should return 15:00 (next slot after 12:00)
        expect(result.getUTCHours()).toBe(15);
        expect(result.getUTCMinutes()).toBe(0);
      });

      it("should find next slot on next day if all slots today are in the past", async () => {
        const lastPostTime = new Date("2024-01-15T18:00:00Z");
        (getLastPostTimeForQueue as ReturnType<typeof vi.fn>).mockResolvedValue(lastPostTime);

        const queueType: QueueType = {
          id: "queue-1",
          name: "posts",
          scheduleType: "FIXED_SLOTS",
          scheduleConfig: { slots: ["09:00", "12:00", "15:00", "18:00"] },
          userId: TEST_USER_ID,
          isEnabled: true,
          createdAt: new Date(),
          updatedAt: new Date(),
          color: null,
          description: null,
          hashTagPresetId: null,
        };

        const result = await calculateNextScheduleTime({
          queueType,
          userId: TEST_USER_ID,
          userTimezone: "UTC",
          baseTime: new Date("2024-01-15T20:00:00Z"), // After all slots
        });

        // Should return first slot tomorrow
        expect(result.getUTCDate()).toBe(16);
        expect(result.getUTCHours()).toBe(9);
        expect(result.getUTCMinutes()).toBe(0);
      });

      it("should handle slots sorted correctly", async () => {
        const lastPostTime = new Date("2024-01-15T10:00:00Z");
        (getLastPostTimeForQueue as ReturnType<typeof vi.fn>).mockResolvedValue(lastPostTime);

        const queueType: QueueType = {
          id: "queue-1",
          name: "posts",
          scheduleType: "FIXED_SLOTS",
          scheduleConfig: { slots: ["18:00", "09:00", "15:00", "12:00"] }, // Unsorted
          userId: TEST_USER_ID,
          isEnabled: true,
          createdAt: new Date(),
          updatedAt: new Date(),
          color: null,
          description: null,
          hashTagPresetId: null,
        };

        const result = await calculateNextScheduleTime({
          queueType,
          userId: TEST_USER_ID,
          userTimezone: "UTC",
          baseTime,
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

      const queueType: QueueType = {
        id: "queue-1",
        name: "posts",
        scheduleType: "FIXED_SLOTS",
        scheduleConfig: { slots: ["14:00"] },
        userId: TEST_USER_ID,
        isEnabled: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        color: null,
        description: null,
        hashTagPresetId: null,
      };

      const result = await calculateNextScheduleTime({
        queueType,
        userId: TEST_USER_ID,
        userTimezone: "UTC",
        baseTime,
      });

      expect(result.getUTCHours()).toBe(14);
      expect(result.getUTCMinutes()).toBe(0);
    });

    it("should convert slots to user timezone (America/New_York)", async () => {
      (getLastPostTimeForQueue as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const queueType: QueueType = {
        id: "queue-1",
        name: "posts",
        scheduleType: "FIXED_SLOTS",
        scheduleConfig: { slots: ["09:00"] },
        userId: TEST_USER_ID,
        isEnabled: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        color: null,
        description: null,
        hashTagPresetId: null,
      };

      // January 15, 2024 - New York is in EST (UTC-5)
      const result = await calculateNextScheduleTime({
        queueType,
        userId: TEST_USER_ID,
        userTimezone: "America/New_York",
        baseTime: new Date("2024-01-15T10:00:00Z"), // 5:00 AM EST
      });

      // 09:00 EST should be 14:00 UTC
      expect(result.getUTCHours()).toBe(14);
      expect(result.getUTCMinutes()).toBe(0);
    });

    it("should handle Etc/GMT timezone same as UTC", async () => {
      (getLastPostTimeForQueue as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const queueType: QueueType = {
        id: "queue-1",
        name: "posts",
        scheduleType: "FIXED_SLOTS",
        scheduleConfig: { slots: ["12:00"] },
        userId: TEST_USER_ID,
        isEnabled: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        color: null,
        description: null,
        hashTagPresetId: null,
      };

      const result = await calculateNextScheduleTime({
        queueType,
        userId: TEST_USER_ID,
        userTimezone: "Etc/GMT",
        baseTime,
      });

      expect(result.getUTCHours()).toBe(12);
      expect(result.getUTCMinutes()).toBe(0);
    });
  });

  describe("Edge Cases", () => {
    it("should handle invalid scheduleType by returning baseTime", async () => {
      (getLastPostTimeForQueue as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const queueType: QueueType = {
        id: "queue-1",
        name: "posts",
        scheduleType: "INVALID" as any,
        scheduleConfig: {},
        userId: TEST_USER_ID,
        isEnabled: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        color: null,
        description: null,
        hashTagPresetId: null,
      };

      const result = await calculateNextScheduleTime({
        queueType,
        userId: TEST_USER_ID,
        baseTime,
      });

      expect(result).toEqual(baseTime);
    });

    it("should handle missing scheduleConfig", async () => {
      (getLastPostTimeForQueue as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const queueType: QueueType = {
        id: "queue-1",
        name: "posts",
        scheduleType: "INTERVAL",
        scheduleConfig: null as any,
        userId: TEST_USER_ID,
        isEnabled: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        color: null,
        description: null,
        hashTagPresetId: null,
      };

      const result = await calculateNextScheduleTime({
        queueType,
        userId: TEST_USER_ID,
        baseTime,
      });

      // Should fallback to default behavior
      expect(result).toBeDefined();
    });

    it("should handle database errors gracefully", async () => {
      (getLastPostTimeForQueue as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error("Database error"),
      );

      const queueType: QueueType = {
        id: "queue-1",
        name: "posts",
        scheduleType: "INTERVAL",
        scheduleConfig: { intervalHours: 4 },
        userId: TEST_USER_ID,
        isEnabled: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        color: null,
        description: null,
        hashTagPresetId: null,
      };

      await expect(
        calculateNextScheduleTime({
          queueType,
          userId: TEST_USER_ID,
          baseTime,
        }),
      ).rejects.toThrow("Database error");
    });
  });

  describe("Complex Scenarios", () => {
    it("should handle multiple slots with last post in the middle", async () => {
      const lastPostTime = new Date("2024-01-15T13:00:00Z");
      (getLastPostTimeForQueue as ReturnType<typeof vi.fn>).mockResolvedValue(lastPostTime);

      const queueType: QueueType = {
        id: "queue-1",
        name: "posts",
        scheduleType: "FIXED_SLOTS",
        scheduleConfig: { slots: ["08:00", "10:00", "12:00", "14:00", "16:00", "18:00"] },
        userId: TEST_USER_ID,
        isEnabled: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        color: null,
        description: null,
        hashTagPresetId: null,
      };

      const result = await calculateNextScheduleTime({
        queueType,
        userId: TEST_USER_ID,
        userTimezone: "UTC",
        baseTime: new Date("2024-01-15T13:30:00Z"),
      });

      // Should return 14:00 (next slot after 13:00)
      expect(result.getUTCHours()).toBe(14);
      expect(result.getUTCMinutes()).toBe(0);
    });

    it("should handle interval scheduling with large intervals", async () => {
      const lastPostTime = new Date("2024-01-15T08:00:00Z");
      (getLastPostTimeForQueue as ReturnType<typeof vi.fn>).mockResolvedValue(lastPostTime);

      const queueType: QueueType = {
        id: "queue-1",
        name: "posts",
        scheduleType: "INTERVAL",
        scheduleConfig: { intervalHours: 24 }, // Daily
        userId: TEST_USER_ID,
        isEnabled: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        color: null,
        description: null,
        hashTagPresetId: null,
      };

      const result = await calculateNextScheduleTime({
        queueType,
        userId: TEST_USER_ID,
        baseTime,
      });

      const expectedTime = new Date(lastPostTime);
      expectedTime.setHours(expectedTime.getHours() + 24);
      expect(result).toEqual(expectedTime);
    });
  });
});

