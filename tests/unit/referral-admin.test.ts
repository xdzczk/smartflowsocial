/**
 * Unit tests for referral admin (list referrals/earnings, CSV, retry).
 * Tests app/features/referral/referral-admin.server.ts
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

let mockAdminNpubs = "";
const mockFindReferralsAdmin = vi.fn();
const mockCountReferralsAdmin = vi.fn();
const mockFindEarningsAdmin = vi.fn();
const mockCountEarningsAdmin = vi.fn();
const mockFindEarningByIdForRetry = vi.fn();
const mockUpdateEarningToPendingRetry = vi.fn();

vi.mock("~/lib/env.server", () => ({
  get env() {
    return { ADMIN_NPUBS: mockAdminNpubs };
  },
}));

vi.mock("~/features/referral/repositories/referral-data.server", () => ({
  findReferralsAdmin: (...args: unknown[]) => mockFindReferralsAdmin(...args),
  countReferralsAdmin: (...args: unknown[]) => mockCountReferralsAdmin(...args),
  findEarningsAdmin: (...args: unknown[]) => mockFindEarningsAdmin(...args),
  countEarningsAdmin: (...args: unknown[]) => mockCountEarningsAdmin(...args),
  findEarningByIdForRetry: (...args: unknown[]) =>
    mockFindEarningByIdForRetry(...args),
  updateEarningToPendingRetry: (...args: unknown[]) =>
    mockUpdateEarningToPendingRetry(...args),
}));

import { ReferralEarningStatus } from "~/features/referral/data/referral-prisma-types.server";
import {
  isReferralAdmin,
  getReferralsAdmin,
  getEarningsAdmin,
  referralsToCsv,
  earningsToCsv,
  retryFailedPayout,
} from "~/features/referral/referral-admin.server";

describe("referral-admin", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAdminNpubs = "";
  });

  describe("isReferralAdmin", () => {
    it("returns false when ADMIN_NPUBS is empty", () => {
      mockAdminNpubs = "";
      expect(isReferralAdmin("npub_any")).toBe(false);
    });

    it("returns true when npub is in comma-separated list", () => {
      mockAdminNpubs = "npub_a,npub_b, npub_c ";
      expect(isReferralAdmin("npub_b")).toBe(true);
    });

    it("returns false when npub is not in list", () => {
      mockAdminNpubs = "npub_a,npub_b";
      expect(isReferralAdmin("npub_other")).toBe(false);
    });
  });

  describe("getReferralsAdmin", () => {
    it("returns referrals and total with pagination", async () => {
      mockFindReferralsAdmin.mockResolvedValue([
        {
          referrerNpub: "npub_r",
          referredNpub: "npub_d",
          createdAt: new Date("2025-01-01"),
        },
      ]);
      mockCountReferralsAdmin.mockResolvedValue(1);
      const result = await getReferralsAdmin({ page: 1 });
      expect(result.referrals).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(50);
    });
  });

  describe("getEarningsAdmin", () => {
    it("filters by status when option is pending/paid/failed", async () => {
      mockFindEarningsAdmin.mockResolvedValue([]);
      mockCountEarningsAdmin.mockResolvedValue(0);
      await getEarningsAdmin({ status: "pending" });
      expect(mockFindEarningsAdmin).toHaveBeenCalledWith(
        expect.objectContaining({ status: "pending" }),
        0,
        50
      );
    });
  });

  describe("referralsToCsv", () => {
    it("returns header and escaped rows", () => {
      const csv = referralsToCsv([
        {
          referrerNpub: "npub_r",
          referredNpub: "npub_d",
          createdAt: new Date("2025-01-01T00:00:00.000Z"),
        },
      ]);
      expect(csv).toContain("referrer_npub,referred_npub,created_at");
      expect(csv).toContain("npub_r");
      expect(csv).toContain("npub_d");
    });
  });

  describe("earningsToCsv", () => {
    it("returns header and earnings rows", () => {
      const csv = earningsToCsv([
        {
          referrerNpub: "npub_r",
          referredNpub: "npub_d",
          paymentId: "pay1",
          amountPaidSats: 1000,
          commissionSats: 200,
          status: "PAID",
          createdAt: new Date("2025-01-01T00:00:00.000Z"),
          paidAt: new Date("2025-01-02T00:00:00.000Z"),
        },
      ]);
      expect(csv).toContain("referrer_npub,referred_npub,payment_id");
      expect(csv).toContain("pay1");
    });
  });

  describe("retryFailedPayout", () => {
    it("returns error when earning not found", async () => {
      mockFindEarningByIdForRetry.mockResolvedValue(null);
      const result = await retryFailedPayout("earn-1");
      expect(result).toEqual({ success: false, error: "Earning not found" });
      expect(mockUpdateEarningToPendingRetry).not.toHaveBeenCalled();
    });

    it("returns error when earning is not FAILED", async () => {
      mockFindEarningByIdForRetry.mockResolvedValue({
        id: "earn-1",
        status: ReferralEarningStatus.PENDING,
      });
      const result = await retryFailedPayout("earn-1");
      expect(result).toEqual({
        success: false,
        error: "Only failed earnings can be retried",
      });
      expect(mockUpdateEarningToPendingRetry).not.toHaveBeenCalled();
    });

    it("calls updateEarningToPendingRetry and returns success when earning is FAILED", async () => {
      mockFindEarningByIdForRetry.mockResolvedValue({
        id: "earn-1",
        status: ReferralEarningStatus.FAILED,
      });
      mockUpdateEarningToPendingRetry.mockResolvedValue(undefined);
      const result = await retryFailedPayout("earn-1");
      expect(result).toEqual({ success: true });
      expect(mockUpdateEarningToPendingRetry).toHaveBeenCalledWith("earn-1");
    });
  });
});
