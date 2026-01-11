/**
 * Integration tests for hashtag preset handling in new longform handler
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

import "./shared-setup";
import { TEST_USER_ID, createMockFormData } from "../../utils/test-helpers";

import { mockPrisma, mockCreateLongFormPostExecute } from "./shared-setup";

import { handleNewLongFormAction } from "~/features/posts/services/newlongform-action.server";
import { getQueueTypes, getHashTagPresetById } from "~/features/user";

describe("Hashtag Preset Handling", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env["NOSTR_PUBLISHER_URL"] =
      "https://api.nostr-publisher.com/publish";
    mockCreateLongFormPostExecute.mockResolvedValue({
      post: {
        id: "longform-123",
        title: "Test Post",
        isPublished: false,
      },
      needsScheduling: false,
    });
  });

  it("should use manual hashtag preset when enabled", async () => {
    (
      mockPrisma.queueType.findFirst as ReturnType<typeof vi.fn>
    ).mockResolvedValue({
      id: "queue-1",
    });
    (getHashTagPresetById as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "preset-1",
      tags: "#custom #tags",
    });

    const formData = createMockFormData({
      _action: "save-draft",
      title: "Test Post",
      content: "Test content",
      useHashtagPresets: "on",
      hashTagPresetId: "preset-1",
      queueType: "posts",
    });

    const request = new Request("http://localhost:3000/dashboard/newlongform", {
      method: "POST",
      body: formData,
    });

    await handleNewLongFormAction(TEST_USER_ID, request);

    expect(getHashTagPresetById).toHaveBeenCalledWith(TEST_USER_ID, "preset-1");
    expect(mockCreateLongFormPostExecute).toHaveBeenCalledWith(
      // expect.objectContaining returns 'any' - acceptable for test mocks
      expect.objectContaining({
        hashTagPresetId: "preset-1",
      })
    );
  });

  it("should use queue type default when manual presets disabled", async () => {
    (
      mockPrisma.queueType.findFirst as ReturnType<typeof vi.fn>
    ).mockResolvedValue({
      id: "queue-1",
    });
    (getQueueTypes as ReturnType<typeof vi.fn>).mockResolvedValue([
      {
        id: "queue-1",
        name: "posts",
        hashTagPreset: {
          id: "preset-1",
          tags: "#queue #tags",
        },
      },
    ]);

    const formData = createMockFormData({
      _action: "save-draft",
      title: "Test Post",
      content: "Test content",
      useHashtagPresets: "off",
      queueType: "posts",
    });

    const request = new Request("http://localhost:3000/dashboard/newlongform", {
      method: "POST",
      body: formData,
    });

    await handleNewLongFormAction(TEST_USER_ID, request);

    expect(getQueueTypes).toHaveBeenCalledWith(TEST_USER_ID);
    expect(mockCreateLongFormPostExecute).toHaveBeenCalledWith(
      // expect.objectContaining returns 'any' - acceptable for test mocks
      expect.objectContaining({
        hashTagPresetId: "preset-1",
      })
    );
  });
});
