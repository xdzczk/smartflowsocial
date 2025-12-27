/**
 * Integration tests for thread view API route
 * 
 * Tests the API endpoint in app/routes/api.thread-view.tsx
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
// Mock dependencies
vi.mock("~/features/cache/primalCache.server", () => ({
  connectToPrimalCache: vi.fn(),
}));

import { connectToPrimalCache } from "~/features/cache/primalCache.server";
import { loader } from "~/routes/api.thread-view";

describe("API: Thread View", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Successful Requests", () => {
    it("should fetch and parse thread view data", async () => {
      const mockThreadData = [
        ["EVENT", "sub-id", { kind: 1, id: "event-1", pubkey: "pubkey-1", content: "Post 1" }],
        ["EVENT", "sub-id", { kind: 0, pubkey: "pubkey-1", name: "User 1" }],
        ["EVENT", "sub-id", { kind: 1, id: "event-2", pubkey: "pubkey-2", content: "Reply 1" }],
      ];

      (connectToPrimalCache as ReturnType<typeof vi.fn>).mockResolvedValue(mockThreadData);

      const request = new Request(
        "http://localhost:3000/api/thread-view?event_id=event-123",
      );

      const response = await loader({ request, params: {}, context: {} });
      const data = await response.json();

      expect(connectToPrimalCache).toHaveBeenCalledWith("thread_view", {
        event_id: "event-123",
      });
      expect(data.events).toHaveLength(2); // Excludes kind 0 and 10000100
      expect(data.metadata).toHaveProperty("pubkey-1");
      expect(data.raw).toEqual(mockThreadData);
    });

    it("should exclude metadata events (kind 0) from events array", async () => {
      const mockThreadData = [
        ["EVENT", "sub-id", { kind: 0, pubkey: "pubkey-1", name: "User 1" }],
        ["EVENT", "sub-id", { kind: 1, id: "event-1", content: "Post" }],
      ];

      (connectToPrimalCache as ReturnType<typeof vi.fn>).mockResolvedValue(mockThreadData);

      const request = new Request(
        "http://localhost:3000/api/thread-view?event_id=event-123",
      );

      const response = await loader({ request, params: {}, context: {} });
      const data = await response.json();

      expect(data.events).toHaveLength(1);
      expect(data.metadata).toHaveProperty("pubkey-1");
    });

    it("should exclude stats events (kind 10000100) from events array", async () => {
      const mockThreadData = [
        ["EVENT", "sub-id", { kind: 10000100, id: "stats-1" }],
        ["EVENT", "sub-id", { kind: 1, id: "event-1", content: "Post" }],
      ];

      (connectToPrimalCache as ReturnType<typeof vi.fn>).mockResolvedValue(mockThreadData);

      const request = new Request(
        "http://localhost:3000/api/thread-view?event_id=event-123",
      );

      const response = await loader({ request, params: {}, context: {} });
      const data = await response.json();

      expect(data.events).toHaveLength(1);
      expect(data.events[0].id).toBe("event-1");
    });

    it("should handle empty thread data", async () => {
      (connectToPrimalCache as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      const request = new Request(
        "http://localhost:3000/api/thread-view?event_id=event-123",
      );

      const response = await loader({ request, params: {}, context: {} });
      const data = await response.json();

      expect(data.events).toEqual([]);
      expect(data.metadata).toEqual({});
    });

    it("should handle non-array thread data", async () => {
      (connectToPrimalCache as ReturnType<typeof vi.fn>).mockResolvedValue({ some: "data" });

      const request = new Request(
        "http://localhost:3000/api/thread-view?event_id=event-123",
      );

      const response = await loader({ request, params: {}, context: {} });
      const data = await response.json();

      expect(data.events).toEqual([]);
      expect(data.metadata).toEqual({});
    });
  });

  describe("Error Handling", () => {
    it("should return validation error when event_id is missing", async () => {
      const request = new Request("http://localhost:3000/api/thread-view");

      const response = await loader({ request, params: {}, context: {} });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toBeDefined();
    });

    it("should handle cache connection errors", async () => {
      (connectToPrimalCache as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error("Cache connection failed"),
      );

      const request = new Request(
        "http://localhost:3000/api/thread-view?event_id=event-123",
      );

      const response = await loader({ request, params: {}, context: {} });
      const data = await response.json();

      expect(response.status).toBe(502);
      expect(data.success).toBe(false);
      expect(data.error).toBeDefined();
    });

    it("should handle malformed thread data gracefully", async () => {
      const malformedData = [
        ["NOT_EVENT", "data"],
        { notAnArray: true },
        null,
      ];

      (connectToPrimalCache as ReturnType<typeof vi.fn>).mockResolvedValue(malformedData);

      const request = new Request(
        "http://localhost:3000/api/thread-view?event_id=event-123",
      );

      const response = await loader({ request, params: {}, context: {} });
      const data = await response.json();

      expect(data.events).toEqual([]);
      expect(data.metadata).toEqual({});
    });
  });
});







