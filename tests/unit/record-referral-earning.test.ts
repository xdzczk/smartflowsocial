/**
 * Unit tests for recording referral earnings on payment completion.
 * Tests app/features/referral/record-referral-earning.server.ts
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const mockFindUserNpubById = vi.fn();
const mockFindReferralByReferredNpubSelectReferrer = vi.fn();
const mockCreateReferralEarning = vi.fn();

vi.mock("~/features/referral/repositories/referral-data.server", () => ({
  findUserNpubById: (...args: unknown[]) => mockFindUserNpubById(...args),
  findReferralByReferredNpubSelectReferrer: (...args: unknown[]) =>
    mockFindReferralByReferredNpubSelectReferrer(...args),
  createReferralEarning: (...args: unknown[]) =>
    mockCreateReferralEarning(...args),
}));

import { recordReferralEarningIfAny } from "~/features/referral/record-referral-earning.server";

describe("record-referral-earning", () => {
  const payerUserId = "user-1";
  const paymentId = "pay-1";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("recordReferralEarningIfAny", () => {
    it("does not call DB when amountPaidSats <= 0", async () => {
      await recordReferralEarningIfAny(payerUserId, paymentId, 0);
      await recordReferralEarningIfAny(payerUserId, paymentId, -1);
      expect(mockFindUserNpubById).not.toHaveBeenCalled();
      expect(mockCreateReferralEarning).not.toHaveBeenCalled();
    });

    it("does not create earning when user not found", async () => {
      mockFindUserNpubById.mockResolvedValue(null);
      await recordReferralEarningIfAny(payerUserId, paymentId, 1000);
      expect(mockFindUserNpubById).toHaveBeenCalledWith(payerUserId);
      expect(mockCreateReferralEarning).not.toHaveBeenCalled();
    });

    it("does not create earning when referral not found for referred npub", async () => {
      mockFindUserNpubById.mockResolvedValue({ npub: "npub_payer" });
      mockFindReferralByReferredNpubSelectReferrer.mockResolvedValue(null);
      await recordReferralEarningIfAny(payerUserId, paymentId, 1000);
      expect(mockFindReferralByReferredNpubSelectReferrer).toHaveBeenCalledWith(
        "npub_payer"
      );
      expect(mockCreateReferralEarning).not.toHaveBeenCalled();
    });

    it("does not create earning when commission is 0 (amount too small)", async () => {
      mockFindUserNpubById.mockResolvedValue({ npub: "npub_payer" });
      mockFindReferralByReferredNpubSelectReferrer.mockResolvedValue({
        referrerNpub: "npub_referrer",
      });
      await recordReferralEarningIfAny(payerUserId, paymentId, 1);
      expect(mockCreateReferralEarning).not.toHaveBeenCalled();
    });

    it("calls createReferralEarning with PENDING status on happy path", async () => {
      mockFindUserNpubById.mockResolvedValue({ npub: "npub_payer" });
      mockFindReferralByReferredNpubSelectReferrer.mockResolvedValue({
        referrerNpub: "npub_referrer",
      });
      mockCreateReferralEarning.mockResolvedValue(undefined);
      await recordReferralEarningIfAny(payerUserId, paymentId, 1000);
      expect(mockCreateReferralEarning).toHaveBeenCalledTimes(1);
      expect(mockCreateReferralEarning).toHaveBeenCalledWith({
        referrerNpub: "npub_referrer",
        referredNpub: "npub_payer",
        paymentId,
        amountPaidSats: 1000,
        commissionSats: 200,
        status: "PENDING",
      });
    });

    it("treats P2002 unique violation as idempotent success (no rethrow)", async () => {
      mockFindUserNpubById.mockResolvedValue({ npub: "npub_payer" });
      mockFindReferralByReferredNpubSelectReferrer.mockResolvedValue({
        referrerNpub: "npub_referrer",
      });
      mockCreateReferralEarning.mockRejectedValue({ code: "P2002" });
      await expect(
        recordReferralEarningIfAny(payerUserId, paymentId, 1000)
      ).resolves.toBeUndefined();
    });

    it("rethrows non-P2002 errors", async () => {
      mockFindUserNpubById.mockResolvedValue({ npub: "npub_payer" });
      mockFindReferralByReferredNpubSelectReferrer.mockResolvedValue({
        referrerNpub: "npub_referrer",
      });
      const err = new Error("DB connection lost");
      mockCreateReferralEarning.mockRejectedValue(err);
      await expect(
        recordReferralEarningIfAny(payerUserId, paymentId, 1000)
      ).rejects.toThrow("DB connection lost");
    });
  });
});
