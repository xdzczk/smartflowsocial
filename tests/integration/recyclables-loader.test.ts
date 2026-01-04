/**
 * Integration tests for recyclables loader
 *
 * Tests app/routes/dashboard.recyclables.tsx loader
 * Tests getRecyclableDashboardData function
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
// Mock Prisma to prevent $use errors
vi.mock("~/lib/prisma.server", () => ({
  prisma: {
    $use: vi.fn(),
  },
}));

// Mock dependencies
vi.mock("~/models/post.queries.server", () => ({
  getRecyclablePosts: vi.fn(),
}));

vi.mock("~/features/user", () => ({
  getUserById: vi.fn(),
  getQueueTypes: vi.fn(),
}));

vi.mock("~/features/posts/stats.server", () => ({
  getPostStats: vi.fn(),
}));

import type { PostDTO } from "~/features/posts/dtos";
import { getRecyclableDashboardData } from "~/features/posts/server";
import { getPostStats } from "~/features/posts/stats.server";
import { getUserById, getQueueTypes } from "~/features/user";
import { getRecyclablePosts } from "~/models/post.queries.server";

import {
  TEST_USER_ID,
  createMockUser,
  createMockQueueType,
  createMockPost,
} from "../utils/test-helpers";

describe("Recyclables Loader", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should load recyclable posts data", async () => {
    const mockPosts = [
      createMockPost({
        id: "post-1",
        isRecyclable: true,
        isPosted: true,
      }),
      createMockPost({
        id: "post-2",
        isRecyclable: true,
        isPosted: true,
      }),
    ];

    const mockPagination = {
      currentPage: 1,
      totalPages: 1,
      totalItems: 2,
      itemsPerPage: 50,
    };

    const mockUser = createMockUser({ id: TEST_USER_ID });
    const mockQueueTypes = [
      createMockQueueType({ id: "queue-1", name: "posts" }),
      createMockQueueType({ id: "queue-2", name: "all" }),
    ];

    const mockStats = {
      "event-1": { likes: 10, reposts: 2, replies: 5 },
      "event-2": { likes: 5, reposts: 1, replies: 2 },
    };

    (getRecyclablePosts as ReturnType<typeof vi.fn>).mockResolvedValue({
      posts: mockPosts,
      pagination: mockPagination,
    });
    (getUserById as ReturnType<typeof vi.fn>).mockResolvedValue(mockUser);
    (getQueueTypes as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockQueueTypes,
    );
    (getPostStats as ReturnType<typeof vi.fn>).mockResolvedValue(mockStats);

    const url = new URL("http://localhost/dashboard/recyclables");
    const params = { queueType: "all" };

    const result = await getRecyclableDashboardData({
      userId: TEST_USER_ID,
      params,
      url,
    });

    expect(getRecyclablePosts).toHaveBeenCalledWith({
      userId: TEST_USER_ID,
      page: 1,
      limit: 50,
      queueType: "all",
    });
    // DTOs serialize dates to strings and may include undefined fields
    expect(result.posts).toHaveLength(mockPosts.length);
    result.posts.forEach((post, index) => {
      const mockPost = mockPosts[index];
      expect(post.id).toBe(mockPost.id);
      expect(post.content).toBe(mockPost.content);
      expect(post.caption).toBe(mockPost.caption);
      // Type assertion needed because PostDTO extends Post which includes isRecyclable
      // PostDTO should include isRecyclable from Prisma Post type
      // The mock post type doesn't include isRecyclable in its inferred type, so we use type assertions
      const postWithRecyclable = post as PostDTO & { isRecyclable: boolean };
      const mockPostWithRecyclable = mockPost as typeof mockPost & { isRecyclable?: boolean };
      expect(postWithRecyclable.isRecyclable).toBe(mockPostWithRecyclable.isRecyclable);
      expect(post.isPosted).toBe(mockPost.isPosted);
      // Dates are serialized to strings in DTOs
      expect(typeof post.createdAt).toBe("string");
      expect(typeof post.updatedAt).toBe("string");
    });
    expect(result.pagination).toEqual(mockPagination);
    expect(result.user).toEqual(mockUser);
    expect(result.queueTypes).toEqual(mockQueueTypes);
    expect(result.stats).toEqual(mockStats);
    expect(result.selectedQueueType).toBe("all");
  });

  it("should handle pagination query parameter", async () => {
    const mockPosts = [createMockPost({ id: "post-1", isRecyclable: true })];
    const mockPagination = {
      currentPage: 2,
      totalPages: 3,
      totalItems: 150,
      itemsPerPage: 50,
    };

    (getRecyclablePosts as ReturnType<typeof vi.fn>).mockResolvedValue({
      posts: mockPosts,
      pagination: mockPagination,
    });
    (getUserById as ReturnType<typeof vi.fn>).mockResolvedValue(
      createMockUser(),
    );
    (getQueueTypes as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (getPostStats as ReturnType<typeof vi.fn>).mockResolvedValue({});

    const url = new URL("http://localhost/dashboard/recyclables?page=2");
    const params = { queueType: "posts" };

    const result = await getRecyclableDashboardData({
      userId: TEST_USER_ID,
      params,
      url,
    });

    expect(getRecyclablePosts).toHaveBeenCalledWith({
      userId: TEST_USER_ID,
      page: 2,
      limit: 50,
      queueType: "posts",
    });
    expect(result.pagination.currentPage).toBe(2);
  });

  it("should filter out disabled queue types", async () => {
    const mockQueueTypes = [
      createMockQueueType({ id: "queue-1", name: "posts", isEnabled: true }),
      createMockQueueType({
        id: "queue-2",
        name: "disabled",
        isEnabled: false,
      }),
      createMockQueueType({ id: "queue-3", name: "enabled", isEnabled: true }),
    ];

    (getRecyclablePosts as ReturnType<typeof vi.fn>).mockResolvedValue({
      posts: [],
      pagination: {
        currentPage: 1,
        totalPages: 1,
        totalItems: 0,
        itemsPerPage: 50,
      },
    });
    (getUserById as ReturnType<typeof vi.fn>).mockResolvedValue(
      createMockUser(),
    );
    (getQueueTypes as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockQueueTypes,
    );
    (getPostStats as ReturnType<typeof vi.fn>).mockResolvedValue({});

    const url = new URL("http://localhost/dashboard/recyclables");
    const params = { queueType: "all" };

    const result = await getRecyclableDashboardData({
      userId: TEST_USER_ID,
      params,
      url,
    });

    expect(result.queueTypes).toHaveLength(2);
    expect(result.queueTypes.every((qt) => qt.isEnabled !== false)).toBe(true);
  });

  it("should extract event IDs from signedEvent for stats", async () => {
    const mockPosts = [
      createMockPost({
        id: "post-1",
        signedEvent: { id: "event-1", pubkey: "pubkey-1" },
      }),
      createMockPost({
        id: "post-2",
        signedEvent: { id: "event-2", pubkey: "pubkey-2" },
      }),
    ];

    (getRecyclablePosts as ReturnType<typeof vi.fn>).mockResolvedValue({
      posts: mockPosts,
      pagination: {
        currentPage: 1,
        totalPages: 1,
        totalItems: 2,
        itemsPerPage: 50,
      },
    });
    (getUserById as ReturnType<typeof vi.fn>).mockResolvedValue(
      createMockUser(),
    );
    (getQueueTypes as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (getPostStats as ReturnType<typeof vi.fn>).mockResolvedValue({
      "event-1": { likes: 10 },
      "event-2": { likes: 5 },
    });

    const url = new URL("http://localhost/dashboard/recyclables");
    const params = { queueType: "all" };

    await getRecyclableDashboardData({
      userId: TEST_USER_ID,
      params,
      url,
    });

    expect(getPostStats).toHaveBeenCalledWith(["event-1", "event-2"]);
  });
});
