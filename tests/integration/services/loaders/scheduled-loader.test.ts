/**
 * Integration tests for scheduled loader
 * Tests app/features/posts/services/scheduled-loader.server.ts
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Stub fetch helpers; keep pure utilities the loader needs (see scheduled-loader.server imports)
vi.mock("~/features/posts/server", async () => {
  const { pickRescheduleSourceSignedEvents } =
    await import("~/features/posts/data/reschedule-source-events.server");
  return {
    getScheduledLongFormPosts: vi.fn(),
    getScheduledPosts: vi.fn(),
    getScheduledRepostsCount: vi.fn(),
    pickRescheduleSourceSignedEvents,
  };
});

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

vi.mock("~/features/contest", () => ({
  getScheduledContestLaunchesForUser: vi.fn().mockResolvedValue([]),
}));

import { TEST_USER_ID } from "../../../utils/test-helpers";

import { getScheduledLongFormPosts } from "~/features/posts/server";
import {
  getScheduledPosts,
  getScheduledRepostsCount,
} from "~/features/posts/server";
import { loadScheduledData } from "~/features/posts/server/scheduling";
import {
  getUserById,
  getQueueTypes,
  getUserHashTagPresets,
} from "~/features/user";

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

    const pagination = { total: 1, pages: 1, currentPage: 1, limit: 20 };
    (getScheduledPosts as ReturnType<typeof vi.fn>).mockResolvedValue({
      posts: mockPosts,
      pagination,
    });
    (getScheduledLongFormPosts as ReturnType<typeof vi.fn>).mockResolvedValue({
      posts: mockLongformPosts,
      pagination,
    });
    (getScheduledRepostsCount as ReturnType<typeof vi.fn>).mockResolvedValue(0);
    (getUserById as ReturnType<typeof vi.fn>).mockResolvedValue(mockUser);
    (getQueueTypes as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockQueueTypes
    );
    (getUserHashTagPresets as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockHashTagPresets
    );

    const result = await loadScheduledData(TEST_USER_ID, "all");

    expect(result.posts).toHaveLength(1);
    expect(result.posts[0]).toMatchObject(mockPosts[0] as object);
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

    const pagination = { total: 1, pages: 1, currentPage: 1, limit: 20 };
    (getScheduledPosts as ReturnType<typeof vi.fn>).mockResolvedValue({
      posts: mockPosts,
      pagination,
    });
    (getScheduledLongFormPosts as ReturnType<typeof vi.fn>).mockResolvedValue({
      posts: mockLongformPosts,
      pagination,
    });
    (getScheduledRepostsCount as ReturnType<typeof vi.fn>).mockResolvedValue(0);
    (getUserById as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: TEST_USER_ID,
    });
    (getQueueTypes as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (getUserHashTagPresets as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    const result = await loadScheduledData(TEST_USER_ID, "Queue 1");

    expect(getScheduledPosts).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: TEST_USER_ID,
        queueType: "Queue 1",
      })
    );
    expect(result.selectedQueueType).toBe("Queue 1");
  });
});
