/**
 * Integration tests for publish API route
 * 
 * Tests the API endpoint in app/routes/api.publish.tsx
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
// Mock global fetch
global.fetch = vi.fn();

// Mock dependencies
vi.mock("~/features/auth/session.server", () => ({
  requireUserId: vi.fn(),
}));

import { requireUserId } from "~/features/auth/session.server";
import { action } from "~/routes/api.publish";

import { TEST_USER_ID } from "../utils/test-helpers";

describe("API: Publish", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (requireUserId as ReturnType<typeof vi.fn>).mockResolvedValue(TEST_USER_ID);
    process.env.NOSTR_PUBLISHER_URL = "https://api.nostr-publisher.com/publish";
  });

  describe("Successful Requests", () => {
    it("should publish event to NOSTR publisher", async () => {
      const mockEvent = {
        id: "event-123",
        kind: 1,
        content: "Test post",
      };

      const mockRelays = ["wss://relay1.com", "wss://relay2.com"];

      const mockResponse: Response = {
        ok: true,
        status: 200,
        statusText: "OK",
        headers: new Headers({ "content-type": "application/json" }),
        json: async () => ({ success: true }),
        text: async () => "",
      } as unknown as Response;
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(mockResponse);

      const request = new Request("http://localhost:3000/api/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          relays: mockRelays,
          event: mockEvent,
        }),
      });

      const actionParams: { request: Request; params: Record<string, string>; context: Record<string, unknown> } = { request, params: {}, context: {} };
      const response = await action(actionParams);
      const dataRaw: unknown = await response.json();
      const data = dataRaw && typeof dataRaw === "object" && !Array.isArray(dataRaw) ? dataRaw as { success?: unknown; message?: unknown; error?: unknown } : {};

      expect(requireUserId).toHaveBeenCalledWith(request);
      expect(global.fetch).toHaveBeenCalledWith(
        "https://api.nostr-publisher.com/publish",
        expect.objectContaining({
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            relays: mockRelays,
            event: mockEvent,
          }),
        }),
      );
      expect(data).toEqual({ success: true });
    });

    it("should handle text response from publisher", async () => {
      const mockEvent = { id: "event-123" };
      const mockRelays = ["wss://relay1.com"];

      const mockTextResponse: Response = {
        ok: true,
        status: 200,
        statusText: "OK",
        headers: new Headers({ "content-type": "text/plain" }),
        json: async () => ({}),
        text: async () => "Published successfully",
      } as unknown as Response;
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(mockTextResponse);

      const request = new Request("http://localhost:3000/api/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          relays: mockRelays,
          event: mockEvent,
        }),
      });

      const actionParams: { request: Request; params: Record<string, string>; context: Record<string, unknown> } = { request, params: {}, context: {} };
      const response = await action(actionParams);
      const dataRaw: unknown = await response.json();
      const data = dataRaw && typeof dataRaw === "object" && !Array.isArray(dataRaw) ? dataRaw as { success?: unknown; message?: unknown; error?: unknown } : {};

      expect(data).toEqual({ success: true, message: "Published successfully" });
    });
  });

  describe("Error Handling", () => {
    it("should reject non-POST methods", async () => {
      const request = new Request("http://localhost:3000/api/publish", {
        method: "GET",
      });

      const actionParams: { request: Request; params: Record<string, string>; context: Record<string, unknown> } = { request, params: {}, context: {} };
      const response = await action(actionParams);
      const dataRaw: unknown = await response.json();
      const data = dataRaw && typeof dataRaw === "object" && !Array.isArray(dataRaw) ? dataRaw as { success?: unknown; message?: unknown; error?: unknown } : {};

      expect(response.status).toBe(400);
      const success = typeof data.success === "boolean" ? data.success : data.success === 0 || data.success === false;
      expect(success).toBe(false);
    });

    it("should require authentication", async () => {
      // requireUserId throws a Response (redirect), not an Error
      const redirectResponse = new Response(null, {
        status: 302,
        headers: { Location: "/login" },
      });
      (requireUserId as ReturnType<typeof vi.fn>).mockImplementation(() => {
        throw redirectResponse;
      });

      const request = new Request("http://localhost:3000/api/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          relays: ["wss://relay1.com"],
          event: { id: "event-123" },
        }),
      });

      const response = await action({ request, params: {}, context: {} });
      // Response should be rethrown by error handler, so we should get a redirect
      expect(response.status).toBe(302);
      expect(response.headers.get("Location")).toBe("/login");
    });

    it("should return validation error for invalid JSON", async () => {
      const request = new Request("http://localhost:3000/api/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "invalid json",
      });

      const actionParams: { request: Request; params: Record<string, string>; context: Record<string, unknown> } = { request, params: {}, context: {} };
      const response = await action(actionParams);
      const dataRaw: unknown = await response.json();
      const data = dataRaw && typeof dataRaw === "object" && !Array.isArray(dataRaw) ? dataRaw as { success?: unknown; message?: unknown; error?: unknown } : {};

      expect(response.status).toBe(400);
      const success = typeof data.success === "boolean" ? data.success : data.success === 0 || data.success === false;
      expect(success).toBe(false);
    });

    it("should return validation error when event is missing", async () => {
      const request = new Request("http://localhost:3000/api/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          relays: ["wss://relay1.com"],
        }),
      });

      const actionParams: { request: Request; params: Record<string, string>; context: Record<string, unknown> } = { request, params: {}, context: {} };
      const response = await action(actionParams);
      const dataRaw: unknown = await response.json();
      const data = dataRaw && typeof dataRaw === "object" && !Array.isArray(dataRaw) ? dataRaw as { success?: unknown; message?: unknown; error?: unknown } : {};

      expect(response.status).toBe(400);
      const success = typeof data.success === "boolean" ? data.success : data.success === 0 || data.success === false;
      expect(success).toBe(false);
      expect(data.error).toBeDefined();
    });

    it("should return validation error when relays is missing", async () => {
      const request = new Request("http://localhost:3000/api/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event: { id: "event-123" },
        }),
      });

      const actionParams: { request: Request; params: Record<string, string>; context: Record<string, unknown> } = { request, params: {}, context: {} };
      const response = await action(actionParams);
      const dataRaw: unknown = await response.json();
      const data = dataRaw && typeof dataRaw === "object" && !Array.isArray(dataRaw) ? dataRaw as { success?: unknown; message?: unknown; error?: unknown } : {};

      expect(response.status).toBe(400);
      const success = typeof data.success === "boolean" ? data.success : data.success === 0 || data.success === false;
      expect(success).toBe(false);
    });

    it("should return validation error when relays is empty array", async () => {
      const request = new Request("http://localhost:3000/api/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          relays: [],
          event: { id: "event-123" },
        }),
      });

      const actionParams: { request: Request; params: Record<string, string>; context: Record<string, unknown> } = { request, params: {}, context: {} };
      const response = await action(actionParams);
      const dataRaw: unknown = await response.json();
      const data = dataRaw && typeof dataRaw === "object" && !Array.isArray(dataRaw) ? dataRaw as { success?: unknown; message?: unknown; error?: unknown } : {};

      expect(response.status).toBe(400);
      const success = typeof data.success === "boolean" ? data.success : data.success === 0 || data.success === false;
      expect(success).toBe(false);
    });

    it("should return error when NOSTR_PUBLISHER_URL is not configured", async () => {
      delete process.env.NOSTR_PUBLISHER_URL;

      const request = new Request("http://localhost:3000/api/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          relays: ["wss://relay1.com"],
          event: { id: "event-123" },
        }),
      });

      const actionParams: { request: Request; params: Record<string, string>; context: Record<string, unknown> } = { request, params: {}, context: {} };
      const response = await action(actionParams);
      const dataRaw: unknown = await response.json();
      const data = dataRaw && typeof dataRaw === "object" && !Array.isArray(dataRaw) ? dataRaw as { success?: unknown; message?: unknown; error?: unknown } : {};

      expect(response.status).toBe(400);
      const success = typeof data.success === "boolean" ? data.success : data.success === 0 || data.success === false;
      expect(success).toBe(false);
    });

    it("should handle fetch connection errors", async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error("Network error"),
      );

      const request = new Request("http://localhost:3000/api/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          relays: ["wss://relay1.com"],
          event: { id: "event-123" },
        }),
      });

      const actionParams: { request: Request; params: Record<string, string>; context: Record<string, unknown> } = { request, params: {}, context: {} };
      const response = await action(actionParams);
      const dataRaw: unknown = await response.json();
      const data = dataRaw && typeof dataRaw === "object" && !Array.isArray(dataRaw) ? dataRaw as { success?: unknown; message?: unknown; error?: unknown } : {};

      expect(response.status).toBe(503);
      const success = typeof data.success === "boolean" ? data.success : data.success === 0 || data.success === false;
      expect(success).toBe(false);
      expect(data.error).toBeDefined();
    });

    it("should handle non-ok responses from publisher", async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
        text: async () => "Publisher error",
      });

      const request = new Request("http://localhost:3000/api/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          relays: ["wss://relay1.com"],
          event: { id: "event-123" },
        }),
      });

      const actionParams: { request: Request; params: Record<string, string>; context: Record<string, unknown> } = { request, params: {}, context: {} };
      const response = await action(actionParams);
      const dataRaw: unknown = await response.json();
      const data = dataRaw && typeof dataRaw === "object" && !Array.isArray(dataRaw) ? dataRaw as { success?: unknown; message?: unknown; error?: unknown } : {};

      expect(response.status).toBe(502);
      const success = typeof data.success === "boolean" ? data.success : data.success === 0 || data.success === false;
      expect(success).toBe(false);
      expect(data.error).toBeDefined();
    });

    it("should handle 4xx errors from publisher", async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: false,
        status: 400,
        statusText: "Bad Request",
        text: async () => "Invalid event",
      });

      const request = new Request("http://localhost:3000/api/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          relays: ["wss://relay1.com"],
          event: { id: "event-123" },
        }),
      });

      const actionParams: { request: Request; params: Record<string, string>; context: Record<string, unknown> } = { request, params: {}, context: {} };
      const response = await action(actionParams);
      const dataRaw: unknown = await response.json();
      const data = dataRaw && typeof dataRaw === "object" && !Array.isArray(dataRaw) ? dataRaw as { success?: unknown; message?: unknown; error?: unknown } : {};

      expect(response.status).toBe(400);
      const success = typeof data.success === "boolean" ? data.success : data.success === 0 || data.success === false;
      expect(success).toBe(false);
    });
  });
});

