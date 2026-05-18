import { describe, it, expect } from "vitest";

import { runSelectionForGiveaway } from "~/features/giveaway/giveaway-actions-eligibility.server";
import { quoteGiveawayFinalization } from "~/features/giveaway/giveaway-finalization-fee.server";
import type { RelatedEvent } from "~/features/giveaway/types";

describe("giveaway planned payout", () => {
  it("attaches sats for followers giveaways with simple unified config", () => {
    const g = {
      scopeType: "FOLLOWERS",
      scopeReference: {},
      winnerCount: 2,
      engagementTypes: [],
      selectionMode: "UNIQUE_USER",
      engagementConfig: { _simpleUnified: { satsPerWinner: 21 } },
      engagementWeights: null,
    } as unknown as Parameters<typeof runSelectionForGiveaway>[0];

    const relatedEvents: RelatedEvent[] = [
      { id: "e1", pubkey: "pk1", kind: 0, created_at: 1 },
      { id: "e2", pubkey: "pk2", kind: 0, created_at: 2 },
      { id: "e3", pubkey: "pk3", kind: 0, created_at: 3 },
    ];

    const winners = runSelectionForGiveaway(g, relatedEvents);

    expect(winners.length).toBe(2);
    expect(winners.every((w) => w.satsPerWinner === 21)).toBe(true);
  });

  it("quotes planned payout from engagement config when snapshot lacks sats", () => {
    const quote = quoteGiveawayFinalization({
      giveaway: {
        winnerSnapshot: [
          { pubkey: "a", npub: "n", qualifyingActions: [] },
          { pubkey: "b", npub: "n", qualifyingActions: [] },
        ],
        engagementConfig: { _simpleUnified: { satsPerWinner: 21 } },
        winnerCount: 2,
        plannedPayoutSats: 42,
        selectionMode: "UNIQUE_USER",
        scopeType: "FOLLOWERS",
        scopeReference: {},
        engagementTypes: [],
        filters: null,
        engagementWeights: null,
      },
      planType: "free",
    });

    expect(quote.plannedPayoutSats).toBe(42);
  });
});
