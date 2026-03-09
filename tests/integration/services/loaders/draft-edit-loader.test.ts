/**
 * Integration tests for draft edit loader
 * Tests app/features/posts/services/draft-edit-loader.server.ts
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock dependencies
vi.mock("~/models/post.queries.server", () => ({
  getPostById: vi.fn(),
}));

vi.mock("~/features/user", () => ({
  getUserById: vi.fn(),
  getQueueTypes: vi.fn(),
  getUserHashTagPresets: vi.fn(),
}));

import { TEST_USER_ID, TEST_POST_ID } from "../../../utils/test-helpers";

import { loadDraftEditData } from "~/features/posts/server";
import {
  getUserById,
  getQueueTypes,
  getUserHashTagPresets,
} from "~/features/user";
import { getPostById } from "~/models/post.queries.server";

describe("Draft Edit Loader", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should load draft edit data", async () => {
    const mockPost = {
      id: TEST_POST_ID,
      userId: TEST_USER_ID,
      currentState: "DRAFT", // Use currentState instead of draft flag
      content: "Draft content",
    };
    const mockUser = { id: TEST_USER_ID };
    const mockQueueTypes = [
      { id: "queue-1", name: "Queue 1", isEnabled: true },
      { id: "queue-2", name: "Queue 2", isEnabled: false },
    ];
    const mockHashTagPresets = [{ id: "preset-1", name: "Preset 1" }];

    (getPostById as ReturnType<typeof vi.fn>).mockResolvedValue(mockPost);
    (getUserById as ReturnType<typeof vi.fn>).mockResolvedValue(mockUser);
    (getQueueTypes as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockQueueTypes
    );
    (getUserHashTagPresets as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockHashTagPresets
    );

    const result = await loadDraftEditData(TEST_USER_ID, TEST_POST_ID);

    expect(result.post).toEqual(expect.objectContaining(mockPost));
    expect(result.user).toEqual(mockUser);
    expect(result.queueTypes).toHaveLength(1); // Only enabled
    expect(result.hashTagPresets).toEqual(mockHashTagPresets);
  });

  it("should throw 404 if post is not a draft", async () => {
    const mockPost = {
      id: TEST_POST_ID,
      userId: TEST_USER_ID,
      currentState: "SCHEDULED", // Use currentState instead of draft flag
    };

    (getPostById as ReturnType<typeof vi.fn>).mockResolvedValue(mockPost);
    (getUserById as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: TEST_USER_ID,
    });
    (getQueueTypes as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (getUserHashTagPresets as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    await expect(
      loadDraftEditData(TEST_USER_ID, TEST_POST_ID)
    ).rejects.toThrow();
  });

  it("should throw 404 if post not found", async () => {
    (getPostById as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (getUserById as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: TEST_USER_ID,
    });
    (getQueueTypes as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (getUserHashTagPresets as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    await expect(
      loadDraftEditData(TEST_USER_ID, TEST_POST_ID)
    ).rejects.toThrow();
  });

  it("should filter out disabled queue types", async () => {
    const mockPost = {
      id: TEST_POST_ID,
      userId: TEST_USER_ID,
      currentState: "DRAFT",
    };
    const mockQueueTypes = [
      { id: "queue-1", name: "Queue 1", isEnabled: true },
      { id: "queue-2", name: "Queue 2", isEnabled: false },
      { id: "queue-3", name: "Queue 3" }, // Missing isEnabled - treated as enabled
    ];

    (getPostById as ReturnType<typeof vi.fn>).mockResolvedValue(mockPost);
    (getUserById as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: TEST_USER_ID,
    });
    (getQueueTypes as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockQueueTypes
    );
    (getUserHashTagPresets as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    const result = await loadDraftEditData(TEST_USER_ID, TEST_POST_ID);

    // Filter checks isEnabled !== false, so undefined passes
    expect(result.queueTypes.length).toBeGreaterThanOrEqual(1);
    expect(result.queueTypes.some((qt) => qt.id === "queue-1")).toBe(true);
    expect(result.queueTypes.some((qt) => qt.id === "queue-2")).toBe(false);
  });
});
