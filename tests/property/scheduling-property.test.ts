/**
 * Property-based tests for scheduling algorithms
 *
 * Uses fast-check to generate random inputs and verify properties
 */

import fc from "fast-check";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { TEST_USER_ID } from "../utils/test-helpers";

import { calculateNextScheduleTime } from "~/features/posts/schedulers";
import { getScheduleInterval } from "~/features/user";
import { getLastPostTimeForQueue } from "~/models/post.queries.server";

// Mock dependencies
vi.mock("~/models/post.queries.server", () => ({
  getLastPostTimeForQueue: vi.fn(),
}));

vi.mock("~/features/user", () => ({
  getScheduleInterval: vi.fn(),
}));

describe("Property-Based Tests: Scheduling Algorithms", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default mock return values - ensure they're always set
    (getScheduleInterval as ReturnType<typeof vi.fn>).mockResolvedValue(["4"]);
    (getLastPostTimeForQueue as ReturnType<typeof vi.fn>).mockResolvedValue(
      null
    );
  });

  // Simple unit test to verify the function works with the exact counterexample
  it("should work with counterexample: intervalHours=1, lastPostTime=2020-01-01, timezone=UTC", async () => {
    const queueType = {
      id: "queue-1",
      name: "test-queue",
      scheduleType: "INTERVAL" as const,
      scheduleConfig: {
        useGlobalInterval: false,
        intervalHours: 1,
      },
    };

    const pastDate = new Date("2020-01-01T00:00:00.000Z");
    (getLastPostTimeForQueue as ReturnType<typeof vi.fn>).mockResolvedValue(
      pastDate
    );

    const result = await calculateNextScheduleTime({
      queueType,
      userId: TEST_USER_ID,
      userTimezone: "UTC",
    });

    expect(result).toBeInstanceOf(Date);
    expect(!isNaN(result.getTime())).toBe(true);
    // Should return now (current time) since past date + 1 hour is still in the past
    expect(result.getTime()).toBeGreaterThanOrEqual(Date.now() - 1000);
  });

  it("should work with counterexample: empty slots array", async () => {
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

    expect(result).toBeInstanceOf(Date);
    expect(!isNaN(result.getTime())).toBe(true);
  });

  it("should work with counterexample: slot at 00:00", async () => {
    const queueType = {
      id: "queue-1",
      name: "test-queue",
      scheduleType: "FIXED_SLOTS" as const,
      scheduleConfig: {
        slots: ["00:00"],
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

    expect(result).toBeInstanceOf(Date);
    expect(!isNaN(result.getTime())).toBe(true);
  });

  describe("calculateNextScheduleTime - INTERVAL scheduling", () => {
    it("should work with counterexample: intervalHours=1, lastPostTime=2020-01-01, timezone=UTC", async () => {
      const queueType = {
        id: "queue-1",
        name: "test-queue",
        scheduleType: "INTERVAL" as const,
        scheduleConfig: {
          useGlobalInterval: false,
          intervalHours: 1,
        },
      };

      const pastDate = new Date("2020-01-01T00:00:00.000Z");
      (getLastPostTimeForQueue as ReturnType<typeof vi.fn>).mockResolvedValue(
        pastDate
      );

      const result = await calculateNextScheduleTime({
        queueType,
        userId: TEST_USER_ID,
        userTimezone: "UTC",
      });

      expect(result).toBeInstanceOf(Date);
      expect(!isNaN(result.getTime())).toBe(true);
    });

    it("should work with counterexample: intervalHours=1, lastPostTime=null, timezone=UTC", async () => {
      const queueType = {
        id: "queue-1",
        name: "test-queue",
        scheduleType: "INTERVAL" as const,
        scheduleConfig: {
          useGlobalInterval: false,
          intervalHours: 1,
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

      expect(result).toBeInstanceOf(Date);
      expect(!isNaN(result.getTime())).toBe(true);
    });

    it("should always return a Date object", async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 24 }), // intervalHours
          fc.oneof(
            fc.date({
              min: new Date("2020-01-01"),
              max: new Date("2030-12-31"),
            }),
            fc.constant(null)
          ), // lastPostTime or null
          fc.constantFrom(
            "UTC",
            "America/New_York",
            "Europe/London",
            "Asia/Tokyo"
          ), // timezone
          async (
            intervalHours: number,
            lastPostTime: Date | null,
            timezone: string
          ) => {
            try {
              // Reset mocks for this test run to ensure clean state
              vi.clearAllMocks();
              // Ensure mocks are set up for this test run
              (
                getScheduleInterval as ReturnType<typeof vi.fn>
              ).mockResolvedValue(["4"]);
              (
                getLastPostTimeForQueue as ReturnType<typeof vi.fn>
              ).mockResolvedValue(lastPostTime);

              const queueType = {
                id: "queue-1",
                name: "test-queue",
                scheduleType: "INTERVAL" as const,
                scheduleConfig: {
                  useGlobalInterval: false,
                  intervalHours,
                },
              };

              const result = await calculateNextScheduleTime({
                queueType,
                userId: TEST_USER_ID,
                userTimezone: timezone,
              });

              // Ensure result is a valid Date
              if (!result) {
                console.error("Result is null/undefined", {
                  intervalHours,
                  lastPostTime,
                  timezone,
                });
                return false;
              }
              if (!(result instanceof Date)) {
                console.error("Result is not a Date", {
                  result,
                  intervalHours,
                  lastPostTime,
                  timezone,
                  resultType: typeof result,
                });
                return false;
              }
              if (isNaN(result.getTime())) {
                console.error("Result is invalid Date", {
                  result,
                  intervalHours,
                  lastPostTime,
                  timezone,
                });
                return false;
              }
              return true;
            } catch (_error) {
              console.error("Error in test:", _error, {
                intervalHours,
                lastPostTime,
                timezone,
              });
              return false;
            }
          }
        ),
        { numRuns: 30, verbose: true }
      );
    });

    it("should return a date in the future or present (never past)", async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 24 }),
          fc.oneof(
            fc.date({ min: new Date("2020-01-01"), max: new Date() }), // Past or present date
            fc.constant(null)
          ),
          async (intervalHours: number, lastPostTime: Date | null) => {
            try {
              // Reset mocks for this test run to ensure clean state
              vi.clearAllMocks();
              // Ensure mocks are set up for this test run
              (
                getScheduleInterval as ReturnType<typeof vi.fn>
              ).mockResolvedValue(["4"]);
              (
                getLastPostTimeForQueue as ReturnType<typeof vi.fn>
              ).mockResolvedValue(lastPostTime);

              const queueType = {
                id: "queue-1",
                name: "test-queue",
                scheduleType: "INTERVAL" as const,
                scheduleConfig: {
                  useGlobalInterval: false,
                  intervalHours,
                },
              };

              const beforeCall = Date.now();
              const result = await calculateNextScheduleTime({
                queueType,
                userId: TEST_USER_ID,
                userTimezone: "UTC",
              });
              const _afterCall = Date.now();

              // Result should be a valid Date
              if (
                !result ||
                !(result instanceof Date) ||
                isNaN(result.getTime())
              ) {
                return false;
              }

              // Result should be >= beforeCall (never in the past)
              // Allow tolerance for async execution and clock drift (5 seconds)
              const resultTime = result.getTime();
              return resultTime >= beforeCall - 5000;
            } catch (_error) {
              console.error("Error in test:", _error, {
                intervalHours,
                lastPostTime,
              });
              return false;
            }
          }
        ),
        { numRuns: 30, verbose: true }
      );
    });

    it("should handle various interval hours correctly", async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 168 }), // 1 hour to 1 week
          async (intervalHours: number) => {
            try {
              // Reset mocks for this test run to ensure clean state
              vi.clearAllMocks();
              // Ensure mocks are set up for this test run
              (
                getScheduleInterval as ReturnType<typeof vi.fn>
              ).mockResolvedValue(["4"]);

              const queueType = {
                id: "queue-1",
                name: "test-queue",
                scheduleType: "INTERVAL" as const,
                scheduleConfig: {
                  useGlobalInterval: false,
                  intervalHours,
                },
              };

              // Use UTC time to avoid timezone issues
              const lastPostTime = new Date();
              lastPostTime.setUTCHours(lastPostTime.getUTCHours() - 1);

              // Ensure mocks are set up for this test run
              (
                getScheduleInterval as ReturnType<typeof vi.fn>
              ).mockResolvedValue(["4"]);
              (
                getLastPostTimeForQueue as ReturnType<typeof vi.fn>
              ).mockResolvedValue(lastPostTime);

              const result = await calculateNextScheduleTime({
                queueType,
                userId: TEST_USER_ID,
                userTimezone: "UTC",
              });

              // Result should be a valid date
              if (!result) {
                console.error("Result is null/undefined", { intervalHours });
                return false;
              }
              if (!(result instanceof Date)) {
                console.error("Result is not a Date", {
                  result,
                  intervalHours,
                });
                return false;
              }
              if (isNaN(result.getTime())) {
                console.error("Result is invalid Date", {
                  result,
                  intervalHours,
                });
                return false;
              }
              return true;
            } catch (_error) {
              console.error("Error in test:", _error, { intervalHours });
              return false;
            }
          }
        ),
        { numRuns: 30, verbose: true }
      );
    });
  });

  describe("calculateNextScheduleTime - FIXED_SLOTS scheduling", () => {
    it("should always return a Date object for valid slot configurations", async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.tuple(
              fc.integer({ min: 0, max: 23 }), // hours
              fc.integer({ min: 0, max: 59 }) // minutes
            ),
            { minLength: 1, maxLength: 10 }
          ),
          fc.constantFrom("UTC", "America/New_York", "Europe/London"),
          async (slots: Array<[number, number]>, timezone: string) => {
            try {
              // Reset mocks for this test run
              vi.clearAllMocks();
              (
                getScheduleInterval as ReturnType<typeof vi.fn>
              ).mockResolvedValue(["4"]);

              // Ensure slots is a flat array of tuples
              if (!Array.isArray(slots) || slots.length === 0) {
                return false;
              }

              const slotStrings = slots.map((slot) => {
                // Handle tuple format [h, m]
                // slot should be [h, m] directly from fc.tuple
                if (!Array.isArray(slot) || slot.length !== 2) {
                  throw new Error("Invalid slot format");
                }
                const [h, m] = slot;
                if (typeof h !== "number" || typeof m !== "number") {
                  throw new Error("Invalid slot format");
                }
                return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
              });

              const queueType = {
                id: "queue-1",
                name: "test-queue",
                scheduleType: "FIXED_SLOTS" as const,
                scheduleConfig: {
                  slots: slotStrings,
                },
              };

              (
                getLastPostTimeForQueue as ReturnType<typeof vi.fn>
              ).mockResolvedValue(null);

              const result = await calculateNextScheduleTime({
                queueType,
                userId: TEST_USER_ID,
                userTimezone: timezone,
              });

              if (!result) {
                console.error("Result is null/undefined", { slots, timezone });
                return false;
              }
              if (!(result instanceof Date)) {
                console.error("Result is not a Date", {
                  result,
                  slots,
                  timezone,
                });
                return false;
              }
              if (isNaN(result.getTime())) {
                console.error("Result is invalid Date", {
                  result,
                  slots,
                  timezone,
                });
                return false;
              }
              return true;
            } catch (_error) {
              console.error("Error in test:", _error, { slots, timezone });
              return false;
            }
          }
        ),
        { numRuns: 30, verbose: true }
      );
    });

    it("should return a date in the future or present for slot-based scheduling", async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.tuple(
              fc.integer({ min: 0, max: 23 }),
              fc.integer({ min: 0, max: 59 })
            ),
            { minLength: 1, maxLength: 5 }
          ),
          async (slots: Array<[number, number]>) => {
            try {
              // Reset mocks for this test run to ensure clean state
              vi.clearAllMocks();
              // Ensure mocks are set up for this test run
              (
                getScheduleInterval as ReturnType<typeof vi.fn>
              ).mockResolvedValue(["4"]);

              // Ensure slots is a flat array of tuples
              if (!Array.isArray(slots) || slots.length === 0) {
                return false;
              }

              const slotStrings = slots.map((slot) => {
                // Handle tuple format [h, m]
                // slot should be [h, m] directly from fc.tuple
                if (!Array.isArray(slot) || slot.length !== 2) {
                  throw new Error("Invalid slot format");
                }
                const [h, m] = slot;
                if (typeof h !== "number" || typeof m !== "number") {
                  throw new Error("Invalid slot format");
                }
                return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
              });

              const queueType = {
                id: "queue-1",
                name: "test-queue",
                scheduleType: "FIXED_SLOTS" as const,
                scheduleConfig: {
                  slots: slotStrings,
                },
              };

              (
                getLastPostTimeForQueue as ReturnType<typeof vi.fn>
              ).mockResolvedValue(null);

              const beforeCall = Date.now();
              const result = await calculateNextScheduleTime({
                queueType,
                userId: TEST_USER_ID,
                userTimezone: "UTC",
              });
              const _afterCall = Date.now();

              // Result should be a valid Date
              if (
                !result ||
                !(result instanceof Date) ||
                isNaN(result.getTime())
              ) {
                return false;
              }

              // Result should be >= beforeCall (allow tolerance for async execution and clock drift)
              return result.getTime() >= beforeCall - 5000;
            } catch (_error) {
              console.error("Error in test:", _error, { slots });
              return false;
            }
          }
        ),
        { numRuns: 30, verbose: true }
      );
    });

    it("should handle various timezone inputs correctly", async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom(
            "UTC",
            "America/New_York",
            "Europe/London",
            "Asia/Tokyo",
            "Australia/Sydney"
          ),
          async (timezone: string) => {
            try {
              // Reset mocks for this test run to ensure clean state
              vi.clearAllMocks();
              // Ensure mocks are set up for this test run
              (
                getScheduleInterval as ReturnType<typeof vi.fn>
              ).mockResolvedValue(["4"]);

              const queueType = {
                id: "queue-1",
                name: "test-queue",
                scheduleType: "FIXED_SLOTS" as const,
                scheduleConfig: {
                  slots: ["09:00", "15:00", "21:00"],
                },
              };

              (
                getLastPostTimeForQueue as ReturnType<typeof vi.fn>
              ).mockResolvedValue(null);

              const result = await calculateNextScheduleTime({
                queueType,
                userId: TEST_USER_ID,
                userTimezone: timezone,
              });

              if (!result) {
                console.error("Result is null/undefined", { timezone });
                return false;
              }
              if (!(result instanceof Date)) {
                console.error("Result is not a Date", { result, timezone });
                return false;
              }
              if (isNaN(result.getTime())) {
                console.error("Result is invalid Date", { result, timezone });
                return false;
              }
              return true;
            } catch (_error) {
              console.error("Error in test:", _error, { timezone });
              return false;
            }
          }
        ),
        { numRuns: 20, verbose: true }
      );
    });
  });

  describe("Edge cases", () => {
    it("should work with counterexample: empty slots array", async () => {
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

      expect(result).toBeInstanceOf(Date);
      expect(!isNaN(result.getTime())).toBe(true);
    });

    it("should work with counterexample: slot at 00:00, UTC", async () => {
      const queueType = {
        id: "queue-1",
        name: "test-queue",
        scheduleType: "FIXED_SLOTS" as const,
        scheduleConfig: {
          slots: ["00:00"],
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

      expect(result).toBeInstanceOf(Date);
      expect(!isNaN(result.getTime())).toBe(true);
    });

    it("should handle empty slot arrays gracefully", async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constant([] as Array<[number, number]>),
          async (slots: Array<[number, number]>) => {
            try {
              // Reset mocks for this test run to ensure clean state
              vi.clearAllMocks();
              // Ensure mocks are set up for this test run
              (
                getScheduleInterval as ReturnType<typeof vi.fn>
              ).mockResolvedValue(["4"]);
              (
                getLastPostTimeForQueue as ReturnType<typeof vi.fn>
              ).mockResolvedValue(null);

              // Convert slots to string format (e.g., "09:00")
              const slotStrings = slots.map(
                (slot) =>
                  `${String(slot[0]).padStart(2, "0")}:${String(slot[1]).padStart(2, "0")}`
              );

              const queueType = {
                id: "queue-1",
                name: "test-queue",
                scheduleType: "FIXED_SLOTS" as const,
                scheduleConfig: {
                  slots: slotStrings,
                },
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
              });

              // Should return current time for empty slots
              if (!result) {
                console.error("Result is null/undefined", { slots });
                return false;
              }
              if (!(result instanceof Date)) {
                console.error("Result is not a Date", { result, slots });
                return false;
              }
              if (isNaN(result.getTime())) {
                console.error("Result is invalid Date", { result, slots });
                return false;
              }
              return true;
            } catch (_error) {
              console.error("Error in test:", _error, { slots });
              return false;
            }
          }
        ),
        { verbose: true }
      );
    });

    it("should handle very large interval hours", async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 8760 }), // Up to 1 year
          async (intervalHours: number) => {
            try {
              // Reset mocks for this test run to ensure clean state
              vi.clearAllMocks();
              // Ensure mocks are set up for this test run
              (
                getScheduleInterval as ReturnType<typeof vi.fn>
              ).mockResolvedValue(["4"]);

              const queueType = {
                id: "queue-1",
                name: "test-queue",
                scheduleType: "INTERVAL" as const,
                scheduleConfig: {
                  useGlobalInterval: false,
                  intervalHours,
                },
              };

              // Use a time in the past to ensure the calculated time is in the future
              const lastPostTime = new Date();
              lastPostTime.setUTCHours(lastPostTime.getUTCHours() - 1);
              (
                getLastPostTimeForQueue as ReturnType<typeof vi.fn>
              ).mockResolvedValue(lastPostTime);

              const result = await calculateNextScheduleTime({
                queueType,
                userId: TEST_USER_ID,
                userTimezone: "UTC",
              });

              if (!result) {
                console.error("Result is null/undefined", { intervalHours });
                return false;
              }
              if (!(result instanceof Date)) {
                console.error("Result is not a Date", {
                  result,
                  intervalHours,
                });
                return false;
              }
              if (isNaN(result.getTime())) {
                console.error("Result is invalid Date", {
                  result,
                  intervalHours,
                });
                return false;
              }
              return true;
            } catch (_error) {
              console.error("Error in test:", _error, { intervalHours });
              return false;
            }
          }
        ),
        { numRuns: 20, verbose: true }
      );
    });
  });
});
