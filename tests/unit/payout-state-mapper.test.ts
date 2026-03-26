import { describe, expect, it } from "vitest";

import {
  isPayoutItemSettled,
  mapContestCampaignPhase,
  mapGiveawayCampaignPhase,
  mapPayoutItemPhase,
} from "~/features/campaign-ui/payout-state-mapper";

describe("payout-state-mapper", () => {
  it("maps giveaway pre-lock and post-lock phases without changing domain enums", () => {
    expect(mapGiveawayCampaignPhase("DRAFT")).toBe("Draft");
    expect(mapGiveawayCampaignPhase("PREVIEWED")).toBe("Reviewing");
    expect(mapGiveawayCampaignPhase("LOCKED")).toBe("Locked");
    expect(mapGiveawayCampaignPhase("PAID_OUT")).toBe("Completed");
    expect(mapGiveawayCampaignPhase("PAID_OUT", true)).toBe(
      "Completed with issues"
    );
  });

  it("maps contest states and keeps live/review states differentiated upstream", () => {
    expect(mapContestCampaignPhase("LIVE")).toBe("Draft");
    expect(mapContestCampaignPhase("ENDED_REVIEW")).toBe("Reviewing");
    expect(mapContestCampaignPhase("PAYOUT_IN_PROGRESS")).toBe("Paying");
    expect(mapContestCampaignPhase("COMPLETED", true)).toBe(
      "Completed with issues"
    );
  });

  it("maps payout item states for wallet/manual/review outcomes", () => {
    expect(mapPayoutItemPhase("pending")).toBe("Pending");
    expect(mapPayoutItemPhase("sent")).toBe("Paid via wallet");
    expect(mapPayoutItemPhase("paid")).toBe("Paid via wallet");
    expect(mapPayoutItemPhase("marked_paid")).toBe("Paid manually");
    expect(mapPayoutItemPhase("claim_needed")).toBe("Needs review");
    expect(mapPayoutItemPhase("failed")).toBe("Failed");
  });

  it("marks only paid states as settled", () => {
    expect(isPayoutItemSettled("sent")).toBe(true);
    expect(isPayoutItemSettled("marked_paid")).toBe(true);
    expect(isPayoutItemSettled("failed")).toBe(false);
    expect(isPayoutItemSettled("claim_needed")).toBe(false);
  });
});
