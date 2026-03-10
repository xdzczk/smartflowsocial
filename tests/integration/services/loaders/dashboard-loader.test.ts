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

vi.mock("~/features/user", () => ({
  getUserById: vi.fn(),
}));

vi.mock("~/features/user/services/user-cache.server", () => ({
  getQueueTypesCached: vi.fn(),
  getHashTagPresetsCached: vi.fn(),
}));

vi.mock("~/features/posts/services/post-filtering.server", () => ({
  filterPostsByQueueType: vi.fn((posts, queueType) => {
    if (queueType === "all") return posts;
    return (
      posts as Array<{ queueType?: { name?: string | null } | null }>
    ).filter((p) => p.queueType?.name === queueType);
  }),
}));

vi.mock("~/features/posts/services/combined.server", () => ({
  combineContent: vi.fn((posts: unknown[], longformPosts: unknown[]) => [
    ...posts,
    ...longformPosts,
  ]),
}));

import { TEST_USER_ID } from "../../../utils/test-helpers";

import { loadDashboardData } from "~/features/posts/services/dashboard-loader.server";
import { getUserById } from "~/features/user";
import {
  getQueueTypesCached,
  getHashTagPresetsCached,
} from "~/features/user/services/user-cache.server";
import { getScheduledLongFormPosts } from "~/models/longformpost.server";
import {
  getScheduledPosts,
  getPostStatistics,
} from "~/models/post.queries.server";

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
    const pagination = { total: 1, pages: 1, currentPage: 1, limit: 20 };

    (getScheduledPosts as ReturnType<typeof vi.fn>).mockResolvedValue({
      posts: mockPosts,
      pagination,
    });
    (getScheduledLongFormPosts as ReturnType<typeof vi.fn>).mockResolvedValue({
      posts: mockLongformPosts,
      pagination,
    });
    (getPostStatistics as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockStatistics
    );
    (getUserById as ReturnType<typeof vi.fn>).mockResolvedValue(mockUser);
    (getQueueTypesCached as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockQueueTypes
    );
    (getHashTagPresetsCached as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockHashTagPresets
    );

    const result = await loadDashboardData(TEST_USER_ID, "all");

    // The function converts posts to DTOs and adds signedEvent/nostrEvent fields
    expect(result.scheduledPosts).toHaveLength(1);
    expect(result.scheduledPosts[0]).toMatchObject({
      id: "post-1",
      queueType: expect.objectContaining({
        id: "queue-1",
        name: "Queue 1",
      }) as unknown,
    });
    expect(result.scheduledPosts[0]).toHaveProperty("signedEvent");
    expect(result.scheduledPosts[0]).toHaveProperty("nostrEvent");
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
    const mockQueueTypes = [
      { id: "queue-1", name: "Queue 1", isEnabled: true },
    ];
    const pagination = { total: 1, pages: 1, currentPage: 1, limit: 20 };

    (getScheduledPosts as ReturnType<typeof vi.fn>).mockResolvedValue({
      posts: mockPosts,
      pagination,
    });
    (getScheduledLongFormPosts as ReturnType<typeof vi.fn>).mockResolvedValue({
      posts: mockLongformPosts,
      pagination,
    });
    (getPostStatistics as ReturnType<typeof vi.fn>).mockResolvedValue({
      scheduledCount: 0,
      successCount: 0,
    });
    (getUserById as ReturnType<typeof vi.fn>).mockResolvedValue(mockUser);
    (getQueueTypesCached as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockQueueTypes
    );
    (getHashTagPresetsCached as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    const result = await loadDashboardData(TEST_USER_ID, "Queue 1");

    expect(getScheduledPosts).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: TEST_USER_ID,
        queueType: "Queue 1",
      })
    );
    expect(result.selectedQueueType).toBe("Queue 1");
  });

  it("should filter out disabled queue types", async () => {
    const mockQueueTypes = [
      { id: "queue-1", name: "Queue 1", isEnabled: true },
      { id: "queue-2", name: "Queue 2", isEnabled: false },
      { id: "queue-3", name: "Queue 3" }, // Missing isEnabled - treated as enabled
    ];
    const emptyPagination = { total: 0, pages: 0, currentPage: 1, limit: 20 };

    (getScheduledPosts as ReturnType<typeof vi.fn>).mockResolvedValue({
      posts: [],
      pagination: emptyPagination,
    });
    (getScheduledLongFormPosts as ReturnType<typeof vi.fn>).mockResolvedValue({
      posts: [],
      pagination: emptyPagination,
    });
    (getPostStatistics as ReturnType<typeof vi.fn>).mockResolvedValue({
      scheduledCount: 0,
      successCount: 0,
    });
    (getUserById as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: TEST_USER_ID,
    });
    (getQueueTypesCached as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockQueueTypes
    );
    (getHashTagPresetsCached as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    const result = await loadDashboardData(TEST_USER_ID, "all");

    // Filter checks isEnabled !== false, so undefined passes
    expect(result.queueTypes.length).toBeGreaterThanOrEqual(1);
    expect(result.queueTypes.some((qt) => qt.id === "queue-1")).toBe(true);
    expect(result.queueTypes.some((qt) => qt.id === "queue-2")).toBe(false);
  });
});
