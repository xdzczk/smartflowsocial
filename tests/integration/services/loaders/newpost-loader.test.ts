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
  getUserById: vi.fn(),
}));

vi.mock("~/features/relays/relay-resolution.server", () => ({
  loadComposerRelayLists: vi.fn().mockResolvedValue({
    accountPublishRelaySource: "app",
    default: ["wss://relay.example.com"],
    app: ["wss://relay.example.com"],
    nip65Profile: ["wss://profile.relay.example.com"],
  }),
}));

vi.mock("~/features/templates/services/template-data.server", () => ({
  getTemplates: vi.fn().mockResolvedValue([]),
  getTemplatePrefill: vi.fn().mockResolvedValue(null),
}));

vi.mock("~/features/posts/server", () => ({
  getPostById: vi.fn(),
}));

import { TEST_USER_ID } from "../../../utils/test-helpers";

import { requireAnySubscription } from "~/features/payments/subscriptions.server";
import { getPostById } from "~/features/posts/server";
import { loadNewPostData } from "~/features/posts/server/composer";
import {
  getScheduleInterval,
  getQueueTypes,
  getUserHashTagPresets,
  getUserById,
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
    (getUserById as ReturnType<typeof vi.fn>).mockResolvedValue({
      username: "tester",
      name: "Tester",
    });

    const result = await loadNewPostData(TEST_USER_ID);

    expect(requireAnySubscription).toHaveBeenCalledWith(TEST_USER_ID);
    expect(result.scheduleIntervals).toEqual(mockScheduleIntervals);
    expect(result.queueTypes).toEqual(mockQueueTypes);
    expect(result.hashTagPresets).toEqual(mockHashTagPresets);
    expect(result).toHaveProperty("initialPollRestore", null);
  });

  it("hydrates scheduled edit context without creating a draft id", async () => {
    (requireAnySubscription as ReturnType<typeof vi.fn>).mockResolvedValue(
      undefined
    );
    (getScheduleInterval as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (getQueueTypes as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: "q1", name: "Main queue" },
    ]);
    (getUserHashTagPresets as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (getUserById as ReturnType<typeof vi.fn>).mockResolvedValue({
      username: "tester",
      name: "Tester",
    });
    (getPostById as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "scheduled-1",
      content: "Scheduled content",
      caption: "Scheduled content",
      fileUrl: ["https://cdn.example.com/a.png"],
      queueType: { id: "q1", name: "Main queue" },
      queueTypeId: "q1",
      tags: ["one", "two"],
      draftMeta: null,
      hashTagPresetId: null,
      currentState: "SCHEDULED",
      scheduledAtUtc: new Date("2026-04-10T09:00:00.000Z"),
      parentScheduledActionId: null,
    });

    const result = await loadNewPostData(TEST_USER_ID, {
      composerContext: {
        mode: "edit_scheduled",
        scheduledActionId: "scheduled-1",
      },
    });
    const typedResult = result as {
      initialDraftId: string | null;
      initialDraft: { content?: string } | null;
      composerContext: { mode: string };
      hydrationStatus: string;
    };
    expect(typedResult.initialDraftId).toBeNull();
    expect(typedResult.initialDraft?.content).toBe("Scheduled content");
    expect(typedResult.composerContext.mode).toBe("edit_scheduled");
    expect(typedResult.hydrationStatus).toBe("ready");
  });

  it("should require subscription before loading", async () => {
    (requireAnySubscription as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("Subscription required")
    );
    (getScheduleInterval as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (getQueueTypes as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (getUserHashTagPresets as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (getUserById as ReturnType<typeof vi.fn>).mockResolvedValue({
      username: "tester",
      name: "Tester",
    });

    await expect(loadNewPostData(TEST_USER_ID)).rejects.toThrow(
      "Subscription required"
    );
  });
});
