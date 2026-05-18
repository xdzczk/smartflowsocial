/**
 * Budget from giveaway row (draft / no snapshot)
 */

import { describe, it, expect } from "vitest";

import { budgetSatsFromGiveawayRow } from "~/features/giveaway/giveaway-payout.server";

describe("budgetSatsFromGiveawayRow", () => {
  it("uses snapshot when present", () => {
    expect(
      budgetSatsFromGiveawayRow({
        winnerSnapshot: [
          { pubkey: "a", npub: "n", qualifyingActions: [], satsPerWinner: 10 },
          { pubkey: "b", npub: "n", qualifyingActions: [], satsPerWinner: 5 },
        ],
        engagementConfig: { _simpleUnified: { satsPerWinner: 99 } },
      })
    ).toBe(15);
  });

  it("computes from _simpleUnified and winnerCount when no snapshot", () => {
    expect(
      budgetSatsFromGiveawayRow({
        winnerSnapshot: null,
        engagementConfig: { _simpleUnified: { satsPerWinner: 10 } },
        winnerCount: 6,
      })
    ).toBe(60);
  });

  it("falls back to plannedPayoutSats when config is missing", () => {
    expect(
      budgetSatsFromGiveawayRow({
        winnerSnapshot: null,
        engagementConfig: null,
        winnerCount: 5,
        plannedPayoutSats: 500,
      })
    ).toBe(500);
  });

  it("uses engagement config when snapshot winners lack satsPerWinner", () => {
    expect(
      budgetSatsFromGiveawayRow({
        winnerSnapshot: [
          { pubkey: "a", npub: "n", qualifyingActions: [] },
          { pubkey: "b", npub: "n", qualifyingActions: [] },
        ],
        engagementConfig: { _simpleUnified: { satsPerWinner: 21 } },
        winnerCount: 2,
      })
    ).toBe(42);
  });

  it("uses row plannedPayoutSats when snapshot winners lack sats", () => {
    expect(
      budgetSatsFromGiveawayRow({
        winnerSnapshot: [{ pubkey: "a", npub: "n", qualifyingActions: [] }],
        engagementConfig: null,
        winnerCount: 5,
        plannedPayoutSats: 105,
      })
    ).toBe(105);
  });
});
