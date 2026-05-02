import { describe, expect, it } from "vitest";

import {
  buildEarliestNextScheduledUtcMsByQueueFromFlow,
  estimatePostsPerDayForQueue,
  formatQueueRunwayDaysLabel,
  formatShortCadenceLabel,
} from "~/features/posts/components/queue-runway";
import type { CombinedContent, QueueType } from "~/features/posts/types";

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

  it("buildEarliestNextScheduledUtcMsByQueueFromFlow ignores attached follow-ups", () => {
    const now = Date.UTC(2026, 3, 1, 12, 0, 0);
    const parentMs = now + 60 * 60 * 1000;
    const attachedMs = now + 2 * 60 * 60 * 1000;
    const base = {
      userId: "u",
      createdAt: new Date(now),
      updatedAt: new Date(now),
      status: "SCHEDULED",
      currentState: "SCHEDULED",
      queueType: { id: "q", name: "Main" },
    } satisfies Partial<CombinedContent>;
    const emptyOriginal = {};
    const standaloneOriginal: CombinedContent["originalData"] =
      emptyOriginal as CombinedContent["originalData"];
    const attachedOriginal: CombinedContent["originalData"] =
      emptyOriginal as CombinedContent["originalData"];
    const standalone: CombinedContent = {
      ...base,
      id: "standalone",
      type: "post",
      dependencyMode: "standalone",
      scheduledAtUtc: new Date(parentMs),
      originalData: standaloneOriginal,
    };
    const attached: CombinedContent = {
      ...base,
      id: "attached",
      type: "post",
      dependencyMode: "attached",
      scheduledAtUtc: new Date(attachedMs),
      originalData: attachedOriginal,
    };
    expect(
      buildEarliestNextScheduledUtcMsByQueueFromFlow(
        [attached, standalone],
        now
      )
    ).toEqual({ Main: parentMs });
  });

  it("buildEarliestNextScheduledUtcMsByQueueFromFlow reads dependencyMode from originalData when missing on item", () => {
    const now = Date.UTC(2026, 3, 1, 12, 0, 0);
    const earlyMs = now + 60 * 60 * 1000;
    const attachedMeta = { dependencyMode: "attached" as const };
    const originalFromMeta: CombinedContent["originalData"] =
      attachedMeta as CombinedContent["originalData"];
    const item: CombinedContent = {
      id: "fu",
      type: "post",
      userId: "u",
      createdAt: new Date(now),
      updatedAt: new Date(now),
      status: "SCHEDULED",
      currentState: "SCHEDULED",
      scheduledAtUtc: new Date(earlyMs),
      queueType: { id: "q", name: "Main" },
      originalData: originalFromMeta,
    };
    expect(buildEarliestNextScheduledUtcMsByQueueFromFlow([item], now)).toEqual(
      {}
    );
  });
});
