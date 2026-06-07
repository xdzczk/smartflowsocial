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

vi.mock("~/features/user/services/user-cache.server", () => ({
  invalidateRelayIntentCache: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("~/lib/feature-flags.server", async (importOriginal) => {
  const actualUnknown: unknown = await importOriginal();
  if (
    actualUnknown === null ||
    typeof actualUnknown !== "object" ||
    !("featureFlags" in actualUnknown) ||
    typeof actualUnknown.featureFlags !== "object" ||
    actualUnknown.featureFlags === null
  ) {
    throw new Error("feature-flags.server mock: unexpected importOriginal()");
  }
  const previousFlags = {
    ...(actualUnknown as { featureFlags: Record<string, unknown> })
      .featureFlags,
  };
  return {
    featureFlags: {
      ...previousFlags,
      nip88PollsEnabled: true,
    },
  };
});

import {
  createValidSignedEvent,
  getTestPublicKey,
} from "../utils/nostr-test-helpers";
import { TEST_USER_ID } from "../utils/test-helpers";

import { requireSession } from "~/features/auth";
import { KIND_RELAY_LIST_NIP65 } from "~/features/nostr/nostr-event-kinds";
import { publishSignedEventToRelays } from "~/features/nostr/server";
import { buildPollTags, KIND_VOTE } from "~/features/polls";
import { persistPublishRelayAcks } from "~/features/relays/publish-relay-acks.server";
import { resolveExecutionRelays } from "~/features/relays/relay-resolution.server";
import { invalidateRelayIntentCache } from "~/features/user/services/user-cache.server";
import { _resetPublishAttemptDedupeForTests } from "~/lib/publish-attempt-dedupe.server";
import { action } from "~/routes/api.publish";

describe("API: Publish", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    _resetPublishAttemptDedupeForTests();
    (requireSession as ReturnType<typeof vi.fn>).mockResolvedValue({
      userId: TEST_USER_ID,
      pubkey: getTestPublicKey(),
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
      const mockEvent = createValidSignedEvent({
        kind: 1,
        content: "Test post",
      });

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
      expect(publishSignedEventToRelays).toHaveBeenCalled();
      const publishInput = vi.mocked(publishSignedEventToRelays).mock
        .calls[0]![0];
      expect(publishInput.signedEvent.id).toBe(mockEvent.id);
      expect(publishInput.signedEvent.kind).toBe(1);
      expect(publishInput.signedEvent.pubkey).toBe(mockEvent.pubkey);
      expect(publishInput.relays).toEqual(["wss://resolved.example.com"]);
      expect(persistPublishRelayAcks).toHaveBeenCalledWith({
        publishAttemptId: `api:${mockEvent.id}`,
        userId: TEST_USER_ID,
        eventId: mockEvent.id,
        results: [],
      });
      expect(data).toEqual({ success: true });
    });

    it("should publish kind 10002 and invalidate relay intent cache", async () => {
      const mockEvent = createValidSignedEvent({
        kind: KIND_RELAY_LIST_NIP65,
        content: "",
        tags: [["r", "wss://relay.example.com"]],
      });

      const request = new Request("http://localhost:3000/api/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event: mockEvent }),
      });

      const response = await action({
        request,
        params: {},
        context: {},
      });
      const dataRaw: unknown = await response.json();
      const data =
        dataRaw && typeof dataRaw === "object" && !Array.isArray(dataRaw)
          ? (dataRaw as { success?: unknown })
          : {};

      expect(publishSignedEventToRelays).toHaveBeenCalled();
      expect(invalidateRelayIntentCache).toHaveBeenCalledWith(TEST_USER_ID);
      expect(data).toEqual({ success: true });
    });

    it("should allow missing relays (defaults handled by publisher)", async () => {
      const mockEvent = createValidSignedEvent({ kind: 1, content: "Note" });

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

      expect(publishSignedEventToRelays).toHaveBeenCalled();
      const publishInputMissingRelays = vi.mocked(publishSignedEventToRelays)
        .mock.calls[0]![0];
      expect(publishInputMissingRelays.signedEvent.id).toBe(mockEvent.id);
      expect(publishInputMissingRelays.signedEvent.kind).toBe(1);
      expect(publishInputMissingRelays.signedEvent.pubkey).toBe(
        mockEvent.pubkey
      );
      expect(publishInputMissingRelays.relays).toEqual([
        "wss://resolved.example.com",
      ]);
      expect(persistPublishRelayAcks).toHaveBeenCalledWith({
        publishAttemptId: `api:${mockEvent.id}`,
        userId: TEST_USER_ID,
        eventId: mockEvent.id,
        results: [],
      });
      expect(data).toEqual({ success: true });
    });

    it("should merge execution relays with poll relay tags for NIP-88 kind 1018", async () => {
      const pollTags = buildPollTags({
        optionLabels: ["A", "B"],
        pollType: "singlechoice",
        relayUrls: ["wss://poll-relay.example"],
      });
      const optionRow = pollTags.find((t) => t[0] === "option");
      const optionId = optionRow?.[1];
      if (!optionId) {
        throw new Error("expected option id from buildPollTags");
      }

      const pollEvent = createValidSignedEvent({
        kind: 1068,
        content: "Pick one?",
        tags: pollTags,
      });

      const voteEvent = createValidSignedEvent({
        kind: KIND_VOTE,
        content: "",
        tags: [
          ["e", pollEvent.id],
          ["response", optionId],
        ],
        created_at: pollEvent.created_at + 2,
      });

      const request = new Request("http://localhost:3000/api/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event: voteEvent,
          pollEvent,
        }),
      });

      const response = await action({ request, params: {}, context: {} });
      const dataRaw: unknown = await response.json();
      const data =
        dataRaw && typeof dataRaw === "object" && !Array.isArray(dataRaw)
          ? (dataRaw as { success?: unknown })
          : {};

      expect(data).toEqual({ success: true });
      expect(publishSignedEventToRelays).toHaveBeenCalled();
      const publishVoteInput = vi.mocked(publishSignedEventToRelays).mock
        .calls[0]![0];
      expect(publishVoteInput.signedEvent.id).toBe(voteEvent.id);
      expect(publishVoteInput.signedEvent.kind).toBe(KIND_VOTE);
      expect(publishVoteInput.signedEvent.pubkey).toBe(voteEvent.pubkey);
      expect(publishVoteInput.relays).toEqual([
        "wss://resolved.example.com",
        "wss://poll-relay.example",
      ]);
    });

    it("should dedupe overlapping execution and poll relays for kind 1018", async () => {
      (resolveExecutionRelays as ReturnType<typeof vi.fn>).mockResolvedValue([
        "wss://shared.example.com",
      ]);

      const pollTags = buildPollTags({
        optionLabels: ["A", "B"],
        pollType: "singlechoice",
        relayUrls: ["wss://shared.example.com", "wss://poll-only.example.com"],
      });
      const optionId = pollTags.find((t) => t[0] === "option")?.[1];
      if (!optionId) throw new Error("expected option id");

      const pollEvent = createValidSignedEvent({
        kind: 1068,
        content: "Q",
        tags: pollTags,
      });
      const voteEvent = createValidSignedEvent({
        kind: KIND_VOTE,
        content: "",
        tags: [
          ["e", pollEvent.id],
          ["response", optionId],
        ],
        created_at: pollEvent.created_at + 1,
      });

      const request = new Request("http://localhost:3000/api/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event: voteEvent, pollEvent }),
      });

      await action({ request, params: {}, context: {} });

      expect(publishSignedEventToRelays).toHaveBeenCalled();
      const publishDedupedInput = vi.mocked(publishSignedEventToRelays).mock
        .calls[0]![0];
      expect(publishDedupedInput.signedEvent.id).toBe(voteEvent.id);
      expect(publishDedupedInput.signedEvent.kind).toBe(KIND_VOTE);
      expect(publishDedupedInput.signedEvent.pubkey).toBe(voteEvent.pubkey);
      expect(publishDedupedInput.relays).toEqual([
        "wss://shared.example.com",
        "wss://poll-only.example.com",
      ]);
    });
  });

  describe("Attempt-id idempotency", () => {
    it("runs publish + side effects once across two POSTs sharing an attemptId", async () => {
      const mockEvent = createValidSignedEvent({
        kind: 1,
        content: "Idempotent post",
      });
      const attemptId = "attempt-uuid-aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";

      const buildRequest = (): Request =>
        new Request("http://localhost:3000/api/publish", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ event: mockEvent, attemptId }),
        });

      const firstResponse = await action({
        request: buildRequest(),
        params: {},
        context: {},
      });
      const firstRaw: unknown = await firstResponse.json();
      const firstBody =
        firstRaw && typeof firstRaw === "object" && !Array.isArray(firstRaw)
          ? (firstRaw as { success?: unknown; deduped?: unknown })
          : {};

      const secondResponse = await action({
        request: buildRequest(),
        params: {},
        context: {},
      });
      const secondRaw: unknown = await secondResponse.json();
      const secondBody =
        secondRaw && typeof secondRaw === "object" && !Array.isArray(secondRaw)
          ? (secondRaw as { success?: unknown; deduped?: unknown })
          : {};

      expect(firstBody).toEqual({ success: true });
      expect(secondBody).toEqual({ success: true, deduped: true });
      // Relays may be called twice (publishing is intrinsically idempotent
      // by event id) but the side-effect surface MUST run exactly once.
      expect(persistPublishRelayAcks).toHaveBeenCalledTimes(1);
    });

    it("treats distinct attemptIds as independent (both run side effects)", async () => {
      const mockEvent = createValidSignedEvent({
        kind: 1,
        content: "Two attempts",
      });

      const requestA = new Request("http://localhost:3000/api/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event: mockEvent, attemptId: "attempt-A" }),
      });
      const requestB = new Request("http://localhost:3000/api/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event: mockEvent, attemptId: "attempt-B" }),
      });

      await action({ request: requestA, params: {}, context: {} });
      await action({ request: requestB, params: {}, context: {} });

      expect(persistPublishRelayAcks).toHaveBeenCalledTimes(2);
    });

    it("preserves legacy behavior when attemptId is omitted (no dedupe)", async () => {
      const mockEvent = createValidSignedEvent({
        kind: 1,
        content: "Legacy client",
      });

      const buildRequest = (): Request =>
        new Request("http://localhost:3000/api/publish", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ event: mockEvent }),
        });

      await action({ request: buildRequest(), params: {}, context: {} });
      await action({ request: buildRequest(), params: {}, context: {} });

      expect(persistPublishRelayAcks).toHaveBeenCalledTimes(2);
    });

    it("ignores malformed attemptId (empty / oversized) and falls back to legacy path", async () => {
      const mockEvent = createValidSignedEvent({
        kind: 1,
        content: "Bad attempt id",
      });

      const requestEmpty = new Request("http://localhost:3000/api/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event: mockEvent, attemptId: "   " }),
      });
      const requestOversized = new Request(
        "http://localhost:3000/api/publish",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            event: mockEvent,
            attemptId: "x".repeat(200),
          }),
        }
      );

      await action({ request: requestEmpty, params: {}, context: {} });
      await action({ request: requestOversized, params: {}, context: {} });

      expect(persistPublishRelayAcks).toHaveBeenCalledTimes(2);
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

    it("should reject kind 1018 without pollEvent", async () => {
      const pollTags = buildPollTags({
        optionLabels: ["A", "B"],
        pollType: "singlechoice",
        relayUrls: ["wss://poll.example"],
      });
      const optionId = pollTags.find((t) => t[0] === "option")?.[1];
      if (!optionId) throw new Error("expected option id");
      const pollEvent = createValidSignedEvent({
        kind: 1068,
        content: "Q",
        tags: pollTags,
      });
      const voteEvent = createValidSignedEvent({
        kind: KIND_VOTE,
        content: "",
        tags: [
          ["e", pollEvent.id],
          ["response", optionId],
        ],
        created_at: pollEvent.created_at + 1,
      });

      const request = new Request("http://localhost:3000/api/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event: voteEvent }),
      });

      const response = await action({ request, params: {}, context: {} });
      expect(response.status).toBe(400);
    });
  });
});
