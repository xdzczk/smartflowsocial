import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockGetQueueTypesCached,
  mockGetScheduledPostsCountByQueue,
  mockGetScheduledLongFormCountByQueue,
} = vi.hoisted(() => ({
  mockGetQueueTypesCached: vi.fn(),
  mockGetScheduledPostsCountByQueue: vi.fn(),
  mockGetScheduledLongFormCountByQueue: vi.fn(),
}));

vi.mock("~/features/user/services/user-cache.server", () => ({
  getQueueTypesCached: mockGetQueueTypesCached,
}));

vi.mock("~/features/posts/server", () => ({
  getLongFormStatistics: vi.fn(),
  getPostStatistics: vi.fn(),
  getScheduledPostsCountByQueue: mockGetScheduledPostsCountByQueue,
  getScheduledLongFormCountByQueue: mockGetScheduledLongFormCountByQueue,
}));

vi.mock("~/features/posts/repositories/entitlement-counts.server", () => ({
  countDraftItemsForUser: vi.fn(),
}));

import { getQueueCountsForDashboard } from "~/features/posts/services/content-statistics.server";

describe("getQueueCountsForDashboard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("keeps paused queues visible in dashboard counts", async () => {
    mockGetQueueTypesCached.mockResolvedValue([
      {
        id: "queue-active",
        name: "Active queue",
        isEnabled: true,
        status: "ACTIVE",
      },
      {
        id: "queue-paused",
        name: "Paused queue",
        isEnabled: true,
        status: "PAUSED",
      },
    ]);
    mockGetScheduledPostsCountByQueue.mockResolvedValue([
      { queueTypeId: "queue-active", count: 2 },
      { queueTypeId: "queue-paused", count: 3 },
    ]);
    mockGetScheduledLongFormCountByQueue.mockResolvedValue([
      { queueTypeId: "queue-paused", count: 1 },
    ]);

    const result = await getQueueCountsForDashboard("user-1");

    expect(result).toEqual([
      { queueName: "Active queue", count: 2 },
      { queueName: "Paused queue", count: 4 },
    ]);
  });
});
