/**
 * Integration tests for longform edit loader
 * Tests app/features/posts/services/longform-edit-loader.server.ts
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock dependencies
vi.mock("~/models/asset.server", () => ({
  getAssets: vi.fn(),
}));

vi.mock("~/models/longformpost.server", () => ({
  getLongFormPost: vi.fn(),
}));

vi.mock("~/models/user.server", () => ({
  getUserHashTags: vi.fn(),
  getUserById: vi.fn(),
  getScheduleInterval: vi.fn(),
  getQueueTypes: vi.fn(),
  getUserHashTagPresets: vi.fn(),
}));

import { loadLongFormEditData } from "~/features/posts/services/longform-edit-loader.server";
import { getAssets } from "~/models/asset.server";
import { getLongFormPost } from "~/models/longformpost.server";
import {
  getUserHashTags,
  getUserById,
  getScheduleInterval,
  getQueueTypes,
  getUserHashTagPresets,
} from "~/models/user.server";

import { TEST_USER_ID, TEST_LONGFORM_ID } from "../../../utils/test-helpers";

describe("Longform Edit Loader", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should load longform edit data", async () => {
    const mockPost = {
      id: TEST_LONGFORM_ID,
      userId: TEST_USER_ID,
      title: "Test Post",
    };
    const mockTags = "tag1 tag2";
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

    (getLongFormPost as ReturnType<typeof vi.fn>).mockResolvedValue(mockPost);
    (getUserHashTags as ReturnType<typeof vi.fn>).mockResolvedValue(mockTags);
    (getUserById as ReturnType<typeof vi.fn>).mockResolvedValue(mockUser);
    (getScheduleInterval as ReturnType<typeof vi.fn>).mockResolvedValue(mockScheduleIntervals);
    (getQueueTypes as ReturnType<typeof vi.fn>).mockResolvedValue(mockQueueTypes);
    (getUserHashTagPresets as ReturnType<typeof vi.fn>).mockResolvedValue(mockHashTagPresets);
    (getAssets as ReturnType<typeof vi.fn>).mockResolvedValue(mockAssets);

    const result = await loadLongFormEditData(TEST_USER_ID, TEST_LONGFORM_ID);

    expect(result.post).toEqual(mockPost);
    expect(result.userId).toBe(TEST_USER_ID);
    expect(result.tags).toBe(mockTags);
    expect(result.scheduleIntervals).toEqual(mockScheduleIntervals);
    expect(result.queueTypes).toEqual(mockQueueTypes);
    expect(result.assets).toEqual(mockAssets.assets);
    expect(result.userTimezone).toBe("America/New_York");
    expect(result.hashtagPresets).toEqual(mockHashTagPresets);
  });

  it("should throw 404 if post not found", async () => {
    (getLongFormPost as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (getUserHashTags as ReturnType<typeof vi.fn>).mockResolvedValue("");
    (getUserById as ReturnType<typeof vi.fn>).mockResolvedValue({ id: TEST_USER_ID });
    (getScheduleInterval as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (getQueueTypes as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (getUserHashTagPresets as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (getAssets as ReturnType<typeof vi.fn>).mockResolvedValue({ assets: [], totalCount: 0, totalPages: 0, currentPage: 1 });

    await expect(loadLongFormEditData(TEST_USER_ID, TEST_LONGFORM_ID)).rejects.toThrow();
  });

  it("should use default timezone if user timezone is missing", async () => {
    const mockPost = { id: TEST_LONGFORM_ID, userId: TEST_USER_ID };
    const mockUser = { id: TEST_USER_ID };

    (getLongFormPost as ReturnType<typeof vi.fn>).mockResolvedValue(mockPost);
    (getUserHashTags as ReturnType<typeof vi.fn>).mockResolvedValue("");
    (getUserById as ReturnType<typeof vi.fn>).mockResolvedValue(mockUser);
    (getScheduleInterval as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (getQueueTypes as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (getUserHashTagPresets as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (getAssets as ReturnType<typeof vi.fn>).mockResolvedValue({ assets: [], totalCount: 0, totalPages: 0, currentPage: 1 });

    const result = await loadLongFormEditData(TEST_USER_ID, TEST_LONGFORM_ID);

    expect(result.userTimezone).toBe("Etc/GMT");
  });
});

