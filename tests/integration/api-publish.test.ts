/**
 * Integration tests for publish API route
 *
 * Tests the API endpoint in app/routes/api.publish.tsx
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock dependencies
vi.mock("~/features/auth", () => ({
  requireSession: vi.fn(),
  requireUserId: vi.fn(),
}));

vi.mock("~/features/nostr/server", () => ({
  publishSignedEventToRelays: vi.fn(),
}));

vi.mock("~/features/relays/relay-resolution.server", () => ({
  resolveExecutionRelays: vi.fn(),
}));

vi.mock("~/features/relays/publish-relay-acks.server", () => ({
  persistPublishRelayAcks: vi.fn(),
}));

import { TEST_USER_ID } from "../utils/test-helpers";

import { requireSession } from "~/features/auth";
import { publishSignedEventToRelays } from "~/features/nostr/server";
import { persistPublishRelayAcks } from "~/features/relays/publish-relay-acks.server";
import { resolveExecutionRelays } from "~/features/relays/relay-resolution.server";
import { action } from "~/routes/api.publish";

describe("API: Publish", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (requireSession as ReturnType<typeof vi.fn>).mockResolvedValue({
      userId: TEST_USER_ID,
      pubkey: "test-pubkey",
      sessionId: "session-1",
    });
    (resolveExecutionRelays as ReturnType<typeof vi.fn>).mockResolvedValue([
      "wss://resolved.example.com",
    ]);
    (persistPublishRelayAcks as ReturnType<typeof vi.fn>).mockResolvedValue(
      undefined
    );
    (publishSignedEventToRelays as ReturnType<typeof vi.fn>).mockResolvedValue({
      results: [],
    });
  });

  describe("Successful Requests", () => {
    it("should publish event via feature service", async () => {
      const mockEvent = {
        id: "event-123",
        pubkey: "test-pubkey",
        kind: 1,
        content: "Test post",
      };

      const mockRelays = ["wss://relay1.com", "wss://relay2.com"];

      const request = new Request("http://localhost:3000/api/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          relays: mockRelays,
          event: mockEvent,
        }),
      });

      const actionParams: {
        request: Request;
        params: Record<string, string>;
        context: Record<string, unknown>;
      } = { request, params: {}, context: {} };
      const response = await action(actionParams);
      const dataRaw: unknown = await response.json();
      const data =
        dataRaw && typeof dataRaw === "object" && !Array.isArray(dataRaw)
          ? (dataRaw as {
              success?: unknown;
              message?: unknown;
              error?: unknown;
            })
          : {};

      expect(requireSession).toHaveBeenCalledWith(request);
      expect(publishSignedEventToRelays).toHaveBeenCalledWith({
        signedEvent: mockEvent,
        relays: ["wss://resolved.example.com"],
      });
      expect(persistPublishRelayAcks).toHaveBeenCalledWith({
        publishAttemptId: "api:event-123",
        userId: TEST_USER_ID,
        eventId: "event-123",
        results: [],
      });
      expect(data).toEqual({ success: true });
    });

    it("should allow missing relays (defaults handled by publisher)", async () => {
      const mockEvent = { id: "event-123", pubkey: "test-pubkey" };

      const request = new Request("http://localhost:3000/api/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event: mockEvent,
        }),
      });

      const actionParams: {
        request: Request;
        params: Record<string, string>;
        context: Record<string, unknown>;
      } = { request, params: {}, context: {} };
      const response = await action(actionParams);
      const dataRaw: unknown = await response.json();
      const data =
        dataRaw && typeof dataRaw === "object" && !Array.isArray(dataRaw)
          ? (dataRaw as {
              success?: unknown;
              message?: unknown;
              error?: unknown;
            })
          : {};

      expect(publishSignedEventToRelays).toHaveBeenCalledWith({
        signedEvent: mockEvent,
        relays: ["wss://resolved.example.com"],
      });
      expect(persistPublishRelayAcks).toHaveBeenCalledWith({
        publishAttemptId: "api:event-123",
        userId: TEST_USER_ID,
        eventId: "event-123",
        results: [],
      });
      expect(data).toEqual({ success: true });
    });
  });

  describe("Error Handling", () => {
    it("should reject non-POST methods", async () => {
      const request = new Request("http://localhost:3000/api/publish", {
        method: "GET",
      });

      const actionParams: {
        request: Request;
        params: Record<string, string>;
        context: Record<string, unknown>;
      } = { request, params: {}, context: {} };
      const response = await action(actionParams);
      const dataRaw: unknown = await response.json();
      const data =
        dataRaw && typeof dataRaw === "object" && !Array.isArray(dataRaw)
          ? (dataRaw as {
              success?: unknown;
              message?: unknown;
              error?: unknown;
            })
          : {};

      expect(response.status).toBe(400);
      const success =
        typeof data.success === "boolean"
          ? data.success
          : data.success === 0 || data.success === false;
      expect(success).toBe(false);
    });

    it("should require authentication", async () => {
      // requireSession throws a Response (redirect), not an Error
      const redirectResponse = new Response(null, {
        status: 302,
        headers: { Location: "/login" },
      });
      (requireSession as ReturnType<typeof vi.fn>).mockImplementation(() => {
        throw redirectResponse;
      });

      const request = new Request("http://localhost:3000/api/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          relays: ["wss://relay1.com"],
          event: { id: "event-123", pubkey: "test-pubkey" },
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

      const actionParams: {
        request: Request;
        params: Record<string, string>;
        context: Record<string, unknown>;
      } = { request, params: {}, context: {} };
      const response = await action(actionParams);
      const dataRaw: unknown = await response.json();
      const data =
        dataRaw && typeof dataRaw === "object" && !Array.isArray(dataRaw)
          ? (dataRaw as {
              success?: unknown;
              message?: unknown;
              error?: unknown;
            })
          : {};

      expect(response.status).toBe(400);
      const success =
        typeof data.success === "boolean"
          ? data.success
          : data.success === 0 || data.success === false;
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

      const actionParams: {
        request: Request;
        params: Record<string, string>;
        context: Record<string, unknown>;
      } = { request, params: {}, context: {} };
      const response = await action(actionParams);
      const dataRaw: unknown = await response.json();
      const data =
        dataRaw && typeof dataRaw === "object" && !Array.isArray(dataRaw)
          ? (dataRaw as {
              success?: unknown;
              message?: unknown;
              error?: unknown;
            })
          : {};

      expect(response.status).toBe(400);
      const success =
        typeof data.success === "boolean"
          ? data.success
          : data.success === 0 || data.success === false;
      expect(success).toBe(false);
      expect(data.error).toBeDefined();
    });
  });
});
