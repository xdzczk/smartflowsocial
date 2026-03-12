/**
 * Unit tests for referral binding at first auth.
 * Tests app/features/referral/referral-binding.server.ts
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const mockBindReferralInTransaction = vi.fn();

vi.mock("~/features/referral/repositories/referral-data.server", () => ({
  bindReferralInTransaction: (...args: unknown[]) =>
    mockBindReferralInTransaction(...args),
}));

import {
  bindReferralIfEligible,
  type Tx,
} from "~/features/referral/referral-binding.server";

describe("referral-binding", () => {
  // Empty object used as mock transaction; Tx from Prisma has many optional call sites
  const tx = {} as unknown as Tx;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("bindReferralIfEligible", () => {
    it("does not call bind when referralContext is null", async () => {
      await bindReferralIfEligible(tx, "npub_referred", null);
      expect(mockBindReferralInTransaction).not.toHaveBeenCalled();
    });

    it("does not call bind when referrer equals referred (self-referral)", async () => {
      await bindReferralIfEligible(tx, "npub_same", {
        referrer_npub: "npub_same",
        created_at: new Date().toISOString(),
      });
      expect(mockBindReferralInTransaction).not.toHaveBeenCalled();
    });

    it("calls bindReferralInTransaction with (tx, referredNpub, referrerNpub) when eligible", async () => {
      await bindReferralIfEligible(tx, "npub_referred", {
        referrer_npub: "npub_referrer",
        created_at: new Date().toISOString(),
      });
      expect(mockBindReferralInTransaction).toHaveBeenCalledTimes(1);
      expect(mockBindReferralInTransaction).toHaveBeenCalledWith(
        tx,
        "npub_referred",
        "npub_referrer"
      );
    });

    it("trims referrer_npub before comparison and call", async () => {
      await bindReferralIfEligible(tx, "npub_referred", {
        referrer_npub: "  npub_referrer  ",
        created_at: new Date().toISOString(),
      });
      expect(mockBindReferralInTransaction).toHaveBeenCalledWith(
        tx,
        "npub_referred",
        "npub_referrer"
      );
    });
  });
});
