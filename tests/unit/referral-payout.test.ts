/**
 * Unit tests for referral payout (pending balance, pay with invoice, batch).
 * Tests app/features/referral/referral-payout.server.ts
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const mockAggregatePendingCommissionByReferrer = vi.fn();
const mockFindPendingEarningsForPayout = vi.fn();
const mockFindPendingEarningsWithAttemptCount = vi.fn();
const mockFindReferrerPayoutConfig = vi.fn();
const mockGroupByReferrerPendingSats = vi.fn();
const mockMarkEarningPaid = vi.fn();
const mockMarkEarningPayoutAttempt = vi.fn();

vi.mock("~/lib/env.server", () => ({
  get env() {
    return { OWNER_NWC: "nostr+walletconnect://test" };
  },
}));

vi.mock("~/lib/error-logger.server", () => ({
  logError: vi.fn(),
}));

vi.mock("~/features/payments/data", () => ({
  getOwnerNwcWithRelayOverrides: vi.fn(() => ({
    credentials: "nostr+walletconnect://test",
  })),
}));

vi.mock("@getalby/sdk", () => ({
  NWCClient: class {
    payInvoice = vi.fn().mockResolvedValue(undefined);
  },
}));

vi.mock("~/features/referral/lnurl-pay.server", () => ({
  fetchInvoiceFromLnurlPay: vi.fn().mockResolvedValue("lnbc123"),
}));

vi.mock("~/features/referral/repositories/referral-data.server", () => ({
  aggregatePendingCommissionByReferrer: (...args: unknown[]) =>
    mockAggregatePendingCommissionByReferrer(...args),
  findPendingEarningsForPayout: (...args: unknown[]) =>
    mockFindPendingEarningsForPayout(...args),
  findPendingEarningsWithAttemptCount: (...args: unknown[]) =>
    mockFindPendingEarningsWithAttemptCount(...args),
  findReferrerPayoutConfig: (...args: unknown[]) =>
    mockFindReferrerPayoutConfig(...args),
  groupByReferrerPendingSats: (...args: unknown[]) =>
    mockGroupByReferrerPendingSats(...args),
  markEarningPaid: (...args: unknown[]) => mockMarkEarningPaid(...args),
  markEarningPayoutAttempt: (...args: unknown[]) =>
    mockMarkEarningPayoutAttempt(...args),
}));

import {
  getPendingBalanceSats,
  payReferrerWithInvoice,
  getEarningsForPayout,
  getReferrersEligibleForPayout,
  runReferralPayoutBatch,
} from "~/features/referral/referral-payout.server";

describe("referral-payout", () => {
  const referrerNpub = "npub_referrer";

  beforeEach(() => {
    vi.clearAllMocks();
    mockAggregatePendingCommissionByReferrer.mockResolvedValue({
      _sum: { commissionSats: 5000 },
    });
    mockFindPendingEarningsForPayout.mockResolvedValue([
      { id: "e1", commissionSats: 3000 },
      { id: "e2", commissionSats: 2000 },
    ]);
    mockFindPendingEarningsWithAttemptCount.mockResolvedValue([
      { id: "e1", commissionSats: 3000, payoutAttemptCount: 0 },
      { id: "e2", commissionSats: 2000, payoutAttemptCount: 0 },
    ]);
  });

  describe("getPendingBalanceSats", () => {
    it("returns aggregated pending commission", async () => {
      mockAggregatePendingCommissionByReferrer.mockResolvedValue({
        _sum: { commissionSats: 1000 },
      });
      const sats = await getPendingBalanceSats(referrerNpub);
      expect(sats).toBe(1000);
    });

    it("returns 0 when _sum.commissionSats is null", async () => {
      mockAggregatePendingCommissionByReferrer.mockResolvedValue({
        _sum: { commissionSats: null },
      });
      const sats = await getPendingBalanceSats(referrerNpub);
      expect(sats).toBe(0);
    });
  });

  describe("payReferrerWithInvoice", () => {
    it("returns error when amount <= 0 or exceeds pending", async () => {
      const r1 = await payReferrerWithInvoice(referrerNpub, "lnbc1", 0);
      expect(r1.success).toBe(false);
      expect(r1.error).toContain("Amount must be positive");

      mockAggregatePendingCommissionByReferrer.mockResolvedValue({
        _sum: { commissionSats: 100 },
      });
      const r2 = await payReferrerWithInvoice(referrerNpub, "lnbc1", 500);
      expect(r2.success).toBe(false);
      expect(r2.error).toContain("not exceed pending");
    });

    it("marks earnings as paid on successful payInvoice", async () => {
      const result = await payReferrerWithInvoice(
        referrerNpub,
        "lnbc123",
        5000
      );
      expect(result.success).toBe(true);
      expect(mockMarkEarningPaid).toHaveBeenCalledTimes(2);
      expect(mockMarkEarningPaid).toHaveBeenCalledWith("e1", expect.any(Date));
      expect(mockMarkEarningPaid).toHaveBeenCalledWith("e2", expect.any(Date));
    });
  });

  describe("getEarningsForPayout", () => {
    it("returns findPendingEarningsWithAttemptCount result", async () => {
      const rows = [{ id: "e1", commissionSats: 1000, payoutAttemptCount: 0 }];
      mockFindPendingEarningsWithAttemptCount.mockResolvedValue(rows);
      const result = await getEarningsForPayout(referrerNpub);
      expect(result).toEqual(rows);
    });
  });

  describe("getReferrersEligibleForPayout", () => {
    it("filters referrers with pending >= 1000 sats", async () => {
      mockGroupByReferrerPendingSats.mockResolvedValue([
        { referrerNpub: "npub_a", _sum: { commissionSats: 500 } },
        { referrerNpub: "npub_b", _sum: { commissionSats: 2000 } },
      ]);
      const result = await getReferrersEligibleForPayout();
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({ referrerNpub: "npub_b", pendingSats: 2000 });
    });
  });

  describe("runReferralPayoutBatch", () => {
    it("skips referrer when payout config has no destination", async () => {
      mockGroupByReferrerPendingSats.mockResolvedValue([
        { referrerNpub: "npub_x", _sum: { commissionSats: 5000 } },
      ]);
      mockFindReferrerPayoutConfig.mockResolvedValue({
        payoutDestination: "",
        payoutDestinationType: null,
      });
      const result = await runReferralPayoutBatch();
      expect(result.processed).toBe(1);
      expect(result.skipped).toBe(1);
      expect(result.paid).toBe(0);
    });

    it("skips referrer when payout destination is not URL", async () => {
      mockGroupByReferrerPendingSats.mockResolvedValue([
        { referrerNpub: "npub_x", _sum: { commissionSats: 5000 } },
      ]);
      mockFindReferrerPayoutConfig.mockResolvedValue({
        payoutDestination: "lnurl123",
        payoutDestinationType: "lnurl",
      });
      const result = await runReferralPayoutBatch();
      expect(result.skipped).toBe(1);
    });
  });
});
