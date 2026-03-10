/**
 * Edge-case tests for schedulers.ts wrapper and internal error paths.
 * Tests calculateNextScheduleTime fallback when internal throws.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("~/lib/temporal", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...(actual as object),
    fromDate: vi.fn(() => {
      throw new Error("fromDate failed");
    }),
  };
});

vi.mock("~/models/post.queries.server", () => ({
  getLastPostTimeForQueue: vi.fn().mockResolvedValue(null),
}));

vi.mock("~/features/user", () => ({
  getScheduleInterval: vi.fn().mockResolvedValue([4]),
}));

import { calculateNextScheduleTime } from "~/features/posts/server";

const BASE_TIME = new Date("2024-01-15T10:00:00Z");

describe("Schedulers edge cases", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("calculateNextScheduleTime wrapper fallback", () => {
    it("returns fallback date when internal throws (e.g. temporal fromDate throws)", async () => {
      const queueType = {
        id: "queue-1",
        name: "posts",
      };

      const result = await calculateNextScheduleTime({
        queueType: queueType as Parameters<
          typeof calculateNextScheduleTime
        >[0]["queueType"],
        userId: "user-1",
        baseTime: BASE_TIME,
      });

      expect(result).toBeInstanceOf(Date);
      expect(result.getTime()).toBe(BASE_TIME.getTime());
    });
  });
});
