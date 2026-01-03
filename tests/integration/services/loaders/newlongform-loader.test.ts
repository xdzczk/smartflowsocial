/**
 * Integration tests for new longform loader
 * Tests app/features/posts/services/newlongform-loader.server.ts
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock dependencies
vi.mock("~/features/payments/subscriptions.server", () => ({
  requireFeatureAccess: vi.fn(),
}));

vi.mock("~/models/asset.server", () => ({
  getAssets: vi.fn(),
}));

vi.mock("~/models/user.server", () => ({
  getUserHashTags: vi.fn(),
  getUserById: vi.fn(),
  getScheduleInterval: vi.fn(),
  getQueueTypes: vi.fn(),
  getUserHashTagPresets: vi.fn(),
  getUserUploadProvider: vi.fn(),
}));

import { requireFeatureAccess } from "~/features/payments/subscriptions.server";
import { loadNewLongFormData } from "~/features/posts/services/newlongform-loader.server";
import { getAssets } from "~/models/asset.server";
import {
  getUserHashTags,
  getUserById,
  getScheduleInterval,
  getQueueTypes,
  getUserHashTagPresets,
  getUserUploadProvider,
} from "~/models/user.server";

import { TEST_USER_ID } from "../../../utils/test-helpers";

describe("New Longform Loader", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should load new longform data", async () => {
    const mockTags = "tag1 tag2 tag3";
    const mockUser = { id: TEST_USER_ID, timezone: "America/New_York" };
    const mockScheduleIntervals = ["4", "6", "8"];
    const mockQueueTypes = [{ id: "queue-1", name: "Queue 1" }];
    const mockHashTagPresets = [{ id: "preset-1", name: "Preset 1" }];
    const mockAssets = {
      assets: [{ id: "asset-1", title: "Asset 1" }],
      totalCount: 1,
      totalPages: 1,
      currentPage: 1,
    };
    const mockUploadProvider = "s3";

    (requireFeatureAccess as ReturnType<typeof vi.fn>).mockResolvedValue(
      undefined,
    );
    (getUserHashTags as ReturnType<typeof vi.fn>).mockResolvedValue(mockTags);
    (getUserById as ReturnType<typeof vi.fn>).mockResolvedValue(mockUser);
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
    (getUserUploadProvider as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockUploadProvider,
    );

    const result = await loadNewLongFormData(TEST_USER_ID);

    expect(requireFeatureAccess).toHaveBeenCalledWith(
      TEST_USER_ID,
      "longformPosts",
    );
    expect(result.userId).toBe(TEST_USER_ID);
    expect(result.tags).toBe(mockTags);
    expect(result.scheduleIntervals).toEqual(mockScheduleIntervals);
    expect(result.queueTypes).toEqual(mockQueueTypes);
    expect(result.hashTagPresets).toEqual(mockHashTagPresets);
    expect(result.assets).toEqual(mockAssets.assets);
    expect(result.userTimezone).toBe("America/New_York");
    expect(result.uploadProvider).toBe(mockUploadProvider);
  });

  it("should use default timezone if user timezone is missing", async () => {
    const mockUser = { id: TEST_USER_ID };

    (requireFeatureAccess as ReturnType<typeof vi.fn>).mockResolvedValue(
      undefined,
    );
    (getUserHashTags as ReturnType<typeof vi.fn>).mockResolvedValue("");
    (getUserById as ReturnType<typeof vi.fn>).mockResolvedValue(mockUser);
    (getScheduleInterval as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (getQueueTypes as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (getUserHashTagPresets as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (getAssets as ReturnType<typeof vi.fn>).mockResolvedValue({
      assets: [],
      totalCount: 0,
      totalPages: 0,
      currentPage: 1,
    });
    (getUserUploadProvider as ReturnType<typeof vi.fn>).mockResolvedValue("s3");

    const result = await loadNewLongFormData(TEST_USER_ID);

    expect(result.userTimezone).toBe("Etc/GMT");
  });
});

