/**
 * Integration tests for stats service
 * Tests app/features/posts/stats.server.ts
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock fetch
global.fetch = vi.fn();

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

    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    });

    const result = await getPostStats(["event-123"]);

    // fetchJsonWithRetry adds additional options (timeout, maxRetries, correlation ID, etc.)
    expect(fetch).toHaveBeenCalled();
    const fetchCall = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    if (!fetchCall) {
      throw new Error("fetch was not called");
    }
    expect(fetchCall[0]).toBe("http://test-cache-url");
    const fetchOptions = fetchCall[1] as RequestInit;
    expect(fetchOptions.method).toBe("POST");
    const headers = fetchOptions.headers as Record<string, string> | undefined;
    expect(headers?.["Content-Type"]).toBe("application/json");
    expect(fetchOptions.body).toBe(
      JSON.stringify({
        requestType: "thread_view",
        params: {
          event_id: "event-123",
        },
      })
    );
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
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => [],
    });

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
    (fetch as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("Network error")
    );

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
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      status: 500,
    });

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

    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    });

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

    (fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse1,
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse2,
      });

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
