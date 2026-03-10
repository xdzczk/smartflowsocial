/**
 * Integration tests for queue type handler - WEEKLY_SLOTS logic
 * Tests app/features/posts/handlers/queue-type.handler.ts (calculateWeeklySlotsScheduleTime, parseWeeklySlotEntry, findNextWeeklySlotDate)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("~/features/posts/services/queue-type-resolver.server", () => ({
  resolveQueueTypeId: vi.fn(),
}));

vi.mock("~/features/posts/handlers/hashtag.handler", () => ({
  updateDisplayedHashtags: vi.fn(),
}));

import { TEST_USER_ID } from "../../utils/test-helpers";

import { handleBulkQueueUpdate } from "~/features/posts/handlers/queue-type.handler";
import { resolveQueueTypeId } from "~/features/posts/services/queue-type-resolver.server";
import type { BulkPost, QueueType } from "~/features/posts/types";

describe("Queue Type Handler - WEEKLY_SLOTS Logic", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should calculate WEEKLY_SLOTS schedule times correctly", async () => {
    const posts: BulkPost[] = [
      {
        clientId: "post-1",
        files: [],
        caption: "",
        queueType: "Weekly",
        scheduledFor: "",
        isRecyclable: false,
      },
      {
        clientId: "post-2",
        files: [],
        caption: "",
        queueType: "Weekly",
        scheduledFor: "",
        isRecyclable: false,
      },
    ];

    const queueTypes: QueueType[] = [
      {
        id: "queue-weekly",
        name: "Weekly",
        scheduleType: "WEEKLY_SLOTS" as const,
        scheduleConfig: {
          weeklySlots: [
            { dayOfWeek: 1, time: "09:00" },
            { dayOfWeek: 3, time: "14:00" },
            { dayOfWeek: 5, time: "18:00" },
          ],
        },
      },
    ];

    const user = {
      id: TEST_USER_ID,
      timezone: "UTC",
    };

    const setPosts = vi.fn();
    const setDisplayedHashtags = vi.fn();
    const setSelectedQueueType = vi.fn();

    // Base time: Monday 2024-12-23 08:00 UTC - next slot is Monday 09:00
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ scheduledTime: "2024-12-23T09:00" }),
    });

    (resolveQueueTypeId as ReturnType<typeof vi.fn>).mockResolvedValue(
      "queue-weekly"
    );

    await handleBulkQueueUpdate("Weekly", {
      posts,
      setPosts,
      queueTypes,
      tags: [],
      user,
      setDisplayedHashtags,
      setSelectedQueueType,
      firstItemTimeManuallyChanged: false,
    });

    expect(setPosts).toHaveBeenCalled();
    const callArgs = setPosts.mock.calls[0]?.[0] as unknown;
    if (!callArgs) {
      throw new Error("setPosts was not called with arguments");
    }
    const updatedPosts = callArgs as BulkPost[];
    expect(updatedPosts).toHaveLength(2);
    expect(updatedPosts[0]?.scheduledFor).toMatch(
      /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/
    );
    expect(updatedPosts[1]?.scheduledFor).toMatch(
      /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/
    );
  });

  it("should use fallback when WEEKLY_SLOTS config has invalid entries", async () => {
    const posts: BulkPost[] = [
      {
        clientId: "post-1",
        files: [],
        caption: "",
        queueType: "BadWeekly",
        scheduledFor: "",
        isRecyclable: false,
      },
    ];

    const queueTypes: QueueType[] = [
      {
        id: "queue-bad",
        name: "BadWeekly",
        scheduleType: "WEEKLY_SLOTS" as const,
        scheduleConfig: {
          weeklySlots: [
            { dayOfWeek: -1, time: "09:00" },
            { dayOfWeek: 8, time: "10:00" },
            { dayOfWeek: 1, time: "25:00" },
          ],
        },
      },
    ];

    const user = { id: TEST_USER_ID, timezone: "UTC" };
    const setPosts = vi.fn();
    const setDisplayedHashtags = vi.fn();
    const setSelectedQueueType = vi.fn();

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ scheduledTime: "2024-12-23T09:00" }),
    });

    (resolveQueueTypeId as ReturnType<typeof vi.fn>).mockResolvedValue(
      "queue-bad"
    );

    await handleBulkQueueUpdate("BadWeekly", {
      posts,
      setPosts,
      queueTypes,
      tags: [],
      user,
      setDisplayedHashtags,
      setSelectedQueueType,
      firstItemTimeManuallyChanged: false,
    });

    expect(setPosts).toHaveBeenCalled();
    const updatedPosts = setPosts.mock.calls[0]?.[0] as BulkPost[];
    expect(updatedPosts[0]?.scheduledFor).toBe("");
  });
});
