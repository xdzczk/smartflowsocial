/**
 * Unit tests for referral commission config.
 * Tests app/features/referral/referral-config.server.ts
 */

import { describe, it, expect } from "vitest";

import {
  REFERRAL_COMMISSION_RATE_PERCENT,
  computeReferralCommissionSats,
} from "~/features/referral/referral-config.server";

describe("referral-config", () => {
  describe("REFERRAL_COMMISSION_RATE_PERCENT", () => {
    it("is 20", () => {
      expect(REFERRAL_COMMISSION_RATE_PERCENT).toBe(20);
    });
  });

  describe("computeReferralCommissionSats", () => {
    it("returns 0 for 0 amount", () => {
      expect(computeReferralCommissionSats(0)).toBe(0);
    });

    it("returns floor(amount * 20 / 100) for 100 sats", () => {
      expect(computeReferralCommissionSats(100)).toBe(20);
    });

    it("returns floor for 999 sats", () => {
      expect(computeReferralCommissionSats(999)).toBe(199);
    });

    it("returns 200 for 1000 sats", () => {
      expect(computeReferralCommissionSats(1000)).toBe(200);
    });

    it("rounds down for non-integer result", () => {
      expect(computeReferralCommissionSats(49)).toBe(9);
    });
  });
});
