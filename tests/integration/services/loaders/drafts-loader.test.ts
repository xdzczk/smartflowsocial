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

vi.mock("~/models/user.server", () => ({
  getUserById: vi.fn(),
  getQueueTypes: vi.fn(),
}));

vi.mock("~/features/posts/services/combined.server", () => ({
  combineContent: vi.fn((posts: unknown[], longformPosts: unknown[]) => [...posts, ...longformPosts]),
}));

import { loadDraftsData } from "~/features/posts/services/drafts-loader.server";
import { getDraftLongFormPosts } from "~/models/longformpost.server";
import { getDraftPosts } from "~/models/post.queries.server";
import { getUserById, getQueueTypes } from "~/models/user.server";

import { TEST_USER_ID } from "../../../utils/test-helpers";

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
    const mockQueueTypes = [{ id: "queue-1", name: "Queue 1", isEnabled: true }];

    (getDraftPosts as ReturnType<typeof vi.fn>).mockResolvedValue(mockPosts);
    (getDraftLongFormPosts as ReturnType<typeof vi.fn>).mockResolvedValue(mockLongformPosts);
    (getUserById as ReturnType<typeof vi.fn>).mockResolvedValue(mockUser);
    (getQueueTypes as ReturnType<typeof vi.fn>).mockResolvedValue(mockQueueTypes);

    const result = await loadDraftsData(TEST_USER_ID, "all");

    expect(result.posts).toEqual(mockPosts);
    expect(result.longformPosts).toEqual(mockLongformPosts);
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

    (getDraftPosts as ReturnType<typeof vi.fn>).mockResolvedValue(mockPosts);
    (getDraftLongFormPosts as ReturnType<typeof vi.fn>).mockResolvedValue(mockLongformPosts);
    (getUserById as ReturnType<typeof vi.fn>).mockResolvedValue({ id: TEST_USER_ID });
    (getQueueTypes as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    const result = await loadDraftsData(TEST_USER_ID, "Queue 1");

    expect(result.longformPosts).toHaveLength(1);
    expect(result.longformPosts[0].id).toBe("longform-1");
    expect(result.selectedQueueType).toBe("Queue 1");
  });

  it("should return all longform posts when queueType is 'all'", async () => {
    const mockLongformPosts = [
      { id: "longform-1", queueType: { id: "queue-1", name: "Queue 1" } },
      { id: "longform-2", queueType: { id: "queue-2", name: "Queue 2" } },
    ];

    (getDraftPosts as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (getDraftLongFormPosts as ReturnType<typeof vi.fn>).mockResolvedValue(mockLongformPosts);
    (getUserById as ReturnType<typeof vi.fn>).mockResolvedValue({ id: TEST_USER_ID });
    (getQueueTypes as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    const result = await loadDraftsData(TEST_USER_ID, "all");

    expect(result.longformPosts).toHaveLength(2);
  });
});

