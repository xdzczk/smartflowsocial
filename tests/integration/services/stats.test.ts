/**
 * Integration tests for stats service
 * Tests app/features/posts/stats.server.ts
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock fetch (used when PRIMAL_CACHING_URL is HTTP and fetchJsonWithRetry runs)
global.fetch = vi.fn();

// Stats use Redis + connectToPrimalCache; mock so cache misses and Primal returns mock data
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

describe("Stats Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env["PRIMAL_CACHING_URL"] = "http://test-cache-url";
  });

  it("should return empty stats for empty event IDs", async () => {
    const result = await getPostStats([]);

    expect(result).toEqual({});
    expect(fetch).not.toHaveBeenCalled();
  });

  it("should fetch stats for event IDs", async () => {
    const mockResponse = [
      [
        "EVENT",
        "sub-id",
        {
          kind: 10000100,
          content: JSON.stringify({
            event_id: "event-123",
            likes: 5,
            replies: 2,
            mentions: 1,
            reposts: 3,
            zaps: 10,
            satszapped: 1000,
          }),
        },
      ],
    ];

    mockConnectToPrimalCache.mockResolvedValue(mockResponse);

    const result = await getPostStats(["event-123"]);

    expect(mockConnectToPrimalCache).toHaveBeenCalledWith("thread_view", {
      event_id: "event-123",
    });
    expect(result["event-123"]).toEqual({
      likes: 5,
      replies: 2,
      mentions: 1,
      reposts: 3,
      zaps: 10,
      satszapped: 1000,
    });
  });

  it("should return zero stats if stats event not found", async () => {
    mockConnectToPrimalCache.mockResolvedValue([]);

    const result = await getPostStats(["event-123"]);

    expect(result["event-123"]).toEqual({
      likes: 0,
      replies: 0,
      mentions: 0,
      reposts: 0,
      zaps: 0,
      satszapped: 0,
    });
  });

  it("should handle fetch errors gracefully", async () => {
    mockConnectToPrimalCache.mockRejectedValue(new Error("Network error"));

    const result = await getPostStats(["event-123"]);

    expect(result["event-123"]).toEqual({
      likes: 0,
      replies: 0,
      mentions: 0,
      reposts: 0,
      zaps: 0,
      satszapped: 0,
    });
  });

  it("should handle non-ok responses", async () => {
    mockConnectToPrimalCache.mockRejectedValue(new Error("500"));

    const result = await getPostStats(["event-123"]);

    expect(result["event-123"]).toEqual({
      likes: 0,
      replies: 0,
      mentions: 0,
      reposts: 0,
      zaps: 0,
      satszapped: 0,
    });
  });

  it("should handle invalid JSON in stats content", async () => {
    const mockResponse = [
      [
        "EVENT",
        "sub-id",
        {
          kind: 10000100,
          content: "invalid-json{",
        },
      ],
    ];

    mockConnectToPrimalCache.mockResolvedValue(mockResponse);

    const result = await getPostStats(["event-123"]);

    expect(result["event-123"]).toEqual({
      likes: 0,
      replies: 0,
      mentions: 0,
      reposts: 0,
      zaps: 0,
      satszapped: 0,
    });
  });

  it("should handle multiple event IDs", async () => {
    const mockResponse1 = [
      [
        "EVENT",
        "sub-id",
        {
          kind: 10000100,
          content: JSON.stringify({
            event_id: "event-1",
            likes: 5,
            replies: 2,
            reposts: 3,
            zaps: 10,
            satszapped: 1000,
            mentions: 1,
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
            likes: 10,
            replies: 5,
            reposts: 7,
            zaps: 20,
            satszapped: 2000,
            mentions: 2,
          }),
        },
      ],
    ];

    mockConnectToPrimalCache
      .mockResolvedValueOnce(mockResponse1)
      .mockResolvedValueOnce(mockResponse2);

    const result = await getPostStats(["event-1", "event-2"]);

    expect(result["event-1"]).toEqual({
      likes: 5,
      replies: 2,
      mentions: 1,
      reposts: 3,
      zaps: 10,
      satszapped: 1000,
    });
    expect(result["event-2"]).toEqual({
      likes: 10,
      replies: 5,
      mentions: 2,
      reposts: 7,
      zaps: 20,
      satszapped: 2000,
    });
  });
});
