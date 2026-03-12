/**
 * Integration tests for longform edit loader
 * Tests app/features/posts/services/longform-edit-loader.server.ts
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock dependencies
vi.mock("~/features/posts/server", () => ({
  getLongFormPost: vi.fn(),
}));

vi.mock("~/features/user", () => ({
  getUserById: vi.fn(),
  getScheduleInterval: vi.fn(),
  getQueueTypes: vi.fn(),
  getUserHashTagPresets: vi.fn(),
}));

vi.mock("~/features/posts/repositories/draft-version-data.server", () => ({
  findDraftVersionsByPostId: vi.fn().mockResolvedValue([]),
  findDraftVersionsByLongFormPostId: vi.fn().mockResolvedValue([]),
}));

import { TEST_USER_ID, TEST_LONGFORM_ID } from "../../../utils/test-helpers";

import { getLongFormPost } from "~/features/posts/server";
import { loadLongFormEditData } from "~/features/posts/server/longform";
import {
  getUserById,
  getScheduleInterval,
  getQueueTypes,
  getUserHashTagPresets,
} from "~/features/user";

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

    (getLongFormPost as ReturnType<typeof vi.fn>).mockResolvedValue(mockPost);
    (getUserById as ReturnType<typeof vi.fn>).mockResolvedValue(mockUser);
    (getScheduleInterval as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockScheduleIntervals
    );
    (getQueueTypes as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockQueueTypes
    );
    (getUserHashTagPresets as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: "preset-1", name: "Default", tags: mockTags },
      ...mockHashTagPresets,
    ]);

    const result = await loadLongFormEditData(TEST_USER_ID, TEST_LONGFORM_ID);

    expect(result.post).toEqual(mockPost);
    expect(result.userId).toBe(TEST_USER_ID);
    expect(result.tags).toBe(mockTags);
    expect(result.scheduleIntervals).toEqual(mockScheduleIntervals);
    expect(result.queueTypes).toEqual(mockQueueTypes);
    expect(result.userTimezone).toBe("America/New_York");
    expect(result.hashtagPresets).toEqual([
      { id: "preset-1", name: "Default", tags: mockTags },
      ...mockHashTagPresets,
    ]);
  });

  it("should throw 404 if post not found", async () => {
    (getLongFormPost as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (getUserHashTagPresets as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: "preset-1", name: "Default", tags: "" },
    ]);
    (getUserById as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: TEST_USER_ID,
    });
    (getScheduleInterval as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (getQueueTypes as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (getUserHashTagPresets as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    await expect(
      loadLongFormEditData(TEST_USER_ID, TEST_LONGFORM_ID)
    ).rejects.toThrow();
  });

  it("should use default timezone if user timezone is missing", async () => {
    const mockPost = { id: TEST_LONGFORM_ID, userId: TEST_USER_ID };
    const mockUser = { id: TEST_USER_ID };

    (getLongFormPost as ReturnType<typeof vi.fn>).mockResolvedValue(mockPost);
    (getUserHashTagPresets as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: "preset-1", name: "Default", tags: "" },
    ]);
    (getUserById as ReturnType<typeof vi.fn>).mockResolvedValue(mockUser);
    (getScheduleInterval as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (getQueueTypes as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (getUserHashTagPresets as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    const result = await loadLongFormEditData(TEST_USER_ID, TEST_LONGFORM_ID);

    expect(result.userTimezone).toBe("Etc/GMT");
  });
});
