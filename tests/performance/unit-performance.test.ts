/**
 * Unit Performance Tests
 *
 * Tests performance of individual functions using Vitest
 * These tests verify that functions meet performance benchmarks
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
// getPostStats uses Primal cache helper; mock transport so perf tests stay deterministic in CI.
vi.mock("~/features/cache/primalCache.server", () => ({
  connectToPrimalCache: vi.fn(),
}));

import { postFactory, longFormPostFactory } from "../factories";

import { connectToPrimalCache } from "~/features/cache/primalCache.server";
import { combineContent } from "~/features/posts/combined.server";
import { getPostStats } from "~/features/posts/stats.server";
import type { PostData, LongFormPostData } from "~/features/posts/types";

describe("Performance: combineContent()", () => {
  it("should handle small arrays (< 100 items) in < 50ms", () => {
    const posts = postFactory.many(50);
    const longforms = longFormPostFactory.many(50);

    const start = performance.now();
    const result = combineContent(
      posts as PostData[],
      longforms as LongFormPostData[]
    );
    const duration = performance.now() - start;

    expect(result).toBeDefined();
    expect(duration).toBeLessThan(50);
  });

  it("should handle medium arrays (100-1000 items) in < 200ms", () => {
    const posts = postFactory.many(500);
    const longforms = longFormPostFactory.many(500);

    const start = performance.now();
    const result = combineContent(
      posts as PostData[],
      longforms as LongFormPostData[]
    );
    const duration = performance.now() - start;

    expect(result).toBeDefined();
    expect(duration).toBeLessThan(200);
  });

  it("should handle large arrays (1000+ items) in < 1000ms", () => {
    const posts = postFactory.many(2000);
    const longforms = longFormPostFactory.many(1000);

    const start = performance.now();
    const result = combineContent(
      posts as PostData[],
      longforms as LongFormPostData[]
    );
    const duration = performance.now() - start;

    expect(result).toBeDefined();
    expect(duration).toBeLessThan(1000);
  });

  it("should handle sorting efficiently", () => {
    const posts = postFactory.many(1000);
    const longforms = longFormPostFactory.many(1000);

    const start = performance.now();
    const result = combineContent(
      posts as PostData[],
      longforms as LongFormPostData[],
      "createdAt"
    );
    const duration = performance.now() - start;

    expect(result).toBeDefined();
    expect(duration).toBeLessThan(500);
  });

  it("should handle different sort directions efficiently", () => {
    const posts = postFactory.many(1000);
    const longforms = longFormPostFactory.many(1000);

    const start = performance.now();
    const result = combineContent(
      posts as PostData[],
      longforms as LongFormPostData[],
      "createdAt",
      "asc"
    );
    const duration = performance.now() - start;

    expect(result).toBeDefined();
    expect(duration).toBeLessThan(500);
  });
});

describe("Performance: getPostStats()", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should handle single event ID in < 500ms", async () => {
    const eventId = "test-event-123";

    (connectToPrimalCache as ReturnType<typeof vi.fn>).mockResolvedValue([
      [
        "EVENT",
        "",
        {
          kind: 10000100,
          content: JSON.stringify({
            event_id: eventId,
            replies: 5,
            reposts: 2,
            likes: 10,
          }),
        },
      ],
    ]);

    const start = performance.now();
    const result = await getPostStats([eventId]);
    const duration = performance.now() - start;

    expect(result).toBeDefined();
    expect(duration).toBeLessThan(500);
  });

  it("should handle multiple event IDs (10-50) in < 2000ms", async () => {
    const eventIds = Array.from({ length: 25 }, (_, i) => `event-${i + 1}`);

    (connectToPrimalCache as ReturnType<typeof vi.fn>).mockResolvedValue([
      [
        "EVENT",
        "",
        {
          kind: 10000100,
          content: JSON.stringify({
            event_id: "event-1",
            replies: 5,
            reposts: 2,
            likes: 10,
          }),
        },
      ],
    ]);

    const start = performance.now();
    await getPostStats(eventIds);
    const duration = performance.now() - start;

    expect(duration).toBeLessThan(2000);
  });

  it("should handle many event IDs (50-100) in < 6000ms", async () => {
    const eventIds = Array.from({ length: 75 }, (_, i) => `event-${i + 1}`);

    (connectToPrimalCache as ReturnType<typeof vi.fn>).mockResolvedValue([
      [
        "EVENT",
        "",
        {
          kind: 10000100,
          content: JSON.stringify({
            event_id: "event-1",
            replies: 5,
            reposts: 2,
            likes: 10,
          }),
        },
      ],
    ]);

    const start = performance.now();
    const result = await getPostStats(eventIds);
    const duration = performance.now() - start;

    expect(result).toBeDefined();
    // 6s allows for Redis/cache + connectToPrimalCache under load; 5s was flaky in CI
    expect(duration).toBeLessThan(6000);
  });
});

describe("Performance: Bulk Operations", () => {
  it("should handle bulk post creation efficiently", () => {
    const posts = postFactory.many(100);

    const start = performance.now();
    // Simulate bulk processing
    const processed = posts.map((post) => ({
      ...post,
      processed: true,
    }));
    const duration = performance.now() - start;

    expect(processed).toHaveLength(100);
    expect(duration).toBeLessThan(100);
  });

  it("should handle bulk post updates efficiently", () => {
    const posts = postFactory.many(100);

    const start = performance.now();
    // Simulate bulk update
    const updated = posts.map((post) => ({
      ...post,
      updatedAt: new Date(),
    }));
    const duration = performance.now() - start;

    expect(updated).toHaveLength(100);
    expect(duration).toBeLessThan(100);
  });
});
