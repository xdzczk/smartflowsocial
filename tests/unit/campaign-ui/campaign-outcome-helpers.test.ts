import { describe, expect, it } from "vitest";

import {
  buildContestOutcomePoolLine,
  buildGiveawayOutcomeLine,
} from "~/features/campaign-ui/campaign-outcome-helpers";

describe("buildGiveawayOutcomeLine", () => {
  it("returns payout line when planned sats positive", () => {
    expect(
      buildGiveawayOutcomeLine({ plannedPayoutSats: 9000, winnerCount: 3 })
    ).toBe("Up to 9,000 sats across 3 winners.");
  });

  it("returns selection-only line when no payout", () => {
    expect(
      buildGiveawayOutcomeLine({ plannedPayoutSats: null, winnerCount: 1 })
    ).toBe("Selection-only · 1 winner.");
  });
});

describe("buildContestOutcomePoolLine", () => {
  it("formats pool and winner count", () => {
    expect(
      buildContestOutcomePoolLine({ plannedPayoutSats: 3000, winnerCount: 3 })
    ).toBe("3,000 sats pool · 3 winners");
  });
});
