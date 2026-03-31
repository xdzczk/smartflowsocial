import { describe, expect, it } from "vitest";

import {
  deriveBillingCommMode,
  deriveBillingContext,
} from "~/features/payments/services/subscription-status.server";

describe("deriveBillingCommMode", () => {
  it("returns AUTO_RENEW_NWC for NWC SKU + wallet", () => {
    expect(
      deriveBillingCommMode(
        { nwcEnabled: true, encryptedNwc: "enc" },
        {
          planId: "p",
          paymentMethod: "nwc_auto_renew",
          renewalMode: "auto_renew",
          cancelAtPeriodEnd: false,
          Plan: { enableLifetimeAccess: false },
        }
      )
    ).toBe("AUTO_RENEW_NWC");
  });

  it("returns MANUAL_TOP_UP for Lightning one-time", () => {
    expect(
      deriveBillingCommMode(
        { nwcEnabled: true, encryptedNwc: "enc" },
        {
          planId: "p",
          paymentMethod: "lightning_one_time",
          renewalMode: "manual",
          cancelAtPeriodEnd: false,
          Plan: { enableLifetimeAccess: false },
        }
      )
    ).toBe("MANUAL_TOP_UP");
  });
});

describe("deriveBillingContext", () => {
  it("uses manual copy path when not NWC auto", () => {
    const now = new Date("2030-06-13T14:00:00.000Z");
    const periodEnd = new Date("2030-06-14T12:00:00.000Z");
    const ctx = deriveBillingContext({
      now,
      user: {
        id: "u1",
        isEnabled: true,
        npub: "npub1",
        nwcEnabled: false,
        encryptedNwc: null,
      },
      subscription: {
        planId: "premium",
        status: "ACTIVE",
        paymentMethod: "lightning_one_time",
        renewalMode: "manual",
        cancelAtPeriodEnd: false,
        currentPeriodEnd: periodEnd,
        gracePeriodEndsAt: null,
        Plan: { name: "Premium", id: "premium", enableLifetimeAccess: false },
      },
    });
    expect(ctx.commMode).toBe("MANUAL_TOP_UP");
    expect(ctx.bannerVariant).not.toBe("none");
  });
});
