/**
 * Unit tests for referral context (cookie, parse, serialize).
 * Tests app/features/referral/referral-context.server.ts
 */

import { describe, it, expect, vi } from "vitest";

vi.mock("@remix-run/node", () => ({
  createCookie: vi.fn(() => ({
    parse: vi.fn(),
    serialize: vi.fn(),
  })),
}));

vi.mock("~/lib/env.server", () => ({
  env: { SESSION_SECRET: "test-secret", NODE_ENV: "test" },
}));

import {
  isReferralContextExpired,
  parseReferralContext,
  serializeReferralContext,
  getReferralContextFromCookie,
  referralContextCookie,
} from "~/features/referral/referral-context.server";

describe("referral-context", () => {
  describe("parseReferralContext", () => {
    it("returns null for null", () => {
      expect(parseReferralContext(null)).toBeNull();
    });

    it("returns null for empty string", () => {
      expect(parseReferralContext("")).toBeNull();
    });

    it("returns null for invalid JSON", () => {
      expect(parseReferralContext("not json")).toBeNull();
    });

    it("returns null when referrer_npub or created_at missing", () => {
      expect(
        parseReferralContext(JSON.stringify({ referrer_npub: "x" }))
      ).toBeNull();
      expect(
        parseReferralContext(
          JSON.stringify({ created_at: "2020-01-01T00:00:00Z" })
        )
      ).toBeNull();
    });

    it("returns null when context is expired", () => {
      const old = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString();
      expect(
        parseReferralContext(
          JSON.stringify({ referrer_npub: "npub_x", created_at: old })
        )
      ).toBeNull();
    });

    it("returns context when valid and not expired", () => {
      const created_at = new Date().toISOString();
      const value = JSON.stringify({
        referrer_npub: "npub_referrer",
        created_at,
      });
      expect(parseReferralContext(value)).toEqual({
        referrer_npub: "npub_referrer",
        created_at,
      });
    });
  });

  describe("isReferralContextExpired", () => {
    it("returns true for invalid date string", () => {
      expect(isReferralContextExpired("not-a-date")).toBe(true);
    });

    it("returns true when created_at is older than TTL", () => {
      const old = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString();
      expect(isReferralContextExpired(old)).toBe(true);
    });

    it("returns false when created_at is within TTL", () => {
      const recent = new Date().toISOString();
      expect(isReferralContextExpired(recent)).toBe(false);
    });
  });

  describe("serializeReferralContext", () => {
    it("returns JSON with referrer_npub and created_at", () => {
      const ctx = {
        referrer_npub: "npub_abc",
        created_at: "2025-01-01T00:00:00.000Z",
      };
      const s = serializeReferralContext(ctx);
      expect(JSON.parse(s)).toEqual(ctx);
    });
  });

  describe("getReferralContextFromCookie", () => {
    it("returns null when cookie parses to non-string", async () => {
      vi.mocked(referralContextCookie.parse).mockResolvedValue(123);
      const request = new Request("https://example.com", {
        headers: { Cookie: "referral_context=xyz" },
      });
      const ctx = await getReferralContextFromCookie(request);
      expect(ctx).toBeNull();
    });

    it("returns parsed context when cookie has valid string", async () => {
      const created_at = new Date().toISOString();
      const value = JSON.stringify({
        referrer_npub: "npub_ref",
        created_at,
      });
      vi.mocked(referralContextCookie.parse).mockResolvedValue(value);
      const request = new Request("https://example.com");
      const ctx = await getReferralContextFromCookie(request);
      expect(ctx).toEqual({ referrer_npub: "npub_ref", created_at });
    });
  });
});
