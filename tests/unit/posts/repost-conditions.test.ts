import { describe, expect, it } from "vitest";

import {
  countKind7Reactions,
  reactionsTowardMinimum,
  relaysForReactionCount,
  repostConditionsMet,
  type ReactionEvent,
} from "~/features/posts/repost-conditions";

const stats = {
  likes: 3,
  zaps: 0,
  replies: 0,
  reposts: 0,
  satszapped: 0,
};

function reaction(
  id: string,
  content: string,
  eventId = "note"
): ReactionEvent & { content: string } {
  return { id, kind: 7, content, tags: [["e", eventId]] };
}

describe("countKind7Reactions", () => {
  it("counts likes, emoji, and custom emoji once each", () => {
    const events: ReactionEvent[] = [
      reaction("like", "+"),
      reaction("blank", ""),
      reaction("emoji", "😂"),
      reaction("custom", ":keks:"),
      reaction("like", "+"),
      reaction("other-note", "😂", "someone-else"),
      { id: "reply", kind: 1, tags: [["e", "note"]] },
    ];

    expect(countKind7Reactions(events, "note")).toBe(4);
  });
});

describe("reactionsTowardMinimum", () => {
  it("uses the relay count when emoji reactions exceed Primal likes", () => {
    expect(reactionsTowardMinimum({ countedOnRelays: 8, primalLikes: 4 })).toBe(
      8
    );
  });

  it("keeps Primal likes when the relays returned fewer", () => {
    expect(reactionsTowardMinimum({ countedOnRelays: 2, primalLikes: 4 })).toBe(
      4
    );
  });

  it("falls back to Primal likes when the relay query failed", () => {
    expect(
      reactionsTowardMinimum({ countedOnRelays: null, primalLikes: 4 })
    ).toBe(4);
  });
});

describe("relaysForReactionCount", () => {
  it("keeps the account relays and adds the default write relays", () => {
    const relays = relaysForReactionCount([
      "wss://relay.example.com",
      "wss://relay.example.com",
      "https://not-a-relay",
    ]);

    expect(relays[0]).toBe("wss://relay.example.com");
    expect(relays).toContain("wss://relay.damus.io");
    expect(relays).not.toContain("https://not-a-relay");
  });
});

describe("repostConditionsMet", () => {
  it("publishes when emoji reactions reach the minimum", () => {
    expect(
      repostConditionsMet({
        conditions: { minReactions: 5 },
        stats,
        countedReactions: 7,
      })
    ).toBe(true);
  });

  it("skips when likes and other reactions together stay under the minimum", () => {
    expect(
      repostConditionsMet({
        conditions: { minReactions: 5 },
        stats,
        countedReactions: 4,
      })
    ).toBe(false);
  });

  it("still requires the other thresholds", () => {
    expect(
      repostConditionsMet({
        conditions: { minReactions: 5, minZaps: 2 },
        stats: { ...stats, zaps: 1 },
        countedReactions: 8,
      })
    ).toBe(false);
  });

  it("does not treat a failed reaction count as zero when likes already qualify", () => {
    expect(
      repostConditionsMet({
        conditions: { minReactions: 5 },
        stats: { ...stats, likes: 5 },
        countedReactions: null,
      })
    ).toBe(true);
  });
});
