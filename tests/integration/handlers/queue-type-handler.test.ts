/**
 * Integration tests for queue type handler
 * Tests handleQueueTypeChange and handleBulkQueueUpdate functions
 * in app/features/posts/handlers/queue-type.handler.ts
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import { updateDisplayedHashtags } from "~/features/posts/handlers/hashtag.handler";
import {
  handleQueueTypeChange,
  handleBulkQueueUpdate,
} from "~/features/posts/handlers/queue-type.handler";
import type { BulkPost, QueueType } from "~/features/posts/types";

// Mock dependencies
vi.mock("~/features/posts/handlers/hashtag.handler", () => ({
  updateDisplayedHashtags: vi.fn(),
}));

vi.mock("~/lib/error-handler.client", () => ({
  logClientError: vi.fn(),
}));

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("Queue Type Handler Integration Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(updateDisplayedHashtags).mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("handleQueueTypeChange", () => {
    it("should update post queue type", async () => {
      const posts: BulkPost[] = [
        {
          clientId: "post-1",
          files: [],
          caption: "",
          queueType: "unassigned",
          scheduledFor: "",
          isRecyclable: false,
        },
      ];
      const setPosts = vi.fn();
      const queueTypes: QueueType[] = [
        {
          id: "queue-1",
          name: "Morning",
        },
      ];
      const tags = ["tag1"];
      const user = { id: "user-1" };
      const setDisplayedHashtags = vi.fn();
      const setSelectedQueueType = vi.fn();

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ scheduledTime: "2024-01-15T10:00" }),
      });

      await handleQueueTypeChange(0, "Morning", {
        posts,
        setPosts,
        queueTypes,
        tags,
        user,
        setDisplayedHashtags,
        setSelectedQueueType,
      });

      expect(setPosts).toHaveBeenCalled();
      const updatedPosts = setPosts.mock.calls[0]?.[0] as
        | BulkPost[]
        | undefined;
      expect(updatedPosts?.[0]?.queueType).toBe("Morning");
    });

    it("should clear scheduledFor for unassigned queue type", async () => {
      const posts: BulkPost[] = [
        {
          clientId: "post-1",
          files: [],
          caption: "",
          queueType: "Morning",
          scheduledFor: "2024-01-15T10:00",
          isRecyclable: false,
        },
      ];
      const setPosts = vi.fn();
      const queueTypes: QueueType[] = [];
      const tags: string[] = [];
      const user = { id: "user-1" };
      const setDisplayedHashtags = vi.fn();
      const setSelectedQueueType = vi.fn();

      await handleQueueTypeChange(0, "unassigned", {
        posts,
        setPosts,
        queueTypes,
        tags,
        user,
        setDisplayedHashtags,
        setSelectedQueueType,
      });

      expect(setPosts).toHaveBeenCalled();
      const updatedPosts: BulkPost[] | undefined = setPosts.mock
        .calls[0]?.[0] as BulkPost[] | undefined;
      expect(updatedPosts?.[0]?.scheduledFor).toBe("");
    });

    it("should fetch scheduled time for assigned queue type", async () => {
      const posts: BulkPost[] = [
        {
          clientId: "post-1",
          files: [],
          caption: "",
          queueType: "unassigned",
          scheduledFor: "",
          isRecyclable: false,
        },
      ];
      const setPosts = vi.fn();
      const queueTypes: QueueType[] = [
        {
          id: "queue-1",
          name: "Morning",
        },
      ];
      const tags: string[] = [];
      const user = { id: "user-1" };
      const setDisplayedHashtags = vi.fn();
      const setSelectedQueueType = vi.fn();

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ scheduledTime: "2024-01-15T10:00" }),
      });

      await handleQueueTypeChange(0, "Morning", {
        posts,
        setPosts,
        queueTypes,
        tags,
        user,
        setDisplayedHashtags,
        setSelectedQueueType,
      });

      expect(mockFetch).toHaveBeenCalledWith("/api/queue-schedule", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          queueTypeId: "queue-1",
          queueTypeName: "Morning",
          userId: "user-1",
        }),
      });

      const updatedPosts: BulkPost[] | undefined = setPosts.mock
        .calls[0]?.[0] as BulkPost[] | undefined;
      expect(updatedPosts?.[0]?.scheduledFor).toBe("2024-01-15T10:00");
    });

    it("should handle API errors gracefully", async () => {
      const posts: BulkPost[] = [
        {
          clientId: "post-1",
          files: [],
          caption: "",
          queueType: "unassigned",
          scheduledFor: "",
          isRecyclable: false,
        },
      ];
      const setPosts = vi.fn();
      const queueTypes: QueueType[] = [
        {
          id: "queue-1",
          name: "Morning",
        },
      ];
      const tags: string[] = [];
      const user = { id: "user-1" };
      const setDisplayedHashtags = vi.fn();
      const setSelectedQueueType = vi.fn();

      mockFetch.mockRejectedValueOnce(new Error("Network error"));

      await handleQueueTypeChange(0, "Morning", {
        posts,
        setPosts,
        queueTypes,
        tags,
        user,
        setDisplayedHashtags,
        setSelectedQueueType,
      });

      // Should still update the queue type even if API fails
      expect(setPosts).toHaveBeenCalled();
      const updatedPosts = setPosts.mock.calls[0]?.[0] as
        | BulkPost[]
        | undefined;
      expect(updatedPosts?.[0]?.queueType).toBe("Morning");
    });

    it("should update displayed hashtags if most used queue type differs from changed value", async () => {
      // Setup: 2 posts with Evening, 1 with Morning
      // Evening is most used (2 posts)
      const posts: BulkPost[] = [
        {
          clientId: "post-1",
          files: [],
          caption: "",
          queueType: "Evening",
          scheduledFor: "",
          isRecyclable: false,
        },
        {
          clientId: "post-2",
          files: [],
          caption: "",
          queueType: "Evening",
          scheduledFor: "",
          isRecyclable: false,
        },
        {
          clientId: "post-3",
          files: [],
          caption: "",
          queueType: "Morning",
          scheduledFor: "",
          isRecyclable: false,
        },
      ];
      const setPosts = vi.fn();
      const queueTypes: QueueType[] = [
        { id: "queue-1", name: "Morning" },
        { id: "queue-2", name: "Evening" },
      ];
      const tags: string[] = [];
      const user = { id: "user-1" };
      const setDisplayedHashtags = vi.fn();
      const setSelectedQueueType = vi.fn();

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ scheduledTime: "2024-01-15T10:00" }),
      });

      // Change post-3 from Morning to "unassigned"
      // After change: Evening=2, unassigned=1, Morning=0
      // Most used is Evening, but we changed to unassigned
      // So hashtags should be updated to Evening (most used)
      await handleQueueTypeChange(2, "unassigned", {
        posts,
        setPosts,
        queueTypes,
        tags,
        user,
        setDisplayedHashtags,
        setSelectedQueueType,
      });

      // Should update hashtags since mostUsedQueueType (Evening) !== value (unassigned)
      expect(updateDisplayedHashtags).toHaveBeenCalledWith(
        "Evening",
        queueTypes,
        tags,
        setSelectedQueueType,
        setDisplayedHashtags
      );
    });
  });

  describe("handleBulkQueueUpdate", () => {
    it("should return early for empty posts array", async () => {
      const setPosts = vi.fn();
      const queueTypes: QueueType[] = [];
      const tags: string[] = [];
      const user = { id: "user-1" };
      const setDisplayedHashtags = vi.fn();
      const setSelectedQueueType = vi.fn();

      await handleBulkQueueUpdate("Morning", {
        posts: [],
        setPosts,
        queueTypes,
        tags,
        user,
        setDisplayedHashtags,
        setSelectedQueueType,
        firstItemTimeManuallyChanged: false,
      });

      expect(setPosts).not.toHaveBeenCalled();
    });

    it("should update all posts to new queue type", async () => {
      const posts: BulkPost[] = [
        {
          clientId: "post-1",
          files: [],
          caption: "",
          queueType: "unassigned",
          scheduledFor: "",
          isRecyclable: false,
        },
        {
          clientId: "post-2",
          files: [],
          caption: "",
          queueType: "unassigned",
          scheduledFor: "",
          isRecyclable: false,
        },
      ];
      const setPosts = vi.fn();
      const queueTypes: QueueType[] = [
        {
          id: "queue-1",
          name: "Morning",
          scheduleType: "INTERVAL" as const,
          scheduleConfig: {
            intervalHours: 4,
          },
        },
      ];
      const tags: string[] = [];
      const user = { id: "user-1" };
      const setDisplayedHashtags = vi.fn();
      const setSelectedQueueType = vi.fn();

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ scheduledTime: "2024-01-15T10:00" }),
      });

      await handleBulkQueueUpdate("Morning", {
        posts,
        setPosts,
        queueTypes,
        tags,
        user,
        setDisplayedHashtags,
        setSelectedQueueType,
        firstItemTimeManuallyChanged: false,
      });

      expect(setPosts).toHaveBeenCalled();
      const updatedPosts: BulkPost[] | undefined = setPosts.mock
        .calls[0]?.[0] as BulkPost[] | undefined;
      expect(updatedPosts).toHaveLength(2);
      expect(updatedPosts?.[0]?.queueType).toBe("Morning");
      expect(updatedPosts?.[1]?.queueType).toBe("Morning");
    });

    it("should use first item time if manually changed", async () => {
      const posts: BulkPost[] = [
        {
          clientId: "post-1",
          files: [],
          caption: "",
          queueType: "unassigned",
          scheduledFor: "2024-01-15T14:00",
          isRecyclable: false,
        },
        {
          clientId: "post-2",
          files: [],
          caption: "",
          queueType: "unassigned",
          scheduledFor: "",
          isRecyclable: false,
        },
      ];
      const setPosts = vi.fn();
      const queueTypes: QueueType[] = [
        {
          id: "queue-1",
          name: "Morning",
          scheduleType: "INTERVAL" as const,
          scheduleConfig: {
            intervalHours: 4,
          },
        },
      ];
      const tags: string[] = [];
      const user = { id: "user-1" };
      const setDisplayedHashtags = vi.fn();
      const setSelectedQueueType = vi.fn();

      await handleBulkQueueUpdate("Morning", {
        posts,
        setPosts,
        queueTypes,
        tags,
        user,
        setDisplayedHashtags,
        setSelectedQueueType,
        firstItemTimeManuallyChanged: true,
      });

      // Should not call fetch since we're using the first item's time
      expect(mockFetch).not.toHaveBeenCalled();
      expect(setPosts).toHaveBeenCalled();
      const updatedPosts: BulkPost[] | undefined = setPosts.mock
        .calls[0]?.[0] as BulkPost[] | undefined;
      expect(updatedPosts?.[0]?.scheduledFor).toContain("2024-01-15T14:");
      expect(updatedPosts?.[1]?.scheduledFor).toContain("2024-01-15T18:");
    });

    it("should calculate interval-based schedule times", async () => {
      const posts: BulkPost[] = [
        {
          clientId: "post-1",
          files: [],
          caption: "",
          queueType: "unassigned",
          scheduledFor: "",
          isRecyclable: false,
        },
        {
          clientId: "post-2",
          files: [],
          caption: "",
          queueType: "unassigned",
          scheduledFor: "",
          isRecyclable: false,
        },
        {
          clientId: "post-3",
          files: [],
          caption: "",
          queueType: "unassigned",
          scheduledFor: "",
          isRecyclable: false,
        },
      ];
      const setPosts = vi.fn();
      const queueTypes: QueueType[] = [
        {
          id: "queue-1",
          name: "Morning",
          scheduleType: "INTERVAL" as const,
          scheduleConfig: {
            intervalHours: 2,
          },
        },
      ];
      const tags: string[] = [];
      const user = { id: "user-1" };
      const setDisplayedHashtags = vi.fn();
      const setSelectedQueueType = vi.fn();

      const baseTime = "2024-01-15T10:00";
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ scheduledTime: baseTime }),
      });

      await handleBulkQueueUpdate("Morning", {
        posts,
        setPosts,
        queueTypes,
        tags,
        user,
        setDisplayedHashtags,
        setSelectedQueueType,
        firstItemTimeManuallyChanged: false,
      });

      expect(setPosts).toHaveBeenCalled();
      const updatedPosts: BulkPost[] | undefined = setPosts.mock
        .calls[0]?.[0] as BulkPost[] | undefined;
      // First post should use base time
      expect(updatedPosts?.[0]?.scheduledFor).toContain("2024-01-15T10:");
      // Second post should be 2 hours later
      expect(updatedPosts?.[1]?.scheduledFor).toContain("2024-01-15T12:");
      // Third post should be 4 hours later
      expect(updatedPosts?.[2]?.scheduledFor).toContain("2024-01-15T14:");
    });

    it("should clear scheduledFor for unassigned queue type", async () => {
      const posts: BulkPost[] = [
        {
          clientId: "post-1",
          files: [],
          caption: "",
          queueType: "Morning",
          scheduledFor: "2024-01-15T10:00",
          isRecyclable: false,
        },
      ];
      const setPosts = vi.fn();
      const queueTypes: QueueType[] = [];
      const tags: string[] = [];
      const user = { id: "user-1" };
      const setDisplayedHashtags = vi.fn();
      const setSelectedQueueType = vi.fn();

      await handleBulkQueueUpdate("unassigned", {
        posts,
        setPosts,
        queueTypes,
        tags,
        user,
        setDisplayedHashtags,
        setSelectedQueueType,
        firstItemTimeManuallyChanged: false,
      });

      expect(setPosts).toHaveBeenCalled();
      const updatedPosts: BulkPost[] | undefined = setPosts.mock
        .calls[0]?.[0] as BulkPost[] | undefined;
      expect(updatedPosts?.[0]?.scheduledFor).toBe("");
    });

    it("should calculate FIXED_SLOTS using user timezone for non-UTC users", async () => {
      const posts: BulkPost[] = [
        {
          clientId: "post-1",
          files: [],
          caption: "",
          queueType: "unassigned",
          scheduledFor: "",
          isRecyclable: false,
        },
        {
          clientId: "post-2",
          files: [],
          caption: "",
          queueType: "unassigned",
          scheduledFor: "",
          isRecyclable: false,
        },
      ];
      const setPosts = vi.fn();
      const queueTypes: QueueType[] = [
        {
          id: "queue-1",
          name: "Morning",
          scheduleType: "FIXED_SLOTS" as const,
          scheduleConfig: {
            slots: ["09:00", "12:00", "15:00"],
          },
        },
      ];
      const tags: string[] = [];
      const user = { id: "user-1", timezone: "America/New_York" };
      const setDisplayedHashtags = vi.fn();
      const setSelectedQueueType = vi.fn();

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ scheduledTime: "2024-01-15T10:00" }),
      });

      await handleBulkQueueUpdate("Morning", {
        posts,
        setPosts,
        queueTypes,
        tags,
        user,
        setDisplayedHashtags,
        setSelectedQueueType,
        firstItemTimeManuallyChanged: false,
      });

      expect(setPosts).toHaveBeenCalled();
      const updatedPosts: BulkPost[] | undefined = setPosts.mock
        .calls[0]?.[0] as BulkPost[] | undefined;
      expect(updatedPosts?.[0]?.scheduledFor).toMatch(/^2024-01-15T12:00/);
      expect(updatedPosts?.[1]?.scheduledFor).toMatch(/^2024-01-15T15:00/);
    });
  });
});
