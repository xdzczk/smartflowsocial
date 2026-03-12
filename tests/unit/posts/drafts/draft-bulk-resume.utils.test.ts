/**
 * Unit tests for draft bulk resume utils: getIntervalHours, applyScheduleOffset,
 * applyOffsetAndFormat, formatForDateTimeLocalExport, fetchScheduledTime.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  applyOffsetAndFormat,
  applyScheduleOffset,
  fetchScheduledTime,
  formatForDateTimeLocalExport,
  getIntervalHours,
} from "~/features/posts/drafts/utils/draft-bulk-resume.utils";
import type { QueueType } from "~/features/posts/types";
import { fromDate } from "~/lib/temporal";

describe("draft-bulk-resume.utils", () => {
  describe("getIntervalHours", () => {
    it("returns 4 for non-interval config", () => {
      expect(getIntervalHours(null, null)).toBe(4);
      expect(getIntervalHours({ slots: ["09:00"] }, null)).toBe(4);
      expect(getIntervalHours({ weeklySlots: [] }, null)).toBe(4);
    });

    it("returns config.intervalHours when set and not useGlobalInterval", () => {
      expect(getIntervalHours({ intervalHours: 2 }, null)).toBe(2);
      expect(
        getIntervalHours({ intervalHours: 8, useGlobalInterval: false }, null)
      ).toBe(8);
    });

    it("returns 4 when useGlobalInterval and currentUser is null", () => {
      expect(getIntervalHours({ useGlobalInterval: true }, null)).toBe(4);
    });

    it("returns 4 when useGlobalInterval and scheduleInterval is empty", () => {
      expect(
        getIntervalHours({ useGlobalInterval: true }, { scheduleInterval: [] })
      ).toBe(4);
    });

    it("returns user scheduleInterval[0] when number", () => {
      expect(
        getIntervalHours({ useGlobalInterval: true }, { scheduleInterval: [6] })
      ).toBe(6);
    });

    it("returns parsed number when user scheduleInterval[0] is string", () => {
      expect(
        getIntervalHours(
          { useGlobalInterval: true },
          { scheduleInterval: ["3"] }
        )
      ).toBe(3);
    });

    it("returns 4 when user interval is NaN or invalid", () => {
      expect(
        getIntervalHours(
          { useGlobalInterval: true },
          { scheduleInterval: ["not-a-number"] }
        )
      ).toBe(4);
    });
  });

  describe("applyScheduleOffset", () => {
    const baseDate = new Date("2024-03-08T12:00:00.000Z");
    const userUTC = {
      timezone: "UTC" as const,
      scheduleInterval: [2] as number[],
    };

    it("returns baseDate when baseIndex is 0", () => {
      const queueType: QueueType = {
        id: "q1",
        name: "Q",
        scheduleType: "INTERVAL",
        scheduleConfig: { intervalHours: 4 },
      };
      expect(applyScheduleOffset(baseDate, 0, queueType, userUTC)).toEqual(
        baseDate
      );
    });

    it("returns baseDate when queueType has no scheduleType", () => {
      const queueType: QueueType = { id: "q1", name: "Q" };
      expect(applyScheduleOffset(baseDate, 1, queueType, userUTC)).toEqual(
        baseDate
      );
    });

    it("applies INTERVAL offset (index 1 = +intervalHours)", () => {
      const queueType: QueueType = {
        id: "q1",
        name: "Q",
        scheduleType: "INTERVAL",
        scheduleConfig: { intervalHours: 2 },
      };
      const result = applyScheduleOffset(baseDate, 1, queueType, userUTC);
      expect(result.getTime()).toBe(baseDate.getTime() + 2 * 60 * 60 * 1000);
    });

    it("applies INTERVAL offset for index 2", () => {
      const queueType: QueueType = {
        id: "q1",
        name: "Q",
        scheduleType: "INTERVAL",
        scheduleConfig: { intervalHours: 1 },
      };
      const result = applyScheduleOffset(baseDate, 2, queueType, userUTC);
      expect(result.getTime()).toBe(baseDate.getTime() + 2 * 60 * 60 * 1000);
    });

    it("uses FIXED_SLOTS when scheduleType is FIXED_SLOTS", () => {
      const queueType: QueueType = {
        id: "q1",
        name: "Q",
        scheduleType: "FIXED_SLOTS",
        scheduleConfig: { slots: ["10:00", "14:00"] },
      };
      const baseAt10 = new Date("2024-03-08T10:00:00.000Z");
      const result = applyScheduleOffset(baseAt10, 1, queueType, userUTC);
      expect(result.getUTCHours()).toBe(14);
      expect(result.getUTCMinutes()).toBe(0);
    });

    it("returns baseDate when FIXED_SLOTS has empty slots", () => {
      const queueType: QueueType = {
        id: "q1",
        name: "Q",
        scheduleType: "FIXED_SLOTS",
        scheduleConfig: { slots: [] },
      };
      expect(applyScheduleOffset(baseDate, 1, queueType, userUTC)).toEqual(
        baseDate
      );
    });
  });

  describe("applyOffsetAndFormat", () => {
    it("parses datetime-local, applies offset, returns formatted string", () => {
      const queueType: QueueType = {
        id: "q1",
        name: "Q",
        scheduleType: "INTERVAL",
        scheduleConfig: { intervalHours: 2 },
      };
      const user = { timezone: "UTC", scheduleInterval: [2] };
      const scheduledTime = "2024-03-08T12:00";
      const result = applyOffsetAndFormat(scheduledTime, 1, queueType, user);
      expect(result).toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/);
      expect(result).not.toBe(scheduledTime);
    });

    it("returns same time string for baseIndex 0", () => {
      const queueType: QueueType = {
        id: "q1",
        name: "Q",
        scheduleType: "INTERVAL",
        scheduleConfig: { intervalHours: 2 },
      };
      const user = { timezone: "UTC", scheduleInterval: [2] };
      const scheduledTime = "2024-03-08T12:00";
      const result = applyOffsetAndFormat(scheduledTime, 0, queueType, user);
      expect(result).toBe(scheduledTime);
    });
  });

  describe("formatForDateTimeLocalExport", () => {
    it("formats zoned date for datetime-local input", () => {
      const zoned = fromDate(new Date("2024-03-08T14:30:00.000Z"), "UTC");
      const result = formatForDateTimeLocalExport(zoned, "UTC");
      expect(result).toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/);
    });
  });

  describe("fetchScheduledTime", () => {
    const originalFetch = globalThis.fetch;

    beforeEach(() => {
      globalThis.fetch = vi.fn();
    });

    afterEach(() => {
      globalThis.fetch = originalFetch;
    });

    it("returns scheduledTime string when API returns success", async () => {
      /* eslint-disable @typescript-eslint/consistent-type-assertions -- minimal Response mock */
      const mockResponse: Response = {
        ok: true,
        json: () => Promise.resolve({ scheduledTime: "2024-03-08T15:00:00Z" }),
      } as Response;
      /* eslint-enable @typescript-eslint/consistent-type-assertions */
      vi.mocked(globalThis.fetch).mockResolvedValue(mockResponse);

      const result = await fetchScheduledTime("queue-1", "user-1");
      expect(result).toBe("2024-03-08T15:00:00Z");
      expect(globalThis.fetch).toHaveBeenCalledWith(
        "/api/queue-schedule",
        expect.objectContaining({
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ queueTypeId: "queue-1", userId: "user-1" }),
        })
      );
    });

    it("returns null when response is not ok", async () => {
      /* eslint-disable @typescript-eslint/consistent-type-assertions -- minimal Response mock */
      const mockResponse: Response = { ok: false } as Response;
      /* eslint-enable @typescript-eslint/consistent-type-assertions */
      vi.mocked(globalThis.fetch).mockResolvedValue(mockResponse);

      const result = await fetchScheduledTime("Q", "u");
      expect(result).toBeNull();
    });

    it("returns null when scheduledTime is missing in body", async () => {
      /* eslint-disable @typescript-eslint/consistent-type-assertions -- minimal Response mock */
      const mockResponse: Response = {
        ok: true,
        json: () => Promise.resolve({}),
      } as Response;
      /* eslint-enable @typescript-eslint/consistent-type-assertions */
      vi.mocked(globalThis.fetch).mockResolvedValue(mockResponse);

      const result = await fetchScheduledTime("Q", "u");
      expect(result).toBeNull();
    });

    it("returns null when fetch throws", async () => {
      vi.mocked(globalThis.fetch).mockRejectedValue(new Error("network error"));
      const result = await fetchScheduledTime("Q", "u");
      expect(result).toBeNull();
    });
  });
});
