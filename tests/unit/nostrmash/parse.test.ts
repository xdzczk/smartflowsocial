import { describe, expect, it } from "vitest";

import {
  parseAuthorPage,
  parseCounts,
  parseEventLookup,
  profileMetadataContent,
  satsFromMsats,
} from "~/features/nostrmash/parse";

const EVENT_ID =
  "8d26a35223177b6f1b09d329b021146ce2ed5dd93d5bc0ea48bc754af3a9cbe9";

describe("NostrMash response parsing", () => {
  it("reads an author page of event objects and an omitted cursor", () => {
    const page = parseAuthorPage({
      pubkey: "ab".repeat(32),
      events: [
        {
          id: EVENT_ID,
          kind: 1,
          created_at: 1_784_654_940,
          content: "built on nostr",
          pubkey: "cd".repeat(32),
          tags: [["p", "someone"]],
          sig: "sig",
        },
      ],
    });
    expect(page?.nextCursor).toBeNull();
    expect(page?.events).toEqual([
      {
        nostrEventId: EVENT_ID,
        kind: 1,
        eventCreatedAt: new Date(1_784_654_940 * 1000),
        contentExcerpt: "built on nostr",
      },
    ]);
  });

  it("reads reply items", () => {
    const page = parseAuthorPage({
      pubkey: "ab".repeat(32),
      items: [
        {
          id: EVENT_ID,
          kind: 1,
          created_at: 10,
          content: "a reply",
        },
      ],
      next_cursor: "next",
    });
    expect(page?.nextCursor).toBe("next");
    expect(page?.events[0]?.contentExcerpt).toBe("a reply");
  });

  it("treats 404 not_found as a miss and ignores count payloads for that decision", () => {
    expect(
      parseEventLookup(404, {
        error: { code: "not_found", message: "event not found" },
      })
    ).toEqual({ status: "missing" });
    expect(
      parseCounts({
        consistency: "eventual",
        event_id: "a".repeat(64),
        reaction_count: 0,
        reply_count: 1,
        repost_count: 0,
        zap_count: 0,
        zap_msats: 0,
      })?.replyCount
    ).toBe(1);
  });

  it("parses a present event and its counts", () => {
    expect(
      parseEventLookup(200, {
        event: { id: EVENT_ID, kind: 1, content: "hi" },
        consistency: "strong",
      })
    ).toEqual({ status: "present" });
    expect(
      parseCounts({
        event_id: EVENT_ID,
        reply_count: 116,
        reaction_count: 15,
        repost_count: 3,
        zap_count: 1,
        zap_msats: 21000,
        consistency: "eventual",
      })
    ).toMatchObject({
      replyCount: 116,
      reactionCount: 15,
      zapMsats: 21000n,
    });
    expect(satsFromMsats(21000n)).toBe(21);
  });

  it("keeps profile metadata fields and drops wrapper keys", () => {
    expect(
      profileMetadataContent({
        name: "jack",
        display_name: "Jack",
        id: "event",
        tags: [["p", "x"]],
        msg: "ignore",
      })
    ).toBe(JSON.stringify({ name: "jack", display_name: "Jack" }));
  });
});
