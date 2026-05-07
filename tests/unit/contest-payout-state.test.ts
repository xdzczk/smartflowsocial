import { describe, expect, it } from "vitest";

import { normalizeContestPayoutState } from "~/features/contest/contest-payout.server";

describe("normalizeContestPayoutState", () => {
  const pubkeys = ["a".repeat(64), "b".repeat(64)];

  it("preserves claim_needed and skipped statuses", () => {
    const state = normalizeContestPayoutState(
      {
        [pubkeys[0]!]: {
          status: "claim_needed",
          updatedAt: "2026-05-07T10:00:00.000Z",
          note: "Invoice generated; awaiting payment confirmation",
        },
        [pubkeys[1]!]: {
          status: "skipped",
          updatedAt: "2026-05-07T11:00:00.000Z",
          note: "Skipped — wallet not connected",
        },
      },
      pubkeys
    );

    expect(state[pubkeys[0]!]?.status).toBe("claim_needed");
    expect(state[pubkeys[0]!]?.note).toContain("Invoice");
    expect(state[pubkeys[1]!]?.status).toBe("skipped");
    expect(state[pubkeys[1]!]?.note).toContain("Skipped");
  });
});
