import { describe, expect, it } from "vitest";

import { deriveDashboardActivitySummary } from "~/features/posts/services/content-statistics.server";

describe("deriveDashboardActivitySummary", () => {
  it("returns first-run true when all activity signals are empty", () => {
    const result = deriveDashboardActivitySummary({
      draftCount: 0,
      postStatistics: { scheduledCount: 0, successCount: 0 },
      queueCountsByQueue: [],
    });

    expect(result).toEqual({
      draftCount: 0,
      hasDrafts: false,
      hasScheduled: false,
      hasPublished: false,
      hasQueuesWithContent: false,
      isFirstRunDashboard: true,
    });
  });

  it("returns first-run false when any activity exists", () => {
    const fromDrafts = deriveDashboardActivitySummary({
      draftCount: 2,
      postStatistics: { scheduledCount: 0, successCount: 0 },
      queueCountsByQueue: [],
    });
    expect(fromDrafts.isFirstRunDashboard).toBe(false);

    const fromScheduled = deriveDashboardActivitySummary({
      draftCount: 0,
      postStatistics: { scheduledCount: 1, successCount: 0 },
      queueCountsByQueue: [],
    });
    expect(fromScheduled.isFirstRunDashboard).toBe(false);

    const fromPublished = deriveDashboardActivitySummary({
      draftCount: 0,
      postStatistics: { scheduledCount: 0, successCount: 1 },
      queueCountsByQueue: [],
    });
    expect(fromPublished.isFirstRunDashboard).toBe(false);

    const fromQueueContent = deriveDashboardActivitySummary({
      draftCount: 0,
      postStatistics: { scheduledCount: 0, successCount: 0 },
      queueCountsByQueue: [{ queueName: "Main", count: 1 }],
    });
    expect(fromQueueContent.isFirstRunDashboard).toBe(false);
  });
});
