/**
 * Unit tests for referral payout (pending balance, pay with invoice, batch).
 * Tests app/features/referral/referral-payout.server.ts
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const mockAggregatePendingCommissionByReferrer = vi.fn();
const mockFindPendingEarningsWithAttemptCount = vi.fn();
const mockFindReferrerPayoutConfig = vi.fn();
const mockGroupByReferrerPendingSats = vi.fn();
const mockBeginReferralPayout = vi.fn();
const mockCompleteReferralPayout = vi.fn();
const mockFailReferralPayout = vi.fn();
const { payInvoice } = vi.hoisted(() => ({
  payInvoice: vi.fn(),
}));

const envState = vi.hoisted(() => ({
  OWNER_NWC: "nostr+walletconnect://test",
  REFERRAL_PAYOUT_MAX_SATS: "1000000",
  REFERRAL_PAYOUT_DAILY_CAP_SATS: "5000000",
  REFERRAL_PAYOUTS_ENABLED: undefined as string | undefined,
}));

vi.mock("~/lib/env.server", () => ({
  get env() {
    return envState;
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
    payInvoice = payInvoice;
  },
}));

vi.mock("~/features/referral/bolt11-invoice.server", () => ({
  readBolt11ForPayout: (invoice: string) => {
    if (invoice === "lnbc-malformed") {
      return { ok: false, error: "Malformed BOLT11 invoice" };
    }
    if (invoice === "lnbc-amountless") {
      return { ok: false, error: "Amountless BOLT11 invoices cannot be paid" };
    }
    if (invoice === "lnbc-one") {
      return { ok: true, amountSats: 1, paymentHash: "11".repeat(32) };
    }
    if (invoice === "lnbc-huge") {
      return {
        ok: true,
        amountSats: 50_000_000,
        paymentHash: "bb".repeat(32),
      };
    }
    return { ok: true, amountSats: 5000, paymentHash: "aa".repeat(32) };
  },
}));

vi.mock("~/features/referral/lnurl-pay.server", () => ({
  fetchInvoiceFromLnurlPay: vi.fn().mockResolvedValue("lnbc123"),
}));

vi.mock("~/features/referral/referral-payout-audit.server", () => ({
  createReferralPayoutAuditLog: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("~/features/referral/repositories/referral-data.server", () => ({
  aggregatePendingCommissionByReferrer: (...args: unknown[]) =>
    mockAggregatePendingCommissionByReferrer(...args),
  findPendingEarningsWithAttemptCount: (...args: unknown[]) =>
    mockFindPendingEarningsWithAttemptCount(...args),
  findReferrerPayoutConfig: (...args: unknown[]) =>
    mockFindReferrerPayoutConfig(...args),
  groupByReferrerPendingSats: (...args: unknown[]) =>
    mockGroupByReferrerPendingSats(...args),
  beginReferralPayout: (...args: unknown[]) => mockBeginReferralPayout(...args),
  completeReferralPayoutAttempt: (...args: unknown[]) =>
    mockCompleteReferralPayout(...args),
  failReferralPayoutAttempt: (...args: unknown[]) =>
    mockFailReferralPayout(...args),
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
    envState.REFERRAL_PAYOUTS_ENABLED = undefined;
    payInvoice.mockResolvedValue(undefined);
    mockAggregatePendingCommissionByReferrer.mockResolvedValue({
      _sum: { commissionSats: 5000 },
    });
    mockFindPendingEarningsWithAttemptCount.mockResolvedValue([
      { id: "e1", commissionSats: 3000, payoutAttemptCount: 0 },
      { id: "e2", commissionSats: 2000, payoutAttemptCount: 0 },
    ]);
    mockBeginReferralPayout.mockResolvedValue({
      ok: true,
      auditId: "audit-1",
      earningIds: ["e1", "e2"],
    });
    mockCompleteReferralPayout.mockResolvedValue(undefined);
    mockFailReferralPayout.mockResolvedValue(undefined);
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
    it("does not call the wallet when payouts are disabled", async () => {
      envState.REFERRAL_PAYOUTS_ENABLED = "false";
      const result = await payReferrerWithInvoice(referrerNpub, "lnbc-one", 1);
      expect(result.success).toBe(false);
      expect(result.error).toContain("disabled");
      expect(payInvoice).not.toHaveBeenCalled();
      expect(mockBeginReferralPayout).not.toHaveBeenCalled();
    });

    it("rejects a declared amount that does not match the invoice", async () => {
      const result = await payReferrerWithInvoice(
        referrerNpub,
        "lnbc-one",
        5000
      );
      expect(result.success).toBe(false);
      expect(result.error).toContain("does not match");
      expect(payInvoice).not.toHaveBeenCalled();
      expect(mockBeginReferralPayout).not.toHaveBeenCalled();
    });

    it("rejects a 1 sat declaration when the invoice is larger", async () => {
      mockAggregatePendingCommissionByReferrer.mockResolvedValue({
        _sum: { commissionSats: 50_000_000 },
      });
      const result = await payReferrerWithInvoice(referrerNpub, "lnbc-huge", 1);
      expect(result.success).toBe(false);
      expect(result.error).toContain("does not match");
      expect(payInvoice).not.toHaveBeenCalled();
    });

    it("rejects amountless and malformed invoices before NWC", async () => {
      const amountless = await payReferrerWithInvoice(
        referrerNpub,
        "lnbc-amountless",
        5000
      );
      expect(amountless.success).toBe(false);
      expect(amountless.error).toContain("Amountless");

      const malformed = await payReferrerWithInvoice(
        referrerNpub,
        "lnbc-malformed",
        5000
      );
      expect(malformed.success).toBe(false);
      expect(malformed.error).toContain("Malformed");
      expect(payInvoice).not.toHaveBeenCalled();
    });

    it("returns error when amount exceeds pending balance", async () => {
      mockAggregatePendingCommissionByReferrer.mockResolvedValue({
        _sum: { commissionSats: 100 },
      });
      const result = await payReferrerWithInvoice(
        referrerNpub,
        "lnbc123",
        5000
      );
      expect(result.success).toBe(false);
      expect(result.error).toContain("not exceed pending");
      expect(payInvoice).not.toHaveBeenCalled();
    });

    it("does not pay when a payout is already in progress", async () => {
      mockBeginReferralPayout.mockResolvedValue({
        ok: false,
        error: "PAYOUT_IN_PROGRESS",
      });
      const result = await payReferrerWithInvoice(
        referrerNpub,
        "lnbc123",
        5000
      );
      expect(result.success).toBe(false);
      expect(result.error).toContain("already in progress");
      expect(payInvoice).not.toHaveBeenCalled();
    });

    it("treats an already paid invoice as success without paying again", async () => {
      mockBeginReferralPayout.mockResolvedValue({
        ok: false,
        error: "ALREADY_PAID",
      });
      const result = await payReferrerWithInvoice(
        referrerNpub,
        "lnbc123",
        5000
      );
      expect(result.success).toBe(true);
      expect(payInvoice).not.toHaveBeenCalled();
    });

    it("rejects a resubmitted invoice that already failed or started", async () => {
      mockBeginReferralPayout.mockResolvedValue({
        ok: false,
        error: "INVOICE_ALREADY_SUBMITTED",
      });
      const result = await payReferrerWithInvoice(
        referrerNpub,
        "lnbc123",
        5000
      );
      expect(result.success).toBe(false);
      expect(result.error).toContain("already submitted");
      expect(payInvoice).not.toHaveBeenCalled();
    });

    it("rejects invoices above the per-payment cap", async () => {
      const result = await payReferrerWithInvoice(
        referrerNpub,
        "lnbc-huge",
        50_000_000
      );
      expect(result.success).toBe(false);
      expect(result.error).toContain("per-payment cap");
      expect(payInvoice).not.toHaveBeenCalled();
    });

    it("pays the invoice and completes the ledger on success", async () => {
      const result = await payReferrerWithInvoice(
        referrerNpub,
        "lnbc123",
        5000
      );
      expect(result.success).toBe(true);
      expect(payInvoice).toHaveBeenCalledWith({ invoice: "lnbc123" });
      expect(mockCompleteReferralPayout).toHaveBeenCalledWith(
        expect.objectContaining({
          auditId: "audit-1",
          earningIds: ["e1", "e2"],
          paymentHash: "aa".repeat(32),
        })
      );
    });

    it("records the wallet failure and does not complete the ledger", async () => {
      payInvoice.mockRejectedValue(new Error("nwc rejected"));
      const result = await payReferrerWithInvoice(
        referrerNpub,
        "lnbc123",
        5000
      );
      expect(result.success).toBe(false);
      expect(result.error).toContain("nwc rejected");
      expect(mockFailReferralPayout).toHaveBeenCalled();
      expect(mockCompleteReferralPayout).not.toHaveBeenCalled();
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
