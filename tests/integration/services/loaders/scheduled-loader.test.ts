/**
 * Integration tests for scheduled loader
 * Tests app/features/posts/services/scheduled-loader.server.ts
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock dependencies
vi.mock("~/models/longformpost.server", () => ({
  getScheduledLongFormPosts: vi.fn(),
}));

vi.mock("~/models/post.queries.server", () => ({
  getScheduledPosts: vi.fn(),
}));

vi.mock("~/features/user", () => ({
  getUserById: vi.fn(),
  getQueueTypes: vi.fn(),
  getUserHashTagPresets: vi.fn(),
}));

vi.mock("~/features/posts/services/post-filtering.server", () => ({
  filterPostsByQueueType: vi.fn((posts: unknown[], queueType: string) => {
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

import { loadScheduledData } from "~/features/posts/services/scheduled-loader.server";
import {
  getUserById,
  getQueueTypes,
  getUserHashTagPresets,
} from "~/features/user";
import { getScheduledLongFormPosts } from "~/models/longformpost.server";
import { getScheduledPosts } from "~/models/post.queries.server";

import { TEST_USER_ID } from "../../../utils/test-helpers";

describe("Scheduled Loader", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should load scheduled data", async () => {
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
    const mockHashTagPresets = [{ id: "preset-1", name: "Preset 1" }];

    (getScheduledPosts as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockPosts,
    );
    (getScheduledLongFormPosts as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockLongformPosts,
    );
    (getUserById as ReturnType<typeof vi.fn>).mockResolvedValue(mockUser);
    (getQueueTypes as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockQueueTypes,
    );
    (getUserHashTagPresets as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockHashTagPresets,
    );

    const result = await loadScheduledData(TEST_USER_ID, "all");

    expect(result.posts).toEqual(mockPosts);
    expect(result.longformPosts).toBeDefined();
    expect(result.user).toEqual(mockUser);
    expect(result.queueTypes).toHaveLength(1);
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

    (getScheduledPosts as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockPosts,
    );
    (getScheduledLongFormPosts as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockLongformPosts,
    );
    (getUserById as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: TEST_USER_ID,
    });
    (getQueueTypes as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (getUserHashTagPresets as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    const result = await loadScheduledData(TEST_USER_ID, "Queue 1");

    expect(getScheduledPosts).toHaveBeenCalledWith({
      userId: TEST_USER_ID,
      queueType: "Queue 1",
    });
    expect(result.selectedQueueType).toBe("Queue 1");
  });
});
