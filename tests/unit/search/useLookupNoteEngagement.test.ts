/**
 * @vitest-environment jsdom
 */
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("~/lib/nostr-adapter.client", () => ({
  nostrAdapter: {
    signEvent: vi.fn().mockResolvedValue({
      signedEvent: { id: "evt1", kind: 7, pubkey: "p1" },
    }),
  },
}));

import { useLookupNoteEngagement } from "~/features/search/hooks/useLookupNoteEngagement";
import { nostrAdapter } from "~/lib/nostr-adapter.client";

describe("useLookupNoteEngagement", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("publishes like with expected tags", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({}),
    });
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() =>
      useLookupNoteEngagement({
        eventId: "e".repeat(64),
        authorPubkey: "a".repeat(64),
        publishRelays: ["wss://relay.test"],
      })
    );

    await act(async () => {
      await result.current.likeNote();
    });

    expect(nostrAdapter.signEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 7,
        content: "+",
        tags: [
          ["e", "e".repeat(64)],
          ["p", "a".repeat(64)],
        ],
      }),
      expect.objectContaining({ clearCacheOnError: false })
    );

    const publishCall = fetchMock.mock.calls.find(
      (c) => c[0] === "/api/publish"
    );
    expect(publishCall).toBeDefined();
    const init = publishCall![1] as RequestInit;
    const body = JSON.parse(typeof init.body === "string" ? init.body : "") as {
      event: unknown;
    };
    expect(body.event).toEqual({ id: "evt1", kind: 7, pubkey: "p1" });

    vi.unstubAllGlobals();
  });

  it("sendReply includes e reply tag and recordAsReply", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({}),
    });
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() =>
      useLookupNoteEngagement({
        eventId: "e".repeat(64),
        authorPubkey: "a".repeat(64),
        publishRelays: ["wss://relay.test"],
      })
    );

    await act(async () => {
      await result.current.sendReply("hello");
    });

    expect(nostrAdapter.signEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 1,
        content: "hello",
        tags: [
          ["e", "e".repeat(64), "wss://relay.test", "reply"],
          ["p", "a".repeat(64)],
        ],
      }),
      expect.objectContaining({ clearCacheOnError: false })
    );

    const publishCall = fetchMock.mock.calls.find(
      (c) => c[0] === "/api/publish"
    );
    expect(publishCall).toBeDefined();
    const initReply = publishCall![1] as RequestInit;
    const body = JSON.parse(
      typeof initReply.body === "string" ? initReply.body : ""
    ) as {
      recordAsReply?: { replyToEventId: string };
    };
    expect(body.recordAsReply).toEqual({ replyToEventId: "e".repeat(64) });

    vi.unstubAllGlobals();
  });
});
