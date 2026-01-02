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
      const responseObj = response instanceof Response ? response : new Response(JSON.stringify(response));
      const dataRaw: unknown = await responseObj.json();
      const data = dataRaw && typeof dataRaw === "object" && !Array.isArray(dataRaw) ? dataRaw as { events?: unknown; metadata?: unknown; raw?: unknown } : {};
      const events = Array.isArray(data.events) ? data.events : [];
      const metadata = data.metadata && typeof data.metadata === "object" && !Array.isArray(data.metadata) ? data.metadata as Record<string, unknown> : {};

      expect(connectToPrimalCache).toHaveBeenCalledWith("thread_view", {
        event_id: "event-123",
      });
      expect(events).toHaveLength(2); // Excludes kind 0 and 10000100
      expect(metadata).toHaveProperty("pubkey-1");
      expect((data as { raw?: unknown }).raw).toEqual(mockThreadData);
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
      const responseObj = response instanceof Response ? response : new Response(JSON.stringify(response));
      const dataRaw: unknown = await responseObj.json();
      const data = dataRaw && typeof dataRaw === "object" && !Array.isArray(dataRaw) ? dataRaw as { events?: unknown; metadata?: unknown } : {};
      const events = Array.isArray(data.events) ? data.events : [];
      const metadata = data.metadata && typeof data.metadata === "object" && !Array.isArray(data.metadata) ? data.metadata as Record<string, unknown> : {};

      expect(events).toHaveLength(1);
      expect(metadata).toHaveProperty("pubkey-1");
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
      const responseObj = response instanceof Response ? response : new Response(JSON.stringify(response));
      const dataRaw: unknown = await responseObj.json();
      const data = dataRaw && typeof dataRaw === "object" && !Array.isArray(dataRaw) ? dataRaw as { events?: unknown } : {};
      const events = Array.isArray(data.events) ? data.events : [];
      const firstEvent = events[0] && typeof events[0] === "object" && !Array.isArray(events[0]) ? events[0] as { id?: string } : {};

      expect(events).toHaveLength(1);
      expect(firstEvent.id).toBe("event-1");
    });

    it("should handle empty thread data", async () => {
      (connectToPrimalCache as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      const request = new Request(
        "http://localhost:3000/api/thread-view?event_id=event-123",
      );

      const response = await loader({ request, params: {}, context: {} });
      const responseObj = response instanceof Response ? response : new Response(JSON.stringify(response));
      const dataRaw: unknown = await responseObj.json();
      const data = dataRaw && typeof dataRaw === "object" && !Array.isArray(dataRaw) ? dataRaw as { events?: unknown; metadata?: unknown } : {};
      const events = Array.isArray(data.events) ? data.events : [];
      const metadata = data.metadata && typeof data.metadata === "object" && !Array.isArray(data.metadata) ? data.metadata : {};

      expect(events).toEqual([]);
      expect(metadata).toEqual({});
    });

    it("should handle non-array thread data", async () => {
      (connectToPrimalCache as ReturnType<typeof vi.fn>).mockResolvedValue({ some: "data" });

      const request = new Request(
        "http://localhost:3000/api/thread-view?event_id=event-123",
      );

      const response = await loader({ request, params: {}, context: {} });
      const responseObj = response instanceof Response ? response : new Response(JSON.stringify(response));
      const dataRaw: unknown = await responseObj.json();
      const data = dataRaw && typeof dataRaw === "object" && !Array.isArray(dataRaw) ? dataRaw as { events?: unknown; metadata?: unknown } : {};
      const events = Array.isArray(data.events) ? data.events : [];
      const metadata = data.metadata && typeof data.metadata === "object" && !Array.isArray(data.metadata) ? data.metadata : {};

      expect(events).toEqual([]);
      expect(metadata).toEqual({});
    });
  });

  describe("Error Handling", () => {
    it("should return validation error when event_id is missing", async () => {
      const request = new Request("http://localhost:3000/api/thread-view");

      const response = await loader({ request, params: {}, context: {} });
      const responseObj = response instanceof Response ? response : new Response(JSON.stringify(response));
      const dataRaw: unknown = await responseObj.json();
      const data = dataRaw && typeof dataRaw === "object" && !Array.isArray(dataRaw) ? dataRaw as { success?: unknown; error?: unknown } : {};

      expect(responseObj.status).toBe(400);
      const success = typeof data.success === "boolean" ? data.success : data.success === 0 || data.success === false;
      expect(success).toBe(false);
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
      const responseObj = response instanceof Response ? response : new Response(JSON.stringify(response));
      const dataRaw: unknown = await responseObj.json();
      const data = dataRaw && typeof dataRaw === "object" && !Array.isArray(dataRaw) ? dataRaw as { success?: unknown; error?: unknown } : {};

      expect(responseObj.status).toBe(502);
      const success = typeof data.success === "boolean" ? data.success : data.success === 0 || data.success === false;
      expect(success).toBe(false);
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
      const responseObj = response instanceof Response ? response : new Response(JSON.stringify(response));
      const dataRaw: unknown = await responseObj.json();
      const data = dataRaw && typeof dataRaw === "object" && !Array.isArray(dataRaw) ? dataRaw as { events?: unknown; metadata?: unknown } : {};
      const events = Array.isArray(data.events) ? data.events : [];
      const metadata = data.metadata && typeof data.metadata === "object" && !Array.isArray(data.metadata) ? data.metadata : {};

      expect(events).toEqual([]);
      expect(metadata).toEqual({});
    });
  });
});







