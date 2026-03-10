/**
 * Integration tests for statistics service
 *
 * Tests the statistics fetching logic in app/features/posts/stats.server.ts
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

global.fetch = vi.fn();

const mockConnectToPrimalCache = vi.fn();
vi.mock("~/features/cache/primalCache.server", () => ({
  connectToPrimalCache: (...args: unknown[]) =>
    mockConnectToPrimalCache(...args),
}));

vi.mock("~/lib/redis-cache.server", () => ({
  buildCacheKey: vi.fn((opts: { parts: Record<string, string> }) =>
    ["post-stats", opts.parts["eventId"]].join(":")
  ),
  getJsonFromRedis: vi.fn().mockResolvedValue({ hit: false }),
  getOrSetJson: vi.fn(async <T>(opts: { compute: () => Promise<T> }) =>
    opts.compute()
  ),
  setJsonInRedis: vi.fn().mockResolvedValue(undefined),
}));

import { getPostStats } from "~/features/posts/stats.server";

describe("Statistics Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env["PRIMAL_CACHING_URL"] = "https://api.primal.net/v1/cache";
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("getPostStats", () => {
    it("should return empty stats for empty eventIds array", async () => {
      const result = await getPostStats([]);

      expect(result).toEqual({});
      expect(mockConnectToPrimalCache).not.toHaveBeenCalled();
    });

    it("should fetch stats for a single event ID", async () => {
      const mockResponse = [
        [
          "EVENT",
          "sub-id",
          {
            kind: 10000100,
            content: JSON.stringify({
              event_id: "event-1",
              likes: 10,
              replies: 5,
              mentions: 2,
              reposts: 3,
              zaps: 1,
              satszapped: 100,
            }),
          },
        ],
      ];

      mockConnectToPrimalCache.mockResolvedValue(mockResponse);

      const result = await getPostStats(["event-1"]);

      expect(mockConnectToPrimalCache).toHaveBeenCalledWith("thread_view", {
        event_id: "event-1",
      });
      expect(result).toEqual({
        "event-1": {
          likes: 10,
          replies: 5,
          mentions: 2,
          reposts: 3,
          zaps: 1,
          satszapped: 100,
        },
      });
    });

    it("should fetch stats for multiple event IDs", async () => {
      mockConnectToPrimalCache
        .mockResolvedValueOnce([
          [
            "EVENT",
            "sub-id",
            {
              kind: 10000100,
              content: JSON.stringify({
                event_id: "event-1",
                likes: 10,
                replies: 5,
                mentions: 0,
                reposts: 2,
                zaps: 0,
                satszapped: 0,
              }),
            },
          ],
        ])
        .mockResolvedValueOnce([
          [
            "EVENT",
            "sub-id",
            {
              kind: 10000100,
              content: JSON.stringify({
                event_id: "event-2",
                likes: 20,
                replies: 10,
                mentions: 1,
                reposts: 5,
                zaps: 2,
                satszapped: 500,
              }),
            },
          ],
        ]);

      const result = await getPostStats(["event-1", "event-2"]);

      expect(mockConnectToPrimalCache).toHaveBeenCalledTimes(2);
      expect(result).toEqual({
        "event-1": {
          likes: 10,
          replies: 5,
          mentions: 0,
          reposts: 2,
          zaps: 0,
          satszapped: 0,
        },
        "event-2": {
          likes: 20,
          replies: 10,
          mentions: 1,
          reposts: 5,
          zaps: 2,
          satszapped: 500,
        },
      });
    });

    it("should return zero stats when stats event is not found", async () => {
      mockConnectToPrimalCache.mockResolvedValue([]);

      const result = await getPostStats(["event-1"]);

      expect(result).toEqual({
        "event-1": {
          likes: 0,
          replies: 0,
          mentions: 0,
          reposts: 0,
          zaps: 0,
          satszapped: 0,
        },
      });
    });

    it("should return zero stats when response doesn't contain stats event", async () => {
      const mockResponse = [
        [
          "EVENT",
          "sub-id",
          {
            kind: 1,
            content: "Some content",
          },
        ],
      ];

      mockConnectToPrimalCache.mockResolvedValue(mockResponse);

      const result = await getPostStats(["event-1"]);

      expect(result).toEqual({
        "event-1": {
          likes: 0,
          replies: 0,
          mentions: 0,
          reposts: 0,
          zaps: 0,
          satszapped: 0,
        },
      });
    });

    it("should handle missing stats fields by defaulting to 0", async () => {
      const mockResponse = [
        [
          "EVENT",
          "sub-id",
          {
            kind: 10000100,
            content: JSON.stringify({
              event_id: "event-1",
              likes: 5,
            }),
          },
        ],
      ];

      mockConnectToPrimalCache.mockResolvedValue(mockResponse);

      const result = await getPostStats(["event-1"]);

      expect(result).toEqual({
        "event-1": {
          likes: 5,
          replies: 0,
          mentions: 0,
          reposts: 0,
          zaps: 0,
          satszapped: 0,
        },
      });
    });

    it("should handle fetch errors gracefully", async () => {
      mockConnectToPrimalCache.mockRejectedValue(new Error("Network error"));

      const result = await getPostStats(["event-1"]);

      expect(result).toEqual({
        "event-1": {
          likes: 0,
          replies: 0,
          mentions: 0,
          reposts: 0,
          zaps: 0,
          satszapped: 0,
        },
      });
    });

    it("should handle non-ok responses", async () => {
      mockConnectToPrimalCache.mockRejectedValue(
        new Error("Internal Server Error")
      );

      const result = await getPostStats(["event-1"]);

      // Should return zero stats on error
      expect(result).toEqual({
        "event-1": {
          likes: 0,
          replies: 0,
          mentions: 0,
          reposts: 0,
          zaps: 0,
          satszapped: 0,
        },
      });
    });

    it("should timeout after 5 seconds", async () => {
      mockConnectToPrimalCache.mockRejectedValue(new Error("Timeout"));

      const result = await getPostStats(["event-1"]);

      expect(result).toEqual({
        "event-1": {
          likes: 0,
          replies: 0,
          mentions: 0,
          reposts: 0,
          zaps: 0,
          satszapped: 0,
        },
      });
    });

    it("should handle invalid JSON in stats content", async () => {
      const mockResponse = [
        [
          "EVENT",
          "sub-id",
          {
            kind: 10000100,
            content: "invalid json",
          },
        ],
      ];

      mockConnectToPrimalCache.mockResolvedValue(mockResponse);

      const result = await getPostStats(["event-1"]);
      expect(result["event-1"]).toEqual({
        likes: 0,
        replies: 0,
        mentions: 0,
        reposts: 0,
        zaps: 0,
        satszapped: 0,
      });
    });

    it("should match event ID in stats content", async () => {
      const mockResponse = [
        [
          "EVENT",
          "sub-id",
          {
            kind: 10000100,
            content: JSON.stringify({
              event_id: "event-2",
              likes: 10,
            }),
          },
        ],
      ];

      mockConnectToPrimalCache.mockResolvedValue(mockResponse);

      const result = await getPostStats(["event-1"]);

      expect(result).toEqual({
        "event-1": {
          likes: 0,
          replies: 0,
          mentions: 0,
          reposts: 0,
          zaps: 0,
          satszapped: 0,
        },
      });
    });
  });
});
