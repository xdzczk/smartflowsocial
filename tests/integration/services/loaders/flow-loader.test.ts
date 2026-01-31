/**
 * Integration tests for Flow loader
 * Tests app/features/posts/services/flow-loader.server.ts
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("~/models/longformpost.server", () => ({
  getScheduledLongFormPosts: vi.fn(),
  getPastLongFormPosts: vi.fn(),
}));

vi.mock("~/models/post.queries.server", () => ({
  getScheduledPosts: vi.fn(),
  getPastPosts: vi.fn(),
}));

vi.mock("~/features/user/services/user-cache.server", () => ({
  getQueueTypesCached: vi.fn(),
  getHashTagPresetsCached: vi.fn(),
}));

vi.mock("~/features/user", () => ({
  getUserById: vi.fn(),
}));

vi.mock("~/features/posts/services/post-filtering.server", () => ({
  filterPostsByQueueType: vi.fn((posts: unknown[]) => posts),
}));

import { TEST_USER_ID } from "../../../utils/test-helpers";

import { loadFlowData } from "~/features/posts/services/flow-loader.server";
import { getUserById } from "~/features/user";
import {
  getQueueTypesCached,
  getHashTagPresetsCached,
} from "~/features/user/services/user-cache.server";
import {
  getScheduledLongFormPosts,
  getPastLongFormPosts,
} from "~/models/longformpost.server";
import { getScheduledPosts, getPastPosts } from "~/models/post.queries.server";

describe("Flow Loader", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (getPastPosts as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (getPastLongFormPosts as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (getScheduledPosts as ReturnType<typeof vi.fn>).mockResolvedValue({
      posts: [],
      pagination: { total: 0, pages: 0, currentPage: 1, limit: 30 },
    });
    (getScheduledLongFormPosts as ReturnType<typeof vi.fn>).mockResolvedValue({
      posts: [],
      pagination: { total: 0, pages: 0, currentPage: 1, limit: 30 },
    });
    (getUserById as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: TEST_USER_ID,
      timezone: "UTC",
    });
    (getQueueTypesCached as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (getHashTagPresetsCached as ReturnType<typeof vi.fn>).mockResolvedValue([]);
  });

  it("should return Flow loader shape (flowItems, hasMorePast, hasMoreFuture, cursors)", async () => {
    const result = await loadFlowData({
      userId: TEST_USER_ID,
      queueType: "all",
    });

    expect(result).toHaveProperty("flowItems");
    expect(Array.isArray(result.flowItems)).toBe(true);
    expect(result).toHaveProperty("hasMorePast", false);
    expect(result).toHaveProperty("hasMoreFuture", false);
    expect(result).toHaveProperty("pastCursor");
    expect(result).toHaveProperty("futureCursor");
    expect(result).toHaveProperty("user");
    expect(result).toHaveProperty("queueTypes");
    expect(result).toHaveProperty("hashTagPresets");
  });

  it("should call past and scheduled queries for initial load", async () => {
    await loadFlowData({
      userId: TEST_USER_ID,
      queueType: "all",
    });

    expect(getPastPosts).toHaveBeenCalled();
    expect(getPastLongFormPosts).toHaveBeenCalled();
    expect(getScheduledPosts).toHaveBeenCalled();
    expect(getScheduledLongFormPosts).toHaveBeenCalled();
  });

  it("should accept before cursor for load more past", async () => {
    const result = await loadFlowData({
      userId: TEST_USER_ID,
      queueType: "all",
      before: String(Date.now()),
    });

    expect(result.flowItems).toBeDefined();
    expect(result.hasMoreFuture).toBe(false);
  });

  it("should accept after cursor for load more future", async () => {
    const result = await loadFlowData({
      userId: TEST_USER_ID,
      queueType: "all",
      after: String(Date.now()),
    });

    expect(result.flowItems).toBeDefined();
    expect(result.hasMorePast).toBe(false);
  });
});
