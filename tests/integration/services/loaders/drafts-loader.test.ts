/**
 * Integration tests for drafts loader
 * Tests app/features/posts/services/drafts-loader.server.ts
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock dependencies
vi.mock("~/models/longformpost.server", () => ({
  getDraftLongFormPosts: vi.fn(),
}));

vi.mock("~/models/post.queries.server", () => ({
  getDraftPosts: vi.fn(),
}));

vi.mock("~/features/user", () => ({
  getUserById: vi.fn(),
  getQueueTypes: vi.fn(),
}));

vi.mock("~/features/posts/services/combined.server", () => ({
  combineContent: vi.fn((posts: unknown[], longformPosts: unknown[]) => [
    ...posts,
    ...longformPosts,
  ]),
}));

vi.mock("~/features/posts/drafts/services/draft-group.server", () => ({
  listBulkDraftGroups: vi.fn().mockResolvedValue([]),
}));

import { TEST_USER_ID } from "../../../utils/test-helpers";

import { loadDraftsData } from "~/features/posts/server";
import { getUserById, getQueueTypes } from "~/features/user";
import { getDraftLongFormPosts } from "~/models/longformpost.server";
import { getDraftPosts } from "~/models/post.queries.server";

describe("Drafts Loader", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should load drafts data", async () => {
    const mockPosts = [
      { id: "post-1", queueType: { id: "queue-1", name: "Queue 1" } },
    ];
    const mockLongformPosts = [
      { id: "longform-1", queueType: { id: "queue-1", name: "Queue 1" } },
    ];
    const mockUser = { id: TEST_USER_ID };
    const mockQueueTypes = [
      { id: "queue-1", name: "Queue 1", isEnabled: true },
    ];
    const pagination = { total: 1, pages: 1, currentPage: 1, limit: 20 };

    (getDraftPosts as ReturnType<typeof vi.fn>).mockResolvedValue({
      posts: mockPosts,
      pagination,
    });
    (getDraftLongFormPosts as ReturnType<typeof vi.fn>).mockResolvedValue({
      posts: mockLongformPosts,
      pagination,
    });
    (getUserById as ReturnType<typeof vi.fn>).mockResolvedValue(mockUser);
    (getQueueTypes as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockQueueTypes
    );

    const result = await loadDraftsData(TEST_USER_ID, "all");

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
    // The function converts longform posts to DTOs and adds signedEvent/nostrEvent fields
    expect(result.longformPosts).toHaveLength(1);
    expect(result.longformPosts[0]).toMatchObject({
      id: "longform-1",
      queueType: expect.objectContaining({
        id: "queue-1",
        name: "Queue 1",
      }) as unknown,
    });
    expect(result.longformPosts[0]).toHaveProperty("signedEvent");
    expect(result.longformPosts[0]).toHaveProperty("nostrEvent");
    expect(result.user).toEqual(mockUser);
    expect(result.queueTypes).toHaveLength(1);
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
    const pagination = { total: 2, pages: 1, currentPage: 1, limit: 20 };

    (getDraftPosts as ReturnType<typeof vi.fn>).mockResolvedValue({
      posts: mockPosts,
      pagination,
    });
    (getDraftLongFormPosts as ReturnType<typeof vi.fn>).mockResolvedValue({
      posts: mockLongformPosts,
      pagination,
    });
    (getUserById as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: TEST_USER_ID,
    });
    (getQueueTypes as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    const result = await loadDraftsData(TEST_USER_ID, "Queue 1");

    expect(result.longformPosts).toHaveLength(1);
    expect(result.longformPosts[0]?.id).toBe("longform-1");
    expect(result.selectedQueueType).toBe("Queue 1");
  });

  it("should return all longform posts when queueType is 'all'", async () => {
    const mockLongformPosts = [
      { id: "longform-1", queueType: { id: "queue-1", name: "Queue 1" } },
      { id: "longform-2", queueType: { id: "queue-2", name: "Queue 2" } },
    ];
    const pagination = { total: 2, pages: 1, currentPage: 1, limit: 20 };

    (getDraftPosts as ReturnType<typeof vi.fn>).mockResolvedValue({
      posts: [],
      pagination: { total: 0, pages: 0, currentPage: 1, limit: 20 },
    });
    (getDraftLongFormPosts as ReturnType<typeof vi.fn>).mockResolvedValue({
      posts: mockLongformPosts,
      pagination,
    });
    (getUserById as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: TEST_USER_ID,
    });
    (getQueueTypes as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    const result = await loadDraftsData(TEST_USER_ID, "all");

    expect(result.longformPosts).toHaveLength(2);
  });
});
