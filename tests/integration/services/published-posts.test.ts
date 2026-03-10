/**
 * Integration tests for posted posts service
 * Tests app/features/posts/services/published-posts.server.ts
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock dependencies
vi.mock("~/features/user", () => ({
  getUserById: vi.fn(),
  getQueueTypes: vi.fn(),
}));

vi.mock("~/features/user/services/user-cache.server", () => ({
  getQueueTypesCached: vi.fn(),
}));

vi.mock("~/models/longformpost.server", () => ({
  getPublishedLongFormPosts: vi.fn(),
}));

vi.mock("~/models/post.queries.server", () => ({
  getPublishedPosts: vi.fn(),
  getPublishedRepostsCount: vi.fn(() => Promise.resolve(0)),
}));

vi.mock("~/features/posts/services/combined.server", () => ({
  combineContent: vi.fn((posts: unknown[], longformPosts: unknown[]) => [
    ...posts,
    ...longformPosts,
  ]),
}));

vi.mock("~/features/posts/services/stats.server", () => ({
  getPostStats: vi.fn(),
}));

import { TEST_USER_ID } from "../../utils/test-helpers";

import { getPublishedDashboardData } from "~/features/posts/publishing/index.server";
import { getUserById, getQueueTypes } from "~/features/user";
import { getQueueTypesCached } from "~/features/user/services/user-cache.server";
import { getPublishedLongFormPosts } from "~/models/longformpost.server";
import { getPublishedPosts } from "~/models/post.queries.server";

describe("Posted Posts Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should get posted dashboard data", async () => {
    const mockPosts = {
      posts: [{ id: "post-1", queueType: { id: "queue-1", name: "Queue 1" } }],
      pagination: { total: 1, pages: 1, currentPage: 1 },
    };
    const mockLongformResult = {
      posts: [
        { id: "longform-1", queueType: { id: "queue-1", name: "Queue 1" } },
      ],
      pagination: { total: 1, pages: 1, currentPage: 1 },
    };
    const mockUser = { id: TEST_USER_ID };
    const mockQueueTypes = [
      { id: "queue-1", name: "Queue 1", isEnabled: true },
    ];

    (getPublishedPosts as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockPosts
    );
    (getPublishedLongFormPosts as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockLongformResult
    );
    (getUserById as ReturnType<typeof vi.fn>).mockResolvedValue(mockUser);
    (getQueueTypes as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockQueueTypes
    );
    (getQueueTypesCached as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockQueueTypes
    );

    const url = new URL("http://localhost:3000/dashboard/published?page=1");
    const result = await getPublishedDashboardData({
      userId: TEST_USER_ID,
      params: { queueType: "all" },
      url,
    });

    // The function converts posts to DTOs and adds signedEvent/nostrEvent fields
    expect(result.posts).toHaveLength(1);
    expect(result.posts[0]).toMatchObject({
      id: "post-1",
      queueType: expect.objectContaining({
        id: "queue-1",
        name: "Queue 1",
      }) as unknown,
    });
    expect(result.posts[0]).toHaveProperty("signedEvent");
    expect(result.posts[0]).toHaveProperty("nostrEvent");
    expect(result.longformPosts).toBeDefined();
    expect(result.user).toEqual(mockUser);
    expect(result.queueTypes).toEqual(mockQueueTypes);
    expect(result.selectedQueueType).toBe("all");
  });

  it("should handle pagination from URL", async () => {
    (getPublishedPosts as ReturnType<typeof vi.fn>).mockResolvedValue({
      posts: [],
      pagination: { total: 0, pages: 0, currentPage: 2 },
    });
    (getPublishedLongFormPosts as ReturnType<typeof vi.fn>).mockResolvedValue({
      posts: [],
      pagination: { total: 0, pages: 0, currentPage: 2 },
    });
    (getUserById as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: TEST_USER_ID,
    });
    (getQueueTypes as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (getQueueTypesCached as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    const url = new URL("http://localhost:3000/dashboard/published?page=2");
    await getPublishedDashboardData({
      userId: TEST_USER_ID,
      params: {},
      url,
    });

    expect(getPublishedPosts).toHaveBeenCalledWith({
      userId: TEST_USER_ID,
      page: 2,
      limit: 50,
      queueType: "all",
    });
  });

  it("should handle invalid longform result", async () => {
    (getPublishedPosts as ReturnType<typeof vi.fn>).mockResolvedValue({
      posts: [],
      pagination: { total: 0, pages: 0, currentPage: 1 },
    });
    (getPublishedLongFormPosts as ReturnType<typeof vi.fn>).mockResolvedValue(
      null
    );
    (getUserById as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: TEST_USER_ID,
    });
    (getQueueTypes as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (getQueueTypesCached as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    const url = new URL("http://localhost:3000/dashboard/published");
    const result = await getPublishedDashboardData({
      userId: TEST_USER_ID,
      params: {},
      url,
    });

    expect(result.longformPosts).toEqual([]);
  });

  it("should handle non-array queue types", async () => {
    (getPublishedPosts as ReturnType<typeof vi.fn>).mockResolvedValue({
      posts: [],
      pagination: { total: 0, pages: 0, currentPage: 1 },
    });
    (getPublishedLongFormPosts as ReturnType<typeof vi.fn>).mockResolvedValue({
      posts: [],
      pagination: { total: 0, pages: 0, currentPage: 1 },
    });
    (getUserById as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: TEST_USER_ID,
    });
    (getQueueTypes as ReturnType<typeof vi.fn>).mockResolvedValue(
      "not-an-array"
    );
    (getQueueTypesCached as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    const url = new URL("http://localhost:3000/dashboard/published");
    const result = await getPublishedDashboardData({
      userId: TEST_USER_ID,
      params: {},
      url,
    });

    expect(result.queueTypes).toEqual([]);
  });
});
