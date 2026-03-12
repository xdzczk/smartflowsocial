/**
 * Scheduler Torture Tests
 * Tests edge cases that ChatGPT identified as critical:
 * - DST transitions (Europe/Riga will bite you)
 * - "now + interval is still in the past" classes of bugs
 * - Concurrency: two schedulers running simultaneously (duplicate publish risk)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

import { TEST_USER_ID } from "../utils/test-helpers";

import { getLastPostTimeForQueue } from "~/features/posts/server";
import { calculateNextScheduleTime } from "~/features/posts/server/scheduling";
import { getScheduleInterval } from "~/features/user";

// Mock dependencies
vi.mock("~/features/posts/server", () => ({
  getLastPostTimeForQueue: vi.fn(),
}));

vi.mock("~/features/user", () => ({
  getScheduleInterval: vi.fn(),
}));

describe("Scheduler Torture Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (getScheduleInterval as ReturnType<typeof vi.fn>).mockResolvedValue(["4"]);
  });

  describe("DST (Daylight Saving Time) Transitions", () => {
    // Europe/Riga has DST transitions that can cause issues
    const timezone = "Europe/Riga";

    it("should handle spring DST transition (clock jumps forward)", async () => {
      // Spring 2024 DST transition in Europe/Riga: March 31, 2024 3:00 AM -> 4:00 AM
      // The hour from 3:00 to 4:00 doesn't exist
      const baseTime = new Date("2024-03-31T02:00:00.000Z"); // 1 hour before transition

      const queueType = {
        id: "queue-1",
        name: "test-queue",
        scheduleType: "FIXED_SLOTS" as const,
        scheduleConfig: {
          slots: ["03:30"], // Slot in the "missing" hour
        },
      };

      (getLastPostTimeForQueue as ReturnType<typeof vi.fn>).mockResolvedValue(
        null
      );

      const result = await calculateNextScheduleTime({
        queueType,
        userId: TEST_USER_ID,
        userTimezone: timezone,
        baseTime,
      });

      expect(result).toBeInstanceOf(Date);
      expect(!isNaN(result.getTime())).toBe(true);
      // Should return a valid future date, not crash
      expect(result.getTime()).toBeGreaterThan(baseTime.getTime());
    });

    it("should handle fall DST transition (clock jumps backward)", async () => {
      // Fall 2024 DST transition in Europe/Riga: October 27, 2024 3:00 AM -> 2:00 AM
      // The hour from 2:00 to 3:00 happens twice
      const baseTime = new Date("2024-10-27T01:00:00.000Z"); // 1 hour before transition

      const queueType = {
        id: "queue-1",
        name: "test-queue",
        scheduleType: "FIXED_SLOTS" as const,
        scheduleConfig: {
          slots: ["02:30"], // Slot in the "duplicate" hour
        },
      };

      (getLastPostTimeForQueue as ReturnType<typeof vi.fn>).mockResolvedValue(
        null
      );

      const result = await calculateNextScheduleTime({
        queueType,
        userId: TEST_USER_ID,
        userTimezone: timezone,
        baseTime,
      });

      expect(result).toBeInstanceOf(Date);
      expect(!isNaN(result.getTime())).toBe(true);
      // Should handle the ambiguous time correctly
      expect(result.getTime()).toBeGreaterThan(baseTime.getTime());
    });

    it("should handle DST transition with interval scheduling", async () => {
      // Test interval scheduling across DST boundary
      const baseTime = new Date("2024-03-31T01:00:00.000Z"); // Just before spring DST

      const queueType = {
        id: "queue-1",
        name: "test-queue",
        scheduleType: "INTERVAL" as const,
        scheduleConfig: {
          useGlobalInterval: false,
          intervalHours: 2,
        },
      };

      // Last post was 1 hour ago (before DST transition)
      const lastPostTime = new Date("2024-03-31T00:00:00.000Z");
      (getLastPostTimeForQueue as ReturnType<typeof vi.fn>).mockResolvedValue(
        lastPostTime
      );

      const result = await calculateNextScheduleTime({
        queueType,
        userId: TEST_USER_ID,
        userTimezone: timezone,
        baseTime,
      });

      expect(result).toBeInstanceOf(Date);
      expect(!isNaN(result.getTime())).toBe(true);
      // Should calculate correctly despite DST transition
      expect(result.getTime()).toBeGreaterThan(baseTime.getTime());
    });

    it("should handle multiple DST transitions in different timezones", async () => {
      const timezones = [
        "America/New_York", // US Eastern
        "Europe/London", // UK
        "Australia/Sydney", // Australian Eastern
        "Asia/Tokyo", // No DST
      ];

      for (const tz of timezones) {
        const baseTime = new Date("2024-03-31T12:00:00.000Z");

        const queueType = {
          id: "queue-1",
          name: "test-queue",
          scheduleType: "FIXED_SLOTS" as const,
          scheduleConfig: {
            slots: ["09:00", "15:00", "21:00"],
          },
        };

        (getLastPostTimeForQueue as ReturnType<typeof vi.fn>).mockResolvedValue(
          null
        );

        const result = await calculateNextScheduleTime({
          queueType,
          userId: TEST_USER_ID,
          userTimezone: tz,
          baseTime,
        });

        expect(result).toBeInstanceOf(Date);
        expect(!isNaN(result.getTime())).toBe(true);
        expect(result.getTime()).toBeGreaterThanOrEqual(baseTime.getTime());
      }
    });

    it("should produce monotonic slot sequence across DST boundaries", async () => {
      const queueType = {
        id: "queue-1",
        name: "test-queue",
        scheduleType: "FIXED_SLOTS" as const,
        scheduleConfig: {
          slots: ["01:30", "02:30", "03:30", "04:30"],
        },
      };

      // Around Europe/London spring DST switch.
      const baseTime = new Date("2024-03-31T00:15:00.000Z");
      const timezone = "Europe/London";

      const generated: Date[] = [];
      let lastPost: Date | null = null;
      for (let i = 0; i < 8; i++) {
        (getLastPostTimeForQueue as ReturnType<typeof vi.fn>).mockResolvedValue(
          lastPost
        );
        const next = await calculateNextScheduleTime({
          queueType,
          userId: TEST_USER_ID,
          userTimezone: timezone,
          baseTime,
        });
        generated.push(next);
        lastPost = next;
      }

      for (let i = 1; i < generated.length; i++) {
        expect(generated[i]!.getTime()).toBeGreaterThan(
          generated[i - 1]!.getTime()
        );
      }
    });
  });

  describe("Past Date Edge Cases", () => {
    it("should handle 'now + interval is still in the past' scenario", async () => {
      // If last post was very old, adding interval might still be in the past
      const now = new Date("2024-01-01T12:00:00.000Z");
      const veryOldLastPost = new Date("2020-01-01T00:00:00.000Z"); // 4 years ago

      const queueType = {
        id: "queue-1",
        name: "test-queue",
        scheduleType: "INTERVAL" as const,
        scheduleConfig: {
          useGlobalInterval: false,
          intervalHours: 1, // 1 hour interval
        },
      };

      (getLastPostTimeForQueue as ReturnType<typeof vi.fn>).mockResolvedValue(
        veryOldLastPost
      );

      const result = await calculateNextScheduleTime({
        queueType,
        userId: TEST_USER_ID,
        userTimezone: "UTC",
        baseTime: now,
      });

      expect(result).toBeInstanceOf(Date);
      expect(!isNaN(result.getTime())).toBe(true);
      // Should return now or future, never past
      expect(result.getTime()).toBeGreaterThanOrEqual(now.getTime());
    });

    it("should handle interval calculation when last post + interval < now", async () => {
      const now = new Date("2024-06-15T14:00:00.000Z");
      const lastPost = new Date("2024-06-15T12:00:00.000Z"); // 2 hours ago

      const queueType = {
        id: "queue-1",
        name: "test-queue",
        scheduleType: "INTERVAL" as const,
        scheduleConfig: {
          useGlobalInterval: false,
          intervalHours: 1, // 1 hour interval, but 2 hours have passed
        },
      };

      (getLastPostTimeForQueue as ReturnType<typeof vi.fn>).mockResolvedValue(
        lastPost
      );

      const result = await calculateNextScheduleTime({
        queueType,
        userId: TEST_USER_ID,
        userTimezone: "UTC",
        baseTime: now,
      });

      expect(result).toBeInstanceOf(Date);
      expect(!isNaN(result.getTime())).toBe(true);
      // Should schedule immediately or very soon, not in the past
      expect(result.getTime()).toBeGreaterThanOrEqual(now.getTime() - 1000); // Allow 1s tolerance
    });

    it("should handle slot scheduling when all slots are in the past", async () => {
      const now = new Date("2024-06-15T23:00:00.000Z"); // 11 PM

      const queueType = {
        id: "queue-1",
        name: "test-queue",
        scheduleType: "FIXED_SLOTS" as const,
        scheduleConfig: {
          slots: ["09:00", "12:00", "15:00"], // All in the past
        },
      };

      (getLastPostTimeForQueue as ReturnType<typeof vi.fn>).mockResolvedValue(
        null
      );

      const result = await calculateNextScheduleTime({
        queueType,
        userId: TEST_USER_ID,
        userTimezone: "UTC",
        baseTime: now,
      });

      expect(result).toBeInstanceOf(Date);
      expect(!isNaN(result.getTime())).toBe(true);
      // Should schedule for tomorrow's first slot, not today's past slots
      expect(result.getTime()).toBeGreaterThan(now.getTime());
    });
  });

  describe("Concurrency and Duplicate Prevention", () => {
    it("should produce consistent results when called simultaneously", async () => {
      const baseTime = new Date("2024-06-15T12:00:00.000Z");

      const queueType = {
        id: "queue-1",
        name: "test-queue",
        scheduleType: "INTERVAL" as const,
        scheduleConfig: {
          useGlobalInterval: false,
          intervalHours: 4,
        },
      };

      (getLastPostTimeForQueue as ReturnType<typeof vi.fn>).mockResolvedValue(
        null
      );

      // Simulate concurrent calls
      const results = await Promise.all([
        calculateNextScheduleTime({
          queueType,
          userId: TEST_USER_ID,
          userTimezone: "UTC",
          baseTime,
        }),
        calculateNextScheduleTime({
          queueType,
          userId: TEST_USER_ID,
          userTimezone: "UTC",
          baseTime,
        }),
        calculateNextScheduleTime({
          queueType,
          userId: TEST_USER_ID,
          userTimezone: "UTC",
          baseTime,
        }),
      ]);

      // All results should be valid dates
      results.forEach((result) => {
        expect(result).toBeInstanceOf(Date);
        expect(!isNaN(result.getTime())).toBe(true);
      });

      // Results should be consistent (same or very close)
      // Allow 1 second difference for timing
      const times = results.map((r) => r.getTime());
      const min = Math.min(...times);
      const max = Math.max(...times);
      expect(max - min).toBeLessThan(2000); // Less than 2 seconds difference
    });

    it("should handle rapid successive calls without race conditions", async () => {
      const baseTime = new Date("2024-06-15T12:00:00.000Z");

      const queueType = {
        id: "queue-1",
        name: "test-queue",
        scheduleType: "FIXED_SLOTS" as const,
        scheduleConfig: {
          slots: ["14:00", "16:00", "18:00"],
        },
      };

      (getLastPostTimeForQueue as ReturnType<typeof vi.fn>).mockResolvedValue(
        null
      );

      // Rapid successive calls
      const promises = Array.from({ length: 10 }, () =>
        calculateNextScheduleTime({
          queueType,
          userId: TEST_USER_ID,
          userTimezone: "UTC",
          baseTime,
        })
      );

      const results = await Promise.all(promises);

      // All should return valid dates
      results.forEach((result) => {
        expect(result).toBeInstanceOf(Date);
        expect(!isNaN(result.getTime())).toBe(true);
        expect(result.getTime()).toBeGreaterThanOrEqual(baseTime.getTime());
      });
    });
  });

  describe("Retry and Error Handling", () => {
    it("should handle database errors gracefully", async () => {
      const queueType = {
        id: "queue-1",
        name: "test-queue",
        scheduleType: "INTERVAL" as const,
        scheduleConfig: {
          useGlobalInterval: false,
          intervalHours: 4,
        },
      };

      // Simulate database error
      (getLastPostTimeForQueue as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error("Database connection failed")
      );

      const result = await calculateNextScheduleTime({
        queueType,
        userId: TEST_USER_ID,
        userTimezone: "UTC",
      });

      // Should return a valid date (fallback to now) instead of crashing
      expect(result).toBeInstanceOf(Date);
      expect(!isNaN(result.getTime())).toBe(true);
    });

    it("should handle invalid timezone gracefully", async () => {
      const queueType = {
        id: "queue-1",
        name: "test-queue",
        scheduleType: "FIXED_SLOTS" as const,
        scheduleConfig: {
          slots: ["09:00"],
        },
      };

      (getLastPostTimeForQueue as ReturnType<typeof vi.fn>).mockResolvedValue(
        null
      );

      // Invalid timezone should fallback to UTC
      const result = await calculateNextScheduleTime({
        queueType,
        userId: TEST_USER_ID,
        userTimezone: "Invalid/Timezone",
      });

      expect(result).toBeInstanceOf(Date);
      expect(!isNaN(result.getTime())).toBe(true);
    });

    it("should handle empty slot arrays", async () => {
      const queueType = {
        id: "queue-1",
        name: "test-queue",
        scheduleType: "FIXED_SLOTS" as const,
        scheduleConfig: {
          slots: [],
        },
      };

      (getLastPostTimeForQueue as ReturnType<typeof vi.fn>).mockResolvedValue(
        null
      );

      const result = await calculateNextScheduleTime({
        queueType,
        userId: TEST_USER_ID,
        userTimezone: "UTC",
      });

      // Should return current time as fallback
      expect(result).toBeInstanceOf(Date);
      expect(!isNaN(result.getTime())).toBe(true);
    });
  });

  describe("Boundary Conditions", () => {
    it("should handle midnight boundary correctly", async () => {
      const baseTime = new Date("2024-06-15T23:55:00.000Z"); // 5 minutes before midnight

      const queueType = {
        id: "queue-1",
        name: "test-queue",
        scheduleType: "FIXED_SLOTS" as const,
        scheduleConfig: {
          slots: ["00:00", "12:00"],
        },
      };

      (getLastPostTimeForQueue as ReturnType<typeof vi.fn>).mockResolvedValue(
        null
      );

      const result = await calculateNextScheduleTime({
        queueType,
        userId: TEST_USER_ID,
        userTimezone: "UTC",
        baseTime,
      });

      expect(result).toBeInstanceOf(Date);
      expect(!isNaN(result.getTime())).toBe(true);
      // Should schedule for tomorrow's 00:00, not today's (which is in the past)
      expect(result.getTime()).toBeGreaterThan(baseTime.getTime());
    });

    it("should handle year boundary correctly", async () => {
      const baseTime = new Date("2024-12-31T23:00:00.000Z");

      const queueType = {
        id: "queue-1",
        name: "test-queue",
        scheduleType: "FIXED_SLOTS" as const,
        scheduleConfig: {
          slots: ["09:00"],
        },
      };

      (getLastPostTimeForQueue as ReturnType<typeof vi.fn>).mockResolvedValue(
        null
      );

      const result = await calculateNextScheduleTime({
        queueType,
        userId: TEST_USER_ID,
        userTimezone: "UTC",
        baseTime,
      });

      expect(result).toBeInstanceOf(Date);
      expect(!isNaN(result.getTime())).toBe(true);
      // Should schedule for next year
      expect(result.getFullYear()).toBeGreaterThanOrEqual(2025);
    });
  });
});
