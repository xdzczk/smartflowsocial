/**
 * Unit tests for referral settings (referrer dashboard data).
 * Tests app/features/referral/referral-settings.server.ts
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const mockAggregateEarningsByStatus = vi.fn();
const mockFindReferrerPayoutConfigForSettings = vi.fn();

const mockEnv: { REFERRAL_LANDING_URL?: string } = {};
vi.mock("~/lib/env.server", () => ({
  get env() {
    return mockEnv;
  },
}));

vi.mock("~/features/referral/repositories/referral-data.server", () => ({
  aggregateEarningsByStatus: (...args: unknown[]) =>
    mockAggregateEarningsByStatus(...args),
  findReferrerPayoutConfigForSettings: (...args: unknown[]) =>
    mockFindReferrerPayoutConfigForSettings(...args),
}));

import { ReferralEarningStatus } from "~/features/referral/data/referral-prisma-types.server";
import { getReferralSettingsData } from "~/features/referral/referral-settings.server";

describe("referral-settings", () => {
  const referrerNpub = "npub_referrer123";

  beforeEach(() => {
    vi.clearAllMocks();
    mockEnv.REFERRAL_LANDING_URL = undefined;
    mockAggregateEarningsByStatus.mockResolvedValue([]);
    mockFindReferrerPayoutConfigForSettings.mockResolvedValue(null);
  });

  describe("getReferralSettingsData", () => {
    it("returns referralLink with ref= when env REFERRAL_LANDING_URL is not set (default)", async () => {
      const data = await getReferralSettingsData(referrerNpub);
      expect(data.referralLink).toContain("ref=");
      expect(data.referralLink).toContain(encodeURIComponent(referrerNpub));
      expect(data.referralLink).toMatch(/^https:\/\/smartflow\.social\/\?ref=/);
    });

    it("returns commissionRatePercent 20", async () => {
      const data = await getReferralSettingsData(referrerNpub);
      expect(data.commissionRatePercent).toBe(20);
    });

    it("returns paidSats, pendingSats, failedSats and totalEarnedSats from aggregates", async () => {
      mockAggregateEarningsByStatus.mockResolvedValue([
        { status: ReferralEarningStatus.PAID, _sum: { commissionSats: 500 } },
        {
          status: ReferralEarningStatus.PENDING,
          _sum: { commissionSats: 300 },
        },
        { status: ReferralEarningStatus.FAILED, _sum: { commissionSats: 100 } },
      ]);
      const data = await getReferralSettingsData(referrerNpub);
      expect(data.paidSats).toBe(500);
      expect(data.pendingSats).toBe(300);
      expect(data.failedSats).toBe(100);
      expect(data.totalEarnedSats).toBe(900);
    });

    it("returns payoutDestination and payoutDestinationType from config", async () => {
      mockFindReferrerPayoutConfigForSettings.mockResolvedValue({
        payoutDestination: "https://lnurl.example/pay",
        payoutDestinationType: "lnurl",
      });
      const data = await getReferralSettingsData(referrerNpub);
      expect(data.payoutDestination).toBe("https://lnurl.example/pay");
      expect(data.payoutDestinationType).toBe("lnurl");
    });

    it("returns null payout when config is null", async () => {
      const data = await getReferralSettingsData(referrerNpub);
      expect(data.payoutDestination).toBeNull();
      expect(data.payoutDestinationType).toBeNull();
    });

    it("uses custom landing URL and strips trailing slash when REFERRAL_LANDING_URL set", async () => {
      mockEnv.REFERRAL_LANDING_URL = "https://custom.landing.com/";
      const data = await getReferralSettingsData(referrerNpub);
      expect(data.referralLink).toMatch(
        /^https:\/\/custom\.landing\.com\/?\?ref=/
      );
    });
  });
});
