/**
 * Integration tests for new post loader
 * Tests app/features/posts/services/newpost-loader.server.ts
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock dependencies
vi.mock("~/features/payments/subscriptions.server", () => ({
  requireAnySubscription: vi.fn(),
}));

vi.mock("~/models/asset.server", () => ({
  getAssets: vi.fn(),
}));

vi.mock("~/models/user.server", () => ({
  getScheduleInterval: vi.fn(),
  getQueueTypes: vi.fn(),
  getUserHashTagPresets: vi.fn(),
}));

import { requireAnySubscription } from "~/features/payments/subscriptions.server";
import { loadNewPostData } from "~/features/posts/services/newpost-loader.server";
import { getAssets } from "~/models/asset.server";
import {
  getScheduleInterval,
  getQueueTypes,
  getUserHashTagPresets,
} from "~/models/user.server";

import { TEST_USER_ID } from "../../../utils/test-helpers";

describe("New Post Loader", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should load new post data", async () => {
    const mockScheduleIntervals = ["4", "6", "8"];
    const mockQueueTypes = [{ id: "queue-1", name: "Queue 1" }];
    const mockHashTagPresets = [{ id: "preset-1", name: "Preset 1" }];
    const mockAssets = {
      assets: [{ id: "asset-1", title: "Asset 1" }],
      totalCount: 1,
      totalPages: 1,
      currentPage: 1,
    };

    (requireAnySubscription as ReturnType<typeof vi.fn>).mockResolvedValue(
      undefined,
    );
    (getScheduleInterval as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockScheduleIntervals,
    );
    (getQueueTypes as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockQueueTypes,
    );
    (getUserHashTagPresets as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockHashTagPresets,
    );
    (getAssets as ReturnType<typeof vi.fn>).mockResolvedValue(mockAssets);

    const result = await loadNewPostData(TEST_USER_ID);

    expect(requireAnySubscription).toHaveBeenCalledWith(TEST_USER_ID);
    expect(result.scheduleIntervals).toEqual(mockScheduleIntervals);
    expect(result.queueTypes).toEqual(mockQueueTypes);
    expect(result.hashTagPresets).toEqual(mockHashTagPresets);
    expect(result.assets).toEqual(mockAssets.assets);
  });

  it("should require subscription before loading", async () => {
    (requireAnySubscription as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("Subscription required"),
    );
    (getScheduleInterval as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (getQueueTypes as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (getUserHashTagPresets as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (getAssets as ReturnType<typeof vi.fn>).mockResolvedValue({
      assets: [],
      totalCount: 0,
      totalPages: 0,
      currentPage: 1,
    });

    await expect(loadNewPostData(TEST_USER_ID)).rejects.toThrow(
      "Subscription required",
    );
  });
});

