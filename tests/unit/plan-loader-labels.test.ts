import { describe, expect, it } from "vitest";

import { getAvailableCheckoutMethods } from "~/features/payments/checkout/checkout-method-config";
import { yearlySavingsLabel } from "~/features/payments/types/plan-loader.types";

describe("yearlySavingsLabel", () => {
  it("returns null when yearly is not cheaper than 12× monthly", () => {
    expect(yearlySavingsLabel(28, 28 * 12)).toBeNull();
  });

  it("returns months-free style when roughly two months off", () => {
    const label = yearlySavingsLabel(28, 28 * 10);
    expect(label).toMatch(/2 months free/i);
  });

  it("returns percent when discount is under two months equivalent", () => {
    const label = yearlySavingsLabel(100, 1100);
    expect(label).toMatch(/Save 8%/);
  });
});

describe("getAvailableCheckoutMethods founder", () => {
  it("excludes auto_renew for founder lifetime", () => {
    const m = getAvailableCheckoutMethods({
      planId: "founder",
      billingCadence: "yearly",
      btcpayYearlyOnChainEnabled: true,
      isLifetimePlan: true,
    });
    expect(m).not.toContain("auto_renew");
    expect(m).toContain("lightning_one_time");
    expect(m).toContain("btc_onchain");
  });
});
