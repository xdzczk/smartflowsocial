/**
 * Property-based tests for scheduling algorithms
 * 
 * Uses fast-check to generate random inputs and verify properties
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import fc from "fast-check";
import { calculateNextScheduleTime } from "~/features/posts/schedulers";
import { getLastPostTimeForQueue } from "~/models/post.server";
import { getScheduleInterval } from "~/models/user.server";
import { TEST_USER_ID } from "../utils/test-helpers";

// Mock dependencies
vi.mock("~/models/post.server", () => ({
  getLastPostTimeForQueue: vi.fn(),
}));

vi.mock("~/models/user.server", () => ({
  getScheduleInterval: vi.fn(),
}));

describe("Property-Based Tests: Scheduling Algorithms", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("calculateNextScheduleTime - INTERVAL scheduling", () => {
    it("should always return a Date object", () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 24 }), // intervalHours
          fc.date({ min: new Date("2020-01-01"), max: new Date("2030-12-31") }), // lastPostTime or null
          fc.constantFrom("UTC", "America/New_York", "Europe/London", "Asia/Tokyo"), // timezone
          async (intervalHours, lastPostTime, timezone) => {
            const queueType = {
              id: "queue-1",
              name: "test-queue",
              scheduleType: "INTERVAL" as const,
              scheduleConfig: {
                useGlobalInterval: false,
                intervalHours,
              },
            };

            (getLastPostTimeForQueue as ReturnType<typeof vi.fn>).mockResolvedValue(
              fc.boolean().filter((b) => b).value ? lastPostTime : null,
            );

            const result = await calculateNextScheduleTime({
              queueType,
              userId: TEST_USER_ID,
              userTimezone: timezone,
            });

            return result instanceof Date;
          },
        ),
        { numRuns: 30 },
      );
    });

    it("should return a date in the future or present (never past)", () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 24 }),
          fc.date({ min: new Date("2020-01-01"), max: new Date() }), // Past or present date
          async (intervalHours, lastPostTime) => {
            const queueType = {
              id: "queue-1",
              name: "test-queue",
              scheduleType: "INTERVAL" as const,
              scheduleConfig: {
                useGlobalInterval: false,
                intervalHours,
              },
            };

            (getLastPostTimeForQueue as ReturnType<typeof vi.fn>).mockResolvedValue(lastPostTime);

            const now = new Date();
            const result = await calculateNextScheduleTime({
              queueType,
              userId: TEST_USER_ID,
              userTimezone: "UTC",
            });

            // Result should be >= now (never in the past)
            return result.getTime() >= now.getTime() - 1000; // Allow 1 second tolerance
          },
        ),
        { numRuns: 30 },
      );
    });

    it("should handle various interval hours correctly", () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 168 }), // 1 hour to 1 week
          async (intervalHours) => {
            const queueType = {
              id: "queue-1",
              name: "test-queue",
              scheduleType: "INTERVAL" as const,
              scheduleConfig: {
                useGlobalInterval: false,
                intervalHours,
              },
            };

            const lastPostTime = new Date();
            lastPostTime.setHours(lastPostTime.getHours() - 1);

            (getLastPostTimeForQueue as ReturnType<typeof vi.fn>).mockResolvedValue(lastPostTime);

            const result = await calculateNextScheduleTime({
              queueType,
              userId: TEST_USER_ID,
              userTimezone: "UTC",
            });

            // Result should be a valid date
            return result instanceof Date && !isNaN(result.getTime());
          },
        ),
        { numRuns: 30 },
      );
    });
  });

  describe("calculateNextScheduleTime - FIXED_SLOTS scheduling", () => {
    it("should always return a Date object for valid slot configurations", () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.tuple(
              fc.integer({ min: 0, max: 23 }), // hours
              fc.integer({ min: 0, max: 59 }), // minutes
            ),
            { minLength: 1, maxLength: 10 },
          ),
          fc.constantFrom("UTC", "America/New_York", "Europe/London"),
          async (slots, timezone) => {
            const slotStrings = slots.map(([h, m]) => `${h}:${m}`);
            const queueType = {
              id: "queue-1",
              name: "test-queue",
              scheduleType: "FIXED_SLOTS" as const,
              scheduleConfig: {
                slots: slotStrings,
              },
            };

            (getLastPostTimeForQueue as ReturnType<typeof vi.fn>).mockResolvedValue(null);

            const result = await calculateNextScheduleTime({
              queueType,
              userId: TEST_USER_ID,
              userTimezone: timezone,
            });

            return result instanceof Date;
          },
        ),
        { numRuns: 30 },
      );
    });

    it("should return a date in the future or present for slot-based scheduling", () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.tuple(
              fc.integer({ min: 0, max: 23 }),
              fc.integer({ min: 0, max: 59 }),
            ),
            { minLength: 1, maxLength: 5 },
          ),
          async (slots) => {
            const slotStrings = slots.map(([h, m]) => `${h}:${m}`);
            const queueType = {
              id: "queue-1",
              name: "test-queue",
              scheduleType: "FIXED_SLOTS" as const,
              scheduleConfig: {
                slots: slotStrings,
              },
            };

            (getLastPostTimeForQueue as ReturnType<typeof vi.fn>).mockResolvedValue(null);

            const now = new Date();
            const result = await calculateNextScheduleTime({
              queueType,
              userId: TEST_USER_ID,
              userTimezone: "UTC",
            });

            // Result should be >= now
            return result.getTime() >= now.getTime() - 1000;
          },
        ),
        { numRuns: 30 },
      );
    });

    it("should handle various timezone inputs correctly", () => {
      fc.assert(
        fc.property(
          fc.constantFrom("UTC", "America/New_York", "Europe/London", "Asia/Tokyo", "Australia/Sydney"),
          async (timezone) => {
            const queueType = {
              id: "queue-1",
              name: "test-queue",
              scheduleType: "FIXED_SLOTS" as const,
              scheduleConfig: {
                slots: ["09:00", "15:00", "21:00"],
              },
            };

            (getLastPostTimeForQueue as ReturnType<typeof vi.fn>).mockResolvedValue(null);

            const result = await calculateNextScheduleTime({
              queueType,
              userId: TEST_USER_ID,
              userTimezone: timezone,
            });

            return result instanceof Date && !isNaN(result.getTime());
          },
        ),
        { numRuns: 20 },
      );
    });
  });

  describe("Edge cases", () => {
    it("should handle empty slot arrays gracefully", () => {
      fc.assert(
        fc.property(
          fc.constant([]),
          async (slots) => {
            const queueType = {
              id: "queue-1",
              name: "test-queue",
              scheduleType: "FIXED_SLOTS" as const,
              scheduleConfig: {
                slots,
              },
            };

            (getLastPostTimeForQueue as ReturnType<typeof vi.fn>).mockResolvedValue(null);

            const result = await calculateNextScheduleTime({
              queueType,
              userId: TEST_USER_ID,
              userTimezone: "UTC",
            });

            // Should return current time for empty slots
            return result instanceof Date;
          },
        ),
      );
    });

    it("should handle very large interval hours", () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 8760 }), // Up to 1 year
          async (intervalHours) => {
            const queueType = {
              id: "queue-1",
              name: "test-queue",
              scheduleType: "INTERVAL" as const,
              scheduleConfig: {
                useGlobalInterval: false,
                intervalHours,
              },
            };

            const lastPostTime = new Date();
            (getLastPostTimeForQueue as ReturnType<typeof vi.fn>).mockResolvedValue(lastPostTime);

            const result = await calculateNextScheduleTime({
              queueType,
              userId: TEST_USER_ID,
              userTimezone: "UTC",
            });

            return result instanceof Date && !isNaN(result.getTime());
          },
        ),
        { numRuns: 20 },
      );
    });
  });
});

