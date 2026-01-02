/**
 * Integration tests for statistics service
 *
 * Tests the statistics fetching logic in app/features/posts/stats.server.ts
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import { getPostStats } from "~/features/posts/stats.server";
// Mock global fetch
global.fetch = vi.fn();

describe("Statistics Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.PRIMAL_CACHING_URL = "https://api.primal.net/v1/cache";
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("getPostStats", () => {
    it("should return empty stats for empty eventIds array", async () => {
      const result = await getPostStats([]);

      expect(result).toEqual({});
      expect(global.fetch).not.toHaveBeenCalled();
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

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await getPostStats(["event-1"]);

      // fetchJsonWithRetry adds additional options (timeout, maxRetries, correlation ID, etc.)
      expect(global.fetch).toHaveBeenCalled();
      const fetchCall = (global.fetch as ReturnType<typeof vi.fn>).mock
        .calls[0];
      expect(fetchCall[0]).toBe("https://api.primal.net/v1/cache");
      const fetchOptions = fetchCall[1] as RequestInit;
      expect(fetchOptions.method).toBe("POST");
      const headers = fetchOptions.headers as
        | Record<string, string>
        | undefined;
      expect(headers?.["Content-Type"]).toBe("application/json");
      expect(fetchOptions.body).toBe(
        JSON.stringify({
          requestType: "thread_view",
          params: {
            event_id: "event-1",
          },
        }),
      );

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
      const mockResponse1 = [
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
      ];

      const mockResponse2 = [
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
      ];

      (global.fetch as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockResponse1,
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockResponse2,
        });

      const result = await getPostStats(["event-1", "event-2"]);

      expect(global.fetch).toHaveBeenCalledTimes(2);
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
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        json: async () => [], // Empty response
      });

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
            kind: 1, // Wrong kind
            content: "Some content",
          },
        ],
      ];

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });

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
              // Missing other fields
            }),
          },
        ],
      ];

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });

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
      (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error("Network error"),
      );

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
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: false,
        statusText: "Internal Server Error",
      });

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
      // Mock AbortController
      const abortSpy = vi.fn();
      const mockSignal: AbortSignal = {} as unknown as AbortSignal;
      global.AbortController = vi.fn(() => ({
        abort: abortSpy,
        signal: mockSignal,
      })) as typeof AbortController;

      // Mock setTimeout to trigger timeout immediately
      const originalSetTimeout = global.setTimeout;
      global.setTimeout = vi.fn((callback: () => void) => {
        callback();
        return 123 as unknown as ReturnType<typeof setTimeout>;
      }) as unknown as typeof setTimeout;

      (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error("Timeout"),
      );

      const result = await getPostStats(["event-1"]);

      // Should return zero stats on timeout
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

      // Restore
      global.setTimeout = originalSetTimeout;
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

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });

      // Should handle gracefully and return default stats
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
              event_id: "event-2", // Different event ID
              likes: 10,
            }),
          },
        ],
      ];

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await getPostStats(["event-1"]);

      // Should return zero stats if event ID doesn't match
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
