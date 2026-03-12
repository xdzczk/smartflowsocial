/**
 * Unit tests for getting referrer info for a referred user.
 * Tests app/features/referral/get-referred-by.server.ts
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const mockFindReferralByReferredNpub = vi.fn();
const mockFindUserNostrProfileByNpub = vi.fn();

vi.mock("~/features/referral/repositories/referral-data.server", () => ({
  findReferralByReferredNpub: (...args: unknown[]) =>
    mockFindReferralByReferredNpub(...args),
  findUserNostrProfileByNpub: (...args: unknown[]) =>
    mockFindUserNostrProfileByNpub(...args),
}));

import { getReferredByForNpub } from "~/features/referral/get-referred-by.server";

describe("get-referred-by", () => {
  const referredNpub = "npub_referred";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getReferredByForNpub", () => {
    it("returns null when no referral exists for npub", async () => {
      mockFindReferralByReferredNpub.mockResolvedValue(null);
      const result = await getReferredByForNpub(referredNpub);
      expect(result).toBeNull();
      expect(mockFindUserNostrProfileByNpub).not.toHaveBeenCalled();
    });

    it("returns referrerNpub and null displayName when referrer has no profile", async () => {
      mockFindReferralByReferredNpub.mockResolvedValue({
        referrerNpub: "npub_referrer",
      });
      mockFindUserNostrProfileByNpub.mockResolvedValue(null);
      const result = await getReferredByForNpub(referredNpub);
      expect(result).toEqual({
        referrerNpub: "npub_referrer",
        referrerDisplayName: null,
      });
      expect(mockFindUserNostrProfileByNpub).toHaveBeenCalledWith(
        "npub_referrer"
      );
    });

    it("returns referrerDisplayName from nostrProfile name when present", async () => {
      mockFindReferralByReferredNpub.mockResolvedValue({
        referrerNpub: "npub_referrer",
      });
      mockFindUserNostrProfileByNpub.mockResolvedValue({
        nostrProfile: { name: "Alice" },
      });
      const result = await getReferredByForNpub(referredNpub);
      expect(result?.referrerNpub).toBe("npub_referrer");
      expect(result?.referrerDisplayName).toBe("Alice");
    });

    it("uses display_name or displayName when name missing", async () => {
      mockFindReferralByReferredNpub.mockResolvedValue({
        referrerNpub: "npub_referrer",
      });
      mockFindUserNostrProfileByNpub.mockResolvedValue({
        nostrProfile: { display_name: "Bob" },
      });
      const result = await getReferredByForNpub(referredNpub);
      expect(result?.referrerDisplayName).toBe("Bob");
    });
  });
});
