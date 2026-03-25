/**
 * Unit tests for giveaway winner selection
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("nostr-tools", () => ({
  nip19: {
    npubEncode: (hex: string) => `npub_${hex.slice(0, 8)}`,
  },
}));

import {
  runGiveawayAccountPoolSelection,
  runGiveawaySelection,
  runGiveawaySelectionPerEngagement,
} from "~/features/giveaway/giveaway-selection.server";
import type { RelatedEvent } from "~/features/giveaway/types";

const makeEvent = (
  id: string,
  pubkey: string,
  kind: number
): { id: string; pubkey: string; kind: number } => ({
  id,
  pubkey,
  kind,
});

describe("runGiveawaySelection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(global.Math, "random").mockReturnValue(0.5);
  });

  it("returns empty array when no related events", () => {
    const result = runGiveawaySelection({
      relatedEvents: [],
      engagementTypes: ["REACTION", "REPOST", "COMMENT", "ZAP"],
      selectionMode: "UNIQUE_USER",
      winnerCount: 3,
    });
    expect(result).toEqual([]);
  });

  it("filters by engagement types and dedupes by pubkey", () => {
    const events = [
      makeEvent("e1", "pk1", 7),
      makeEvent("e2", "pk1", 6),
      makeEvent("e3", "pk2", 1),
      makeEvent("e4", "pk3", 9735),
    ];
    const result = runGiveawaySelection({
      relatedEvents: events as RelatedEvent[],
      engagementTypes: ["REACTION", "REPOST", "COMMENT", "ZAP"],
      selectionMode: "UNIQUE_USER",
      winnerCount: 10,
    });
    expect(result.length).toBeLessThanOrEqual(3);
    const pubkeys = new Set(result.map((w) => w.pubkey));
    expect(pubkeys.size).toBe(result.length);
    result.forEach((w) => {
      expect(w).toHaveProperty("pubkey");
      expect(w).toHaveProperty("npub");
      expect(w.npub).toMatch(/^npub_/);
      expect(Array.isArray(w.qualifyingActions)).toBe(true);
    });
  });

  it("respects winnerCount cap", () => {
    const events = [
      makeEvent("e1", "pk1", 7),
      makeEvent("e2", "pk2", 7),
      makeEvent("e3", "pk3", 7),
      makeEvent("e4", "pk4", 7),
      makeEvent("e5", "pk5", 7),
    ];
    const result = runGiveawaySelection({
      relatedEvents: events as RelatedEvent[],
      engagementTypes: ["REACTION"],
      selectionMode: "UNIQUE_USER",
      winnerCount: 2,
    });
    expect(result.length).toBe(2);
  });

  it("runGiveawayAccountPoolSelection picks random unique pubkeys ignoring kind", () => {
    const events = [
      makeEvent("e1", "pk1", 7),
      makeEvent("e2", "pk2", 1),
      makeEvent("e3", "pk3", 6),
    ];
    const result = runGiveawayAccountPoolSelection(events as RelatedEvent[], 2);
    expect(result.length).toBe(2);
    expect(new Set(result.map((w) => w.pubkey)).size).toBe(2);
  });

  it("supports WEIGHTED_BY_ENGAGEMENT selection mode", () => {
    const events = [
      makeEvent("e1", "pk1", 6),
      makeEvent("e2", "pk1", 6),
      makeEvent("e3", "pk2", 7),
    ];
    const result = runGiveawaySelection({
      relatedEvents: events as RelatedEvent[],
      engagementTypes: ["REACTION", "REPOST"],
      selectionMode: "WEIGHTED_BY_ENGAGEMENT",
      winnerCount: 2,
    });
    expect(result.length).toBeLessThanOrEqual(2);
  });

  it("runGiveawaySelectionPerEngagement avoids the same pubkey winning multiple types", () => {
    vi.spyOn(global.Math, "random").mockReturnValue(0);
    const events = [
      // COMMENT events: pk1 then pk2 (pk1 will be chosen first)
      makeEvent("c1", "pk1", 1),
      makeEvent("c2", "pk2", 1),
      // REACTION events: pk1 then pk3 (pk1 would overlap without exclusion)
      makeEvent("r1", "pk1", 7),
      makeEvent("r2", "pk3", 7),
    ];
    const result = runGiveawaySelectionPerEngagement({
      relatedEvents: events as RelatedEvent[],
      engagementConfig: {
        COMMENT: { winnerCount: 1, satsPerWinner: 0 },
        REACTION: { winnerCount: 1, satsPerWinner: 0 },
      },
      selectionMode: "WEIGHTED_BY_ENGAGEMENT",
    });
    expect(result.map((w) => w.pubkey).sort()).toEqual(["pk1", "pk3"].sort());
  });
});
