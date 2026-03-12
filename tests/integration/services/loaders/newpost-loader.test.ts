/**
 * Integration tests for new post loader
 * Tests app/features/posts/composer/services/newpost-loader.server.ts
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("~/features/payments/subscriptions.server", () => ({
  requireAnySubscription: vi.fn(),
}));

vi.mock("~/features/user", () => ({
  getScheduleInterval: vi.fn(),
  getQueueTypes: vi.fn(),
  getUserHashTagPresets: vi.fn(),
}));

vi.mock("~/features/relays/relay-resolution.server", () => ({
  resolveExecutionRelays: vi
    .fn()
    .mockResolvedValue(["wss://relay.example.com"]),
}));

vi.mock("~/features/templates/services/template-data.server", () => ({
  getTemplates: vi.fn().mockResolvedValue([]),
  getTemplatePrefill: vi.fn().mockResolvedValue(null),
}));

import { TEST_USER_ID } from "../../../utils/test-helpers";

import { requireAnySubscription } from "~/features/payments/subscriptions.server";
import { loadNewPostData } from "~/features/posts/server/composer";
import {
  getScheduleInterval,
  getQueueTypes,
  getUserHashTagPresets,
} from "~/features/user";

describe("New Post Loader", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should load new post data", async () => {
    const mockScheduleIntervals = ["4", "6", "8"];
    const mockQueueTypes = [{ id: "queue-1", name: "Queue 1" }];
    const mockHashTagPresets = [{ id: "preset-1", name: "Preset 1" }];

    (requireAnySubscription as ReturnType<typeof vi.fn>).mockResolvedValue(
      undefined
    );
    (getScheduleInterval as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockScheduleIntervals
    );
    (getQueueTypes as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockQueueTypes
    );
    (getUserHashTagPresets as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockHashTagPresets
    );

    const result = await loadNewPostData(TEST_USER_ID);

    expect(requireAnySubscription).toHaveBeenCalledWith(TEST_USER_ID);
    expect(result.scheduleIntervals).toEqual(mockScheduleIntervals);
    expect(result.queueTypes).toEqual(mockQueueTypes);
    expect(result.hashTagPresets).toEqual(mockHashTagPresets);
  });

  it("should require subscription before loading", async () => {
    (requireAnySubscription as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("Subscription required")
    );
    (getScheduleInterval as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (getQueueTypes as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (getUserHashTagPresets as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    await expect(loadNewPostData(TEST_USER_ID)).rejects.toThrow(
      "Subscription required"
    );
  });
});
