/**
 * Unit tests for referral ref param validation.
 * Tests app/features/referral/referral-validation.server.ts
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("~/lib/nostr-adapter.server", () => ({
  nostrAdapter: {
    decodeNpub: vi.fn(),
    encodeNpub: vi.fn(),
  },
}));

import { validateAndNormalizeRefNpub } from "~/features/referral/referral-validation.server";
import { nostrAdapter } from "~/lib/nostr-adapter.server";

describe("referral-validation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("validateAndNormalizeRefNpub", () => {
    it("returns null for null", () => {
      expect(validateAndNormalizeRefNpub(null)).toBeNull();
    });

    it("returns null for empty string", () => {
      expect(validateAndNormalizeRefNpub("")).toBeNull();
    });

    it("returns null for whitespace-only string", () => {
      expect(validateAndNormalizeRefNpub("   ")).toBeNull();
    });

    it("returns null when decodeNpub returns hex with length !== 64", () => {
      vi.mocked(nostrAdapter.decodeNpub).mockReturnValue("short");
      expect(validateAndNormalizeRefNpub("npub1abc")).toBeNull();
    });

    it("returns null when decodeNpub returns null", () => {
      vi.mocked(nostrAdapter.decodeNpub).mockReturnValue(null);
      expect(validateAndNormalizeRefNpub("npub1invalid")).toBeNull();
    });

    it("returns canonical npub when valid 64-char hex", () => {
      const hex64 = "a".repeat(64);
      const canonicalNpub = "npub1valid";
      vi.mocked(nostrAdapter.decodeNpub).mockReturnValue(hex64);
      vi.mocked(nostrAdapter.encodeNpub).mockReturnValue(canonicalNpub);
      expect(validateAndNormalizeRefNpub("  npub1abc  ")).toBe(canonicalNpub);
    });

    it("returns null when encodeNpub returns null", () => {
      vi.mocked(nostrAdapter.decodeNpub).mockReturnValue("a".repeat(64));
      vi.mocked(nostrAdapter.encodeNpub).mockReturnValue(null);
      expect(validateAndNormalizeRefNpub("npub1x")).toBeNull();
    });
  });
});
