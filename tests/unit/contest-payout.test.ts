import { describe, expect, it } from "vitest";

import {
  allContestWinnersSettled,
  buildInitialContestPayoutState,
  normalizeContestPayoutState,
} from "~/features/contest/contest-payout.server";

describe("contest payout helpers", () => {
  it("builds initial pending state", () => {
    const state = buildInitialContestPayoutState(["pk1", "pk2"]);
    expect(state["pk1"]?.status).toBe("pending");
    expect(state["pk2"]?.status).toBe("pending");
  });

  it("normalizes missing winner state", () => {
    const state = normalizeContestPayoutState(
      {
        pk1: { status: "sent", updatedAt: "2026-03-23T00:00:00.000Z" },
      },
      ["pk1", "pk2"]
    );
    expect(state["pk1"]?.status).toBe("sent");
    expect(state["pk2"]?.status).toBe("pending");
  });

  it("checks settled winners correctly", () => {
    const settled = allContestWinnersSettled(
      {
        pk1: { status: "sent", updatedAt: "x" },
        pk2: { status: "marked_paid", updatedAt: "y" },
      },
      ["pk1", "pk2"]
    );
    expect(settled).toBe(true);
  });
});
