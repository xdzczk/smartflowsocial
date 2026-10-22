import { describe, expect, it } from "vitest";

import {
  isAutoRenewChargeEligible,
  isFreePlanPrice,
} from "~/features/payments/services/subscription-auto-renew.server";

describe("auto-renew charge eligibility", () => {
  const connected = {
    nwcEnabled: true,
    encryptedNwc: "encrypted",
    paymentMethod: "nwc_auto_renew",
    renewalMode: "auto_renew",
  };

  it("charges only an auto-renew subscription with a connected wallet", () => {
    expect(isAutoRenewChargeEligible(connected)).toBe(true);
  });

  it("does not charge a one-time purchase that still has a wallet saved", () => {
    expect(
      isAutoRenewChargeEligible({
        ...connected,
        paymentMethod: "lightning_one_time",
        renewalMode: "manual",
      })
    ).toBe(false);
  });

  it("does not charge auto-renew after the wallet is disconnected", () => {
    expect(
      isAutoRenewChargeEligible({
        ...connected,
        nwcEnabled: false,
        encryptedNwc: null,
      })
    ).toBe(false);
  });

  it("treats a zero price as free and ignores empty prices", () => {
    expect(isFreePlanPrice(0)).toBe(true);
    expect(isFreePlanPrice("0")).toBe(true);
    expect(isFreePlanPrice(null)).toBe(false);
    expect(isFreePlanPrice(undefined)).toBe(false);
    expect(isFreePlanPrice(10)).toBe(false);
  });
});
