import { describe, expect, it } from "vitest";

import {
  computeCheckoutDueUsd,
  renewalSummaryLine,
  type PlanCheckoutPricing,
} from "~/features/payments/checkout/checkout-pricing";

const samplePricing: PlanCheckoutPricing = {
  nwcAutoRenewMonthlyUsd: 28,
  nwcAutoRenewYearlyUsd: 280,
  lightningOneTimeMonthlyUsd: { 1: 28, 3: 80, 6: 150 },
  lightningOneTimeYearlyUsd: 280,
  btcOnchainYearlyUsd: 280,
};

describe("computeCheckoutDueUsd", () => {
  it("returns monthly auto-renew", () => {
    expect(
      computeCheckoutDueUsd({
        method: "auto_renew",
        billingCadence: "monthly",
        accessDurationMonths: 1,
        pricing: samplePricing,
      })
    ).toBe(28);
  });

  it("returns one-time Lightning for 3 months", () => {
    expect(
      computeCheckoutDueUsd({
        method: "lightning_one_time",
        billingCadence: "monthly",
        accessDurationMonths: 3,
        pricing: samplePricing,
      })
    ).toBe(80);
  });

  it("returns btc on-chain yearly when set", () => {
    expect(
      computeCheckoutDueUsd({
        method: "btc_onchain",
        billingCadence: "yearly",
        accessDurationMonths: 12,
        pricing: samplePricing,
      })
    ).toBe(280);
  });
});

describe("renewalSummaryLine", () => {
  it("describes auto-renew monthly", () => {
    expect(
      renewalSummaryLine({
        method: "auto_renew",
        billingCadence: "monthly",
        accessDurationMonths: 1,
      })
    ).toContain("month");
  });

  it("describes one-time Lightning", () => {
    expect(
      renewalSummaryLine({
        method: "lightning_one_time",
        billingCadence: "monthly",
        accessDurationMonths: 3,
      })
    ).toContain("not renew");
  });
});
