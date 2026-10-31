import { afterEach, describe, expect, it, vi } from "vitest";

import { tryNativePrimalFrames } from "~/features/nostrmash/native-frames.server";

const PUBKEY = "a".repeat(64);
const EVENT_ID = "b".repeat(64);

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function eventContent(
  messages: unknown[] | null,
  kind: number
): Record<string, unknown> | null {
  if (!messages) return null;
  for (const message of messages) {
    if (!Array.isArray(message) || message[0] !== "EVENT") continue;
    const event = message[2] as { kind?: number; content?: string };
    if (event.kind !== kind || typeof event.content !== "string") continue;
    return JSON.parse(event.content) as Record<string, unknown>;
  }
  return null;
}

describe("native Primal frames", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("turns a profile summary into kind 0 and kind 10000105", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        jsonResponse({
          pubkey: PUBKEY,
          metadata_event_id: "c".repeat(64),
          metadata_created_at: 10,
          profile: { name: "ada", display_name: "Ada", tags: [] },
          stats: {
            follower_count: 3,
            following_count: 4,
            note_count: 5,
            zap_received_count: 6,
            sats_zapped: 7,
          },
        })
      )
    );

    const messages = await tryNativePrimalFrames("user_profile", {
      pubkey: PUBKEY,
    });
    expect(eventContent(messages, 0)).toMatchObject({
      name: "ada",
      display_name: "Ada",
    });
    expect(eventContent(messages, 10000105)).toMatchObject({
      followers_count: 3,
      follows_count: 4,
      note_count: 5,
      total_zap_count: 6,
      total_satszapped: 7,
    });
  });

  it("leaves zapped threads on the Primal fallback", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/counts")) {
        return jsonResponse({
          event_id: EVENT_ID,
          reply_count: 1,
          reaction_count: 0,
          repost_count: 0,
          zap_count: 2,
          zap_msats: 1000,
          consistency: "eventual",
        });
      }
      return jsonResponse({
        event: {
          id: EVENT_ID,
          kind: 1,
          content: "zapped",
          pubkey: PUBKEY,
          created_at: 10,
        },
        consistency: "strong",
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const messages = await tryNativePrimalFrames("thread_view", {
      event_id: EVENT_ID,
    });
    expect(messages).toBeNull();
    expect(
      fetchMock.mock.calls.some((call) => String(call[0]).includes("/threads/"))
    ).toBe(false);
  });

  it("returns null for an unmapped cache call", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    expect(
      await tryNativePrimalFrames("get_notifications", { pubkey: PUBKEY })
    ).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
