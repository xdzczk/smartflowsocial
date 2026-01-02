/**
 * Integration tests for scheduled posts service
 * Tests app/features/posts/services/scheduled-posts.server.ts
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock dependencies
vi.mock("~/models/longformpost.server", () => ({
  getScheduledLongFormPosts: vi.fn(),
}));

vi.mock("~/models/post.queries.server", () => ({
  getScheduledPosts: vi.fn(),
}));

vi.mock("~/models/user.server", () => ({
  getUserById: vi.fn(),
  getQueueTypes: vi.fn(),
  getUserHashTagPresets: vi.fn(),
}));

vi.mock("~/features/posts/services/combined.server", () => ({
  combineContent: vi.fn((posts: unknown[], longformPosts: unknown[]) => [...posts, ...longformPosts]),
}));

import { getScheduledDashboardData } from "~/features/posts/services/scheduled-posts.server";
import { getScheduledLongFormPosts } from "~/models/longformpost.server";
import { getScheduledPosts } from "~/models/post.queries.server";
import { getUserById, getQueueTypes, getUserHashTagPresets } from "~/models/user.server";

import { TEST_USER_ID } from "../../utils/test-helpers";

describe("Scheduled Posts Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should get scheduled dashboard data", async () => {
    const mockPosts = [
      { id: "post-1", queueType: { id: "queue-1", name: "Queue 1" } },
    ];
    const mockLongformPosts = [
      { id: "longform-1", queueType: { id: "queue-1", name: "Queue 1" } },
    ];
    const mockUser = { id: TEST_USER_ID };
    const mockQueueTypes = [{ id: "queue-1", name: "Queue 1", isEnabled: true }];
    const mockHashTagPresets = [{ id: "preset-1", name: "Preset 1" }];

    (getScheduledPosts as ReturnType<typeof vi.fn>).mockResolvedValue(mockPosts);
    (getScheduledLongFormPosts as ReturnType<typeof vi.fn>).mockResolvedValue(mockLongformPosts);
    (getUserById as ReturnType<typeof vi.fn>).mockResolvedValue(mockUser);
    (getQueueTypes as ReturnType<typeof vi.fn>).mockResolvedValue(mockQueueTypes);
    (getUserHashTagPresets as ReturnType<typeof vi.fn>).mockResolvedValue(mockHashTagPresets);

    const result = await getScheduledDashboardData({
      userId: TEST_USER_ID,
      queueType: "all",
    });

    expect(result.posts).toEqual(mockPosts);
    expect(result.longformPosts).toEqual(mockLongformPosts);
    expect(result.user).toEqual(mockUser);
    expect(result.queueTypes).toEqual(mockQueueTypes);
    expect(result.hashTagPresets).toEqual(mockHashTagPresets);
    expect(result.selectedQueueType).toBe("all");
  });

  it("should filter longform posts by queue type", async () => {
    const mockPosts = [
      { id: "post-1", queueType: { id: "queue-1", name: "Queue 1" } },
    ];
    const mockLongformPosts = [
      { id: "longform-1", queueType: { id: "queue-1", name: "Queue 1" } },
      { id: "longform-2", queueType: { id: "queue-2", name: "Queue 2" } },
    ];

    (getScheduledPosts as ReturnType<typeof vi.fn>).mockResolvedValue(mockPosts);
    (getScheduledLongFormPosts as ReturnType<typeof vi.fn>).mockResolvedValue(mockLongformPosts);
    (getUserById as ReturnType<typeof vi.fn>).mockResolvedValue({ id: TEST_USER_ID });
    (getQueueTypes as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (getUserHashTagPresets as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    const result = await getScheduledDashboardData({
      userId: TEST_USER_ID,
      queueType: "Queue 1",
    });

    expect(result.longformPosts).toHaveLength(1);
    expect(result.longformPosts[0].id).toBe("longform-1");
  });

  it("should handle non-array queue types and hash tag presets", async () => {
    (getScheduledPosts as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (getScheduledLongFormPosts as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (getUserById as ReturnType<typeof vi.fn>).mockResolvedValue({ id: TEST_USER_ID });
    (getQueueTypes as ReturnType<typeof vi.fn>).mockResolvedValue("not-an-array");
    (getUserHashTagPresets as ReturnType<typeof vi.fn>).mockResolvedValue("not-an-array");

    const result = await getScheduledDashboardData({
      userId: TEST_USER_ID,
      queueType: "all",
    });

    expect(result.queueTypes).toEqual([]);
    expect(result.hashTagPresets).toEqual([]);
  });
});

