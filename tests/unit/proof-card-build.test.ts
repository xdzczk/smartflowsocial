import { describe, expect, it } from "vitest";

import {
  buildProofCardLines,
  proofCardSummaryText,
} from "~/features/admin/components/proof-card-build";
import type { ProofCardData } from "~/features/admin/proof-card-types";

function baseData(over: Partial<ProofCardData> = {}): ProofCardData {
  return {
    rangePreset: "30d",
    rangeLabel: "Last 30 days",
    generatedAt: "2025-01-15T12:00:00.000Z",
    allTime: {
      postsPublished: 1000,
      longFormPublished: 50,
      creatorsEverPublished: 80,
      postsScheduled: 12,
      referralSatsPaid: 0,
    },
    inRange: {
      postsPublished: 40,
      longFormPublished: 2,
      referredSignups: 0,
      postsWithMedia: 15,
      publishersInRange: 10,
      scheduledReposts: 3,
      giveawaysLockedOrPaid: 1,
    },
    last30d: {
      publishSuccessRate: 97.5,
      successfulShortPublishes: 200,
      failedShortPublishes: 5,
    },
    reliability30d: {
      failedReferralPayouts: 0,
    },
    ...over,
  };
}

describe("buildProofCardLines", () => {
  it("hybrid milestone omits zero referral sats", () => {
    const lines = buildProofCardLines({
      scope: "hybrid",
      type: "milestone",
      data: baseData(),
    });
    expect(
      lines.support.some((s) => s.label.toLowerCase().includes("referral"))
    ).toBe(false);
  });

  it("hybrid milestone includes referral sats when non-zero", () => {
    const seed = baseData();
    const lines = buildProofCardLines({
      scope: "hybrid",
      type: "milestone",
      data: {
        ...seed,
        allTime: { ...seed.allTime, referralSatsPaid: 500 },
      },
    });
    expect(lines.support.some((s) => s.label.includes("Referral"))).toBe(true);
  });

  it("reliability uses last-30d publish fields", () => {
    const lines = buildProofCardLines({
      scope: "hybrid",
      type: "reliability",
      data: baseData(),
    });
    expect(lines.headline).toContain("97.5");
    expect(lines.support.some((s) => s.label.includes("Failed short"))).toBe(
      true
    );
    expect(lines.support.some((s) => s.label.includes("referral payout"))).toBe(
      true
    );
  });

  it("range_performance shows light activity when volume is low", () => {
    const lines = buildProofCardLines({
      scope: "selected-range",
      type: "range_performance",
      data: baseData({
        inRange: {
          postsPublished: 0,
          longFormPublished: 0,
          referredSignups: 0,
          postsWithMedia: 0,
          publishersInRange: 0,
          scheduledReposts: 0,
          giveawaysLockedOrPaid: 0,
        },
      }),
    });
    expect(lines.headline).toBe("Light activity");
  });

  it("proofCardSummaryText includes footer", () => {
    const lines = buildProofCardLines({
      scope: "hybrid",
      type: "milestone",
      data: baseData(),
    });
    const text = proofCardSummaryText(lines);
    expect(text).toContain("Snapshot");
    expect(text).toContain("Dashboard range");
  });
});
