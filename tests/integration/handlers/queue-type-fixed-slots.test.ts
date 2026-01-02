/**
 * Integration tests for queue type handler - FIXED_SLOTS logic
 * Tests app/features/posts/handlers/queue-type.handler.ts (lines 211, 229-283)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock dependencies
vi.mock("~/features/posts/services/queue-type-resolver.server", () => ({
  resolveQueueTypeId: vi.fn(),
}));

vi.mock("~/features/posts/handlers/hashtag.handler", () => ({
  updateDisplayedHashtags: vi.fn(),
}));

import { handleBulkQueueUpdate } from "~/features/posts/handlers/queue-type.handler";
import { resolveQueueTypeId } from "~/features/posts/services/queue-type-resolver.server";
import type { BulkPost, QueueType } from "~/features/posts/types";

import { TEST_USER_ID } from "../../utils/test-helpers";


describe("Queue Type Handler - FIXED_SLOTS Logic", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should calculate FIXED_SLOTS schedule times correctly", async () => {
    const posts: BulkPost[] = [
      { file: null, caption: "", queueType: "Queue 1", scheduledFor: "", isRecyclable: false },
      { file: null, caption: "", queueType: "Queue 1", scheduledFor: "", isRecyclable: false },
      { file: null, caption: "", queueType: "Queue 1", scheduledFor: "", isRecyclable: false },
    ];

    const queueTypes: QueueType[] = [
      {
        id: "queue-1",
        name: "Queue 1",
        scheduleType: "FIXED_SLOTS" as const,
        scheduleConfig: {
          slots: ["09:00", "12:00", "15:00", "18:00"],
        },
      },
    ];

    const user = {
      id: TEST_USER_ID,
      timezone: "UTC",
      scheduleInterval: [4],
    };

    const setPosts = vi.fn();
    const setDisplayedHashtags = vi.fn();
    const setSelectedQueueType = vi.fn();

    // Mock fetch to return base time
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ scheduledTime: "2024-12-25T10:00" }),
    });

    (resolveQueueTypeId as ReturnType<typeof vi.fn>).mockResolvedValue("queue-1");

    await handleBulkQueueUpdate("Queue 1", {
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
    const updatedPosts = setPosts.mock.calls[0][0] as BulkPost[];
    expect(updatedPosts).toHaveLength(3);
    // First post should use the next slot after 10:00 (which is 12:00)
    expect(updatedPosts[0].scheduledFor).toMatch(/2024-12-25T12:00/);
    // Second post should use 15:00
    expect(updatedPosts[1].scheduledFor).toMatch(/2024-12-25T15:00/);
    // Third post should use 18:00
    expect(updatedPosts[2].scheduledFor).toMatch(/2024-12-25T18:00/);
  });

  it("should wrap to next day when slots are exhausted", async () => {
    const posts: BulkPost[] = [
      { file: null, caption: "", queueType: "Queue 1", scheduledFor: "", isRecyclable: false },
      { file: null, caption: "", queueType: "Queue 1", scheduledFor: "", isRecyclable: false },
      { file: null, caption: "", queueType: "Queue 1", scheduledFor: "", isRecyclable: false },
    ];

    const queueTypes: QueueType[] = [
      {
        id: "queue-1",
        name: "Queue 1",
        scheduleType: "FIXED_SLOTS" as const,
        scheduleConfig: {
          slots: ["09:00", "12:00", "15:00", "18:00"],
        },
      },
    ];

    const user = { id: TEST_USER_ID, timezone: "UTC" };
    const setPosts = vi.fn();
    const setDisplayedHashtags = vi.fn();
    const setSelectedQueueType = vi.fn();

    // Mock fetch to return base time
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ scheduledTime: "2024-12-25T15:00" }),
    });

    (resolveQueueTypeId as ReturnType<typeof vi.fn>).mockResolvedValue("queue-1");

    await handleBulkQueueUpdate("Queue 1", {
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
    const updatedPosts = setPosts.mock.calls[0][0] as BulkPost[];
    expect(updatedPosts).toHaveLength(3);
    // First post should use 15:00 (current slot)
    expect(updatedPosts[0].scheduledFor).toMatch(/2024-12-25T15:00/);
    // Second post should use 18:00
    expect(updatedPosts[1].scheduledFor).toMatch(/2024-12-25T18:00/);
    // Third post should wrap to next day 09:00
    expect(updatedPosts[2].scheduledFor).toMatch(/2024-12-26T09:00/);
  });

  it("should handle useGlobalInterval for INTERVAL schedule type", async () => {
    const posts: BulkPost[] = [
      { file: null, caption: "", queueType: "Queue 1", scheduledFor: "", isRecyclable: false },
      { file: null, caption: "", queueType: "Queue 1", scheduledFor: "", isRecyclable: false },
    ];

    const queueTypes: QueueType[] = [
      {
        id: "queue-1",
        name: "Queue 1",
        scheduleType: "INTERVAL" as const,
        scheduleConfig: {
          useGlobalInterval: true,
        },
      },
    ];

    const user = {
      id: TEST_USER_ID,
      timezone: "UTC",
      scheduleInterval: [6], // 6 hours
    };

    const setPosts = vi.fn();
    const setDisplayedHashtags = vi.fn();
    const setSelectedQueueType = vi.fn();

    // Mock fetch to return base time
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ scheduledTime: "2024-12-25T10:00" }),
    });

    (resolveQueueTypeId as ReturnType<typeof vi.fn>).mockResolvedValue("queue-1");

    await handleBulkQueueUpdate("Queue 1", {
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
    const updatedPosts = setPosts.mock.calls[0][0] as BulkPost[];
    expect(updatedPosts).toHaveLength(2);
    // First post: 10:00 + 0 hours = 10:00
    expect(updatedPosts[0].scheduledFor).toMatch(/2024-12-25T10:00/);
    // Second post: 10:00 + 6 hours = 16:00
    expect(updatedPosts[1].scheduledFor).toMatch(/2024-12-25T16:00/);
  });

  it("should use queue-specific interval when useGlobalInterval is false", async () => {
    const posts: BulkPost[] = [
      { file: null, caption: "", queueType: "Queue 1", scheduledFor: "", isRecyclable: false },
      { file: null, caption: "", queueType: "Queue 1", scheduledFor: "", isRecyclable: false },
    ];

    const queueTypes: QueueType[] = [
      {
        id: "queue-1",
        name: "Queue 1",
        scheduleType: "INTERVAL" as const,
        scheduleConfig: {
          useGlobalInterval: false,
          intervalHours: 8,
        },
      },
    ];

    const user = {
      id: TEST_USER_ID,
      timezone: "UTC",
      scheduleInterval: [4], // Should be ignored
    };

    const setPosts = vi.fn();
    const setDisplayedHashtags = vi.fn();
    const setSelectedQueueType = vi.fn();

    // Mock fetch to return base time
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ scheduledTime: "2024-12-25T10:00" }),
    });

    (resolveQueueTypeId as ReturnType<typeof vi.fn>).mockResolvedValue("queue-1");

    await handleBulkQueueUpdate("Queue 1", {
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
    const updatedPosts = setPosts.mock.calls[0][0] as BulkPost[];
    expect(updatedPosts).toHaveLength(2);
    // First post: 10:00 + 0 hours = 10:00
    expect(updatedPosts[0].scheduledFor).toMatch(/2024-12-25T10:00/);
    // Second post: 10:00 + 8 hours = 18:00
    expect(updatedPosts[1].scheduledFor).toMatch(/2024-12-25T18:00/);
  });

  it("should handle unassigned queue type", async () => {
    const posts: BulkPost[] = [
      { file: null, caption: "", queueType: "unassigned", scheduledFor: "", isRecyclable: false },
    ];

    const queueTypes: QueueType[] = [];
    const user = { id: TEST_USER_ID, timezone: "UTC" };
    const setPosts = vi.fn();
    const setDisplayedHashtags = vi.fn();
    const setSelectedQueueType = vi.fn();

    (resolveQueueTypeId as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    await handleBulkQueueUpdate("unassigned", {
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
    const updatedPosts = setPosts.mock.calls[0][0] as BulkPost[];
    expect(updatedPosts).toHaveLength(1);
    expect(updatedPosts[0].scheduledFor).toBe("");
  });

  it("should sort slots correctly by time", async () => {
    const posts: BulkPost[] = [
      { file: null, caption: "", queueType: "Queue 1", scheduledFor: "", isRecyclable: false },
    ];

    const queueTypes: QueueType[] = [
      {
        id: "queue-1",
        name: "Queue 1",
        scheduleType: "FIXED_SLOTS" as const,
        scheduleConfig: {
          slots: ["18:00", "09:00", "15:00", "12:00"], // Unsorted
        },
      },
    ];

    const user = { id: TEST_USER_ID, timezone: "UTC" };
    const setPosts = vi.fn();
    const setDisplayedHashtags = vi.fn();
    const setSelectedQueueType = vi.fn();

    // Mock fetch to return base time
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ scheduledTime: "2024-12-25T10:00" }),
    });

    (resolveQueueTypeId as ReturnType<typeof vi.fn>).mockResolvedValue("queue-1");

    await handleBulkQueueUpdate("Queue 1", {
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
    const updatedPosts = setPosts.mock.calls[0][0] as BulkPost[];
    expect(updatedPosts).toHaveLength(1);
    // Should use 12:00 (next slot after 10:00, sorted correctly)
    expect(updatedPosts[0].scheduledFor).toMatch(/2024-12-25T12:00/);
  });

  it("should handle empty slots array", async () => {
    const posts: BulkPost[] = [
      { file: null, caption: "", queueType: "Queue 1", scheduledFor: "", isRecyclable: false },
    ];

    const queueTypes: QueueType[] = [
      {
        id: "queue-1",
        name: "Queue 1",
        scheduleType: "FIXED_SLOTS" as const,
        scheduleConfig: {
          slots: [],
        },
      },
    ];

    const user = { id: TEST_USER_ID, timezone: "UTC" };
    const setPosts = vi.fn();
    const setDisplayedHashtags = vi.fn();
    const setSelectedQueueType = vi.fn();

    // Mock fetch to return base time
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ scheduledTime: "2024-12-25T10:00" }),
    });

    (resolveQueueTypeId as ReturnType<typeof vi.fn>).mockResolvedValue("queue-1");

    await handleBulkQueueUpdate("Queue 1", {
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
    const updatedPosts = setPosts.mock.calls[0][0] as BulkPost[];
    expect(updatedPosts).toHaveLength(1);
    // Should not set scheduledFor if no slots
    expect(updatedPosts[0].scheduledFor).toBe("");
  });

  it("should handle missing scheduleInterval in user", async () => {
    const posts: BulkPost[] = [
      { file: null, caption: "", queueType: "Queue 1", scheduledFor: "", isRecyclable: false },
    ];

    const queueTypes: QueueType[] = [
      {
        id: "queue-1",
        name: "Queue 1",
        scheduleType: "INTERVAL" as const,
        scheduleConfig: {
          useGlobalInterval: true,
        },
      },
    ];

    const user = { id: TEST_USER_ID, timezone: "UTC" }; // No scheduleInterval
    const setPosts = vi.fn();
    const setDisplayedHashtags = vi.fn();
    const setSelectedQueueType = vi.fn();

    // Mock fetch to return base time
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ scheduledTime: "2024-12-25T10:00" }),
    });

    (resolveQueueTypeId as ReturnType<typeof vi.fn>).mockResolvedValue("queue-1");

    await handleBulkQueueUpdate("Queue 1", {
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
    const updatedPosts = setPosts.mock.calls[0][0] as BulkPost[];
    expect(updatedPosts).toHaveLength(1);
    // First post (index 0) should be at base time, not base time + interval
    // The interval is used for spacing subsequent posts (index * intervalHours)
    expect(updatedPosts[0].scheduledFor).toMatch(/2024-12-25T10:00/);
  });
});

