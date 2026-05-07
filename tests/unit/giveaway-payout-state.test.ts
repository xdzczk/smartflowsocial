import { describe, expect, it } from "vitest";

import { normalizePayoutState } from "~/features/giveaway/giveaway-payout.server";
import type { GiveawayWinnerEntry } from "~/features/giveaway/types";

describe("normalizePayoutState", () => {
  const snapshot: GiveawayWinnerEntry[] = [
    {
      pubkey: "a".repeat(64),
      npub: "npub1a",
      qualifyingActions: [],
      satsPerWinner: 100,
    },
    {
      pubkey: "b".repeat(64),
      npub: "npub1b",
      qualifyingActions: [],
      satsPerWinner: 100,
    },
  ];

  it("preserves claim_needed and skipped statuses", () => {
    const state = normalizePayoutState(
      {
        [snapshot[0]!.pubkey]: {
          status: "claim_needed",
          updatedAt: "2026-05-07T10:00:00.000Z",
        },
        [snapshot[1]!.pubkey]: {
          status: "skipped",
          updatedAt: "2026-05-07T11:00:00.000Z",
          note: "Skipped — wallet not connected",
        },
      },
      snapshot
    );

    expect(state[snapshot[0]!.pubkey]?.status).toBe("claim_needed");
    expect(state[snapshot[1]!.pubkey]?.status).toBe("skipped");
    expect(state[snapshot[1]!.pubkey]?.note).toContain("Skipped");
  });
});
