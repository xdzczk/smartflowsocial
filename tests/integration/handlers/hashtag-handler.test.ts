/**
 * Integration tests for hashtag handler
 * Tests updateDisplayedHashtags function in app/features/posts/handlers/hashtag.handler.ts
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import { updateDisplayedHashtags } from "~/features/posts/handlers/hashtag.handler";
import type { QueueType } from "~/features/posts/types";

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock logClientError
vi.mock("~/lib/error-handler.client", () => ({
  logClientError: vi.fn(),
}));

describe("Hashtag Handler Integration Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("updateDisplayedHashtags", () => {
    it("should set tags directly for unassigned queue type", async () => {
      const setSelectedQueueType = vi.fn();
      const setDisplayedHashtags = vi.fn();
      const tags = ["tag1", "tag2", "tag3"];
      const queueTypes: QueueType[] = [];

      await updateDisplayedHashtags(
        "unassigned",
        queueTypes,
        tags,
        setSelectedQueueType,
        setDisplayedHashtags,
      );

      expect(setSelectedQueueType).toHaveBeenCalledWith("unassigned");
      expect(setDisplayedHashtags).toHaveBeenCalledWith(tags);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("should fetch effective hashtags for assigned queue type", async () => {
      const setSelectedQueueType = vi.fn();
      const setDisplayedHashtags = vi.fn();
      const tags = ["tag1", "tag2"];
      const queueTypes: QueueType[] = [
        {
          id: "queue-1",
          name: "Morning",
          color: "#FF5733",
        } satisfies QueueType,
      ];

      const mockResponse = {
        hashtags: ["effective1", "effective2"],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      await updateDisplayedHashtags(
        "Morning",
        queueTypes,
        tags,
        setSelectedQueueType,
        setDisplayedHashtags,
      );

      expect(setSelectedQueueType).toHaveBeenCalledWith("Morning");
      expect(mockFetch).toHaveBeenCalledWith("/api/effective-hashtags", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          queueTypeId: "queue-1",
          queueTypeName: "Morning",
        }),
      });
      expect(setDisplayedHashtags).toHaveBeenCalledWith([
        "effective1",
        "effective2",
      ]);
    });

    it("should fallback to tags if API response is not ok", async () => {
      const setSelectedQueueType = vi.fn();
      const setDisplayedHashtags = vi.fn();
      const tags = ["tag1", "tag2"];
      const queueTypes: QueueType[] = [
        {
          id: "queue-1",
          name: "Morning",
        } satisfies QueueType,
      ];

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      await updateDisplayedHashtags(
        "Morning",
        queueTypes,
        tags,
        setSelectedQueueType,
        setDisplayedHashtags,
      );

      expect(setDisplayedHashtags).toHaveBeenCalledWith(tags);
    });

    it("should fallback to tags if API response has no hashtags", async () => {
      const setSelectedQueueType = vi.fn();
      const setDisplayedHashtags = vi.fn();
      const tags = ["tag1", "tag2"];
      const queueTypes: QueueType[] = [
        {
          id: "queue-1",
          name: "Morning",
        } satisfies QueueType,
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      });

      await updateDisplayedHashtags(
        "Morning",
        queueTypes,
        tags,
        setSelectedQueueType,
        setDisplayedHashtags,
      );

      expect(setDisplayedHashtags).toHaveBeenCalledWith(tags);
    });

    it("should handle fetch errors gracefully", async () => {
      const setSelectedQueueType = vi.fn();
      const setDisplayedHashtags = vi.fn();
      const tags = ["tag1", "tag2"];
      const queueTypes: QueueType[] = [
        {
          id: "queue-1",
          name: "Morning",
        } satisfies QueueType,
      ];

      mockFetch.mockRejectedValueOnce(new Error("Network error"));

      await updateDisplayedHashtags(
        "Morning",
        queueTypes,
        tags,
        setSelectedQueueType,
        setDisplayedHashtags,
      );

      expect(setDisplayedHashtags).toHaveBeenCalledWith(tags);
    });

    it("should handle queue type as string in queueTypes array", async () => {
      const setSelectedQueueType = vi.fn();
      const setDisplayedHashtags = vi.fn();
      const tags = ["tag1"];
      const queueTypes: QueueType[] = ["Morning" as unknown as QueueType];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ hashtags: ["effective1"] }),
      });

      await updateDisplayedHashtags(
        "Morning",
        queueTypes,
        tags,
        setSelectedQueueType,
        setDisplayedHashtags,
      );

      expect(mockFetch).toHaveBeenCalledWith("/api/effective-hashtags", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          queueTypeId: null,
          queueTypeName: "Morning",
        }),
      });
    });

    it("should handle hashtags as string in response", async () => {
      const setSelectedQueueType = vi.fn();
      const setDisplayedHashtags = vi.fn();
      const tags = ["tag1"];
      const queueTypes: QueueType[] = [
        {
          id: "queue-1",
          name: "Morning",
        } satisfies QueueType,
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ hashtags: "tag1 tag2 tag3" }),
      });

      await updateDisplayedHashtags(
        "Morning",
        queueTypes,
        tags,
        setSelectedQueueType,
        setDisplayedHashtags,
      );

      expect(setDisplayedHashtags).toHaveBeenCalledWith("tag1 tag2 tag3");
    });
  });
});
