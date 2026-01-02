/**
 * Integration tests for dashboard loader
 * Tests app/features/posts/services/dashboard-loader.server.ts
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock dependencies
vi.mock("~/models/longformpost.server", () => ({
  getScheduledLongFormPosts: vi.fn(),
}));

vi.mock("~/models/post.queries.server", () => ({
  getScheduledPosts: vi.fn(),
  getPostStatistics: vi.fn(),
}));

vi.mock("~/models/user.server", () => ({
  getUserById: vi.fn(),
  getQueueTypes: vi.fn(),
  getUserHashTagPresets: vi.fn(),
}));

vi.mock("~/features/posts/services/post-filtering.server", () => ({
  filterPostsByQueueType: vi.fn((posts, queueType) => {
    if (queueType === "all") return posts;
    return (posts as Array<{ queueType?: { name?: string | null } | null }>).filter((p) => p.queueType?.name === queueType);
  }),
}));

vi.mock("~/features/posts/services/combined.server", () => ({
  combineContent: vi.fn((posts: unknown[], longformPosts: unknown[]) => [...posts, ...longformPosts]),
}));

import { loadDashboardData } from "~/features/posts/services/dashboard-loader.server";
import { getScheduledLongFormPosts } from "~/models/longformpost.server";
import { getScheduledPosts, getPostStatistics } from "~/models/post.queries.server";
import { getUserById, getQueueTypes, getUserHashTagPresets } from "~/models/user.server";

import { TEST_USER_ID } from "../../../utils/test-helpers";

describe("Dashboard Loader", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should load dashboard data with all queue types", async () => {
    const mockPosts = [
      { id: "post-1", queueType: { id: "queue-1", name: "Queue 1" } },
    ];
    const mockLongformPosts = [
      { id: "longform-1", queueType: { id: "queue-1", name: "Queue 1" } },
    ];
    const mockUser = { id: TEST_USER_ID, timezone: "UTC" };
    const mockQueueTypes = [
      { id: "queue-1", name: "Queue 1", isEnabled: true },
      { id: "queue-2", name: "Queue 2", isEnabled: false },
    ];
    const mockHashTagPresets = [{ id: "preset-1", name: "Preset 1" }];
    const mockStatistics = { scheduledCount: 5, successCount: 10 };

    (getScheduledPosts as ReturnType<typeof vi.fn>).mockResolvedValue(mockPosts);
    (getScheduledLongFormPosts as ReturnType<typeof vi.fn>).mockResolvedValue(mockLongformPosts);
    (getPostStatistics as ReturnType<typeof vi.fn>).mockResolvedValue(mockStatistics);
    (getUserById as ReturnType<typeof vi.fn>).mockResolvedValue(mockUser);
    (getQueueTypes as ReturnType<typeof vi.fn>).mockResolvedValue(mockQueueTypes);
    (getUserHashTagPresets as ReturnType<typeof vi.fn>).mockResolvedValue(mockHashTagPresets);

    const result = await loadDashboardData(TEST_USER_ID, "all");

    expect(result.scheduledPosts).toEqual(mockPosts);
    expect(result.longformPosts).toBeDefined();
    expect(result.postStatistics).toEqual(mockStatistics);
    expect(result.user).toEqual(mockUser);
    expect(result.queueTypes).toHaveLength(1); // Only enabled
    expect(result.selectedQueueType).toBe("all");
    expect(result.hashTagPresets).toEqual(mockHashTagPresets);
  });

  it("should filter by queue type", async () => {
    const mockPosts = [
      { id: "post-1", queueType: { id: "queue-1", name: "Queue 1" } },
    ];
    const mockLongformPosts = [
      { id: "longform-1", queueType: { id: "queue-1", name: "Queue 1" } },
      { id: "longform-2", queueType: { id: "queue-2", name: "Queue 2" } },
    ];
    const mockUser = { id: TEST_USER_ID };
    const mockQueueTypes = [{ id: "queue-1", name: "Queue 1", isEnabled: true }];

    (getScheduledPosts as ReturnType<typeof vi.fn>).mockResolvedValue(mockPosts);
    (getScheduledLongFormPosts as ReturnType<typeof vi.fn>).mockResolvedValue(mockLongformPosts);
    (getPostStatistics as ReturnType<typeof vi.fn>).mockResolvedValue({ scheduledCount: 0, successCount: 0 });
    (getUserById as ReturnType<typeof vi.fn>).mockResolvedValue(mockUser);
    (getQueueTypes as ReturnType<typeof vi.fn>).mockResolvedValue(mockQueueTypes);
    (getUserHashTagPresets as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    const result = await loadDashboardData(TEST_USER_ID, "Queue 1");

    expect(getScheduledPosts).toHaveBeenCalledWith({ userId: TEST_USER_ID, queueType: "Queue 1" });
    expect(result.selectedQueueType).toBe("Queue 1");
  });

  it("should filter out disabled queue types", async () => {
    const mockQueueTypes = [
      { id: "queue-1", name: "Queue 1", isEnabled: true },
      { id: "queue-2", name: "Queue 2", isEnabled: false },
      { id: "queue-3", name: "Queue 3" }, // Missing isEnabled - treated as enabled
    ];

    (getScheduledPosts as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (getScheduledLongFormPosts as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (getPostStatistics as ReturnType<typeof vi.fn>).mockResolvedValue({ scheduledCount: 0, successCount: 0 });
    (getUserById as ReturnType<typeof vi.fn>).mockResolvedValue({ id: TEST_USER_ID });
    (getQueueTypes as ReturnType<typeof vi.fn>).mockResolvedValue(mockQueueTypes);
    (getUserHashTagPresets as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    const result = await loadDashboardData(TEST_USER_ID, "all");

    // Filter checks isEnabled !== false, so undefined passes
    expect(result.queueTypes.length).toBeGreaterThanOrEqual(1);
    expect(result.queueTypes.some((qt) => qt.id === "queue-1")).toBe(true);
    expect(result.queueTypes.some((qt) => qt.id === "queue-2")).toBe(false);
  });
});

