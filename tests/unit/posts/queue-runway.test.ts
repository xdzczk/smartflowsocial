import { describe, expect, it } from "vitest";

import {
  estimatePostsPerDayForQueue,
  formatQueueRunwayDaysLabel,
  formatShortCadenceLabel,
} from "~/features/posts/components/queue-runway";
import type { QueueType } from "~/features/posts/types";

describe("queue-runway", () => {
  it("estimatePostsPerDayForQueue uses 24h / interval for INTERVAL", () => {
    const qt: QueueType = {
      id: "1",
      name: "Main",
      scheduleType: "INTERVAL",
      scheduleConfig: { intervalHours: 12 },
    };
    expect(estimatePostsPerDayForQueue(qt, [])).toBe(2);
  });

  it("estimatePostsPerDayForQueue returns 0 when queue disabled", () => {
    const qt: QueueType = {
      id: "1",
      name: "Main",
      scheduleType: "INTERVAL",
      scheduleConfig: { intervalHours: 12 },
      isEnabled: false,
    };
    expect(estimatePostsPerDayForQueue(qt, [])).toBe(0);
  });

  it("estimatePostsPerDayForQueue uses slot count for FIXED_SLOTS", () => {
    const qt: QueueType = {
      id: "1",
      name: "News",
      scheduleType: "FIXED_SLOTS",
      scheduleConfig: { slots: ["09:00", "18:00"] },
    };
    expect(estimatePostsPerDayForQueue(qt, [])).toBe(2);
  });

  it("estimatePostsPerDayForQueue averages weekly slots over 7 days", () => {
    const qt: QueueType = {
      id: "1",
      name: "Weekly",
      scheduleType: "WEEKLY_SLOTS",
      scheduleConfig: {
        weeklySlots: [
          { dayOfWeek: 1, time: "10:00" },
          { dayOfWeek: 3, time: "10:00" },
        ],
      },
    };
    expect(estimatePostsPerDayForQueue(qt, [])).toBeCloseTo(2 / 7, 5);
  });

  it("formatQueueRunwayDaysLabel uses ceil of posts / rate", () => {
    expect(formatQueueRunwayDaysLabel(5, 2)).toBe("3 days");
    expect(formatQueueRunwayDaysLabel(1, 2)).toBe("1 day");
    expect(formatQueueRunwayDaysLabel(0, 2)).toBe("0 days");
    expect(formatQueueRunwayDaysLabel(3, null)).toBe("—");
    expect(formatQueueRunwayDaysLabel(3, 0)).toBe("—");
  });

  it("formatShortCadenceLabel prefers cadenceLabel when set", () => {
    const qt: QueueType = {
      id: "1",
      name: "X",
      cadenceLabel: "custom",
      scheduleType: "INTERVAL",
      scheduleConfig: { intervalHours: 6 },
    };
    expect(formatShortCadenceLabel(qt, [])).toBe("custom");
  });
});
