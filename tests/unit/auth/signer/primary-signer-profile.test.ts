/**
 * Unit tests for primary signer profile type guard
 * Tests app/features/auth/signer/primary-signer-profile.ts
 */

import { describe, it, expect } from "vitest";

import { isPrimarySignerProfile } from "~/features/auth/signer/primary-signer-profile";

describe("primary-signer-profile", () => {
  describe("isPrimarySignerProfile", () => {
    it("rejects null", () => {
      expect(isPrimarySignerProfile(null)).toBe(false);
    });

    it("rejects non-object", () => {
      expect(isPrimarySignerProfile(42)).toBe(false);
      expect(isPrimarySignerProfile("x")).toBe(false);
      expect(isPrimarySignerProfile(undefined)).toBe(false);
    });

    it("rejects arrays", () => {
      expect(isPrimarySignerProfile([])).toBe(false);
      expect(isPrimarySignerProfile([{ type: "nip46" }])).toBe(false);
    });

    it("rejects when type is not nip46", () => {
      expect(
        isPrimarySignerProfile({
          type: "nip07",
          method: "bunker_input",
          bunkerInput: "x",
          label: null,
          expectedPubkey: null,
          updatedAt: "2025-01-01T00:00:00Z",
        })
      ).toBe(false);
    });

    it("rejects invalid label (non-string, non-null)", () => {
      expect(
        isPrimarySignerProfile({
          type: "nip46",
          method: "bunker_input",
          bunkerInput: "x",
          label: 1,
          expectedPubkey: null,
          updatedAt: "2025-01-01T00:00:00Z",
        })
      ).toBe(false);
    });

    it("rejects invalid expectedPubkey (non-string, non-null)", () => {
      expect(
        isPrimarySignerProfile({
          type: "nip46",
          method: "bunker_input",
          bunkerInput: "x",
          label: null,
          expectedPubkey: 123,
          updatedAt: "2025-01-01T00:00:00Z",
        })
      ).toBe(false);
    });

    it("rejects invalid updatedAt (non-ISO date)", () => {
      expect(
        isPrimarySignerProfile({
          type: "nip46",
          method: "bunker_input",
          bunkerInput: "x",
          label: null,
          expectedPubkey: null,
          updatedAt: "not-a-date",
        })
      ).toBe(false);
    });

    it("accepts bunker_input with non-empty bunkerInput", () => {
      expect(
        isPrimarySignerProfile({
          type: "nip46",
          method: "bunker_input",
          bunkerInput: "bunker+relay",
          label: null,
          expectedPubkey: null,
          updatedAt: "2025-01-01T00:00:00Z",
        })
      ).toBe(true);
    });

    it("rejects bunker_input with empty bunkerInput", () => {
      expect(
        isPrimarySignerProfile({
          type: "nip46",
          method: "bunker_input",
          bunkerInput: "",
          label: null,
          expectedPubkey: null,
          updatedAt: "2025-01-01T00:00:00Z",
        })
      ).toBe(false);
    });

    it("rejects bunker_input when bunkerInput is not a string", () => {
      expect(
        isPrimarySignerProfile({
          type: "nip46",
          method: "bunker_input",
          bunkerInput: 123,
          label: null,
          expectedPubkey: null,
          updatedAt: "2025-01-01T00:00:00Z",
        })
      ).toBe(false);
    });

    it("accepts nostrconnect_uri with non-empty uri and string relays", () => {
      expect(
        isPrimarySignerProfile({
          type: "nip46",
          method: "nostrconnect_uri",
          uri: "nostrconnect://...",
          relays: ["wss://a", "wss://b"],
          label: null,
          expectedPubkey: null,
          updatedAt: "2025-01-01T00:00:00Z",
        })
      ).toBe(true);
    });

    it("rejects nostrconnect_uri with empty uri", () => {
      expect(
        isPrimarySignerProfile({
          type: "nip46",
          method: "nostrconnect_uri",
          uri: "",
          relays: ["wss://a"],
          label: null,
          expectedPubkey: null,
          updatedAt: "2025-01-01T00:00:00Z",
        })
      ).toBe(false);
    });

    it("rejects nostrconnect_uri when relays is not an array", () => {
      expect(
        isPrimarySignerProfile({
          type: "nip46",
          method: "nostrconnect_uri",
          uri: "x",
          relays: "wss://a",
          label: null,
          expectedPubkey: null,
          updatedAt: "2025-01-01T00:00:00Z",
        })
      ).toBe(false);
    });

    it("rejects nostrconnect_uri when relay element is not a string", () => {
      expect(
        isPrimarySignerProfile({
          type: "nip46",
          method: "nostrconnect_uri",
          uri: "x",
          relays: ["wss://a", 1],
          label: null,
          expectedPubkey: null,
          updatedAt: "2025-01-01T00:00:00Z",
        })
      ).toBe(false);
    });

    it("rejects unknown method", () => {
      expect(
        isPrimarySignerProfile({
          type: "nip46",
          method: "other",
          label: null,
          expectedPubkey: null,
          updatedAt: "2025-01-01T00:00:00Z",
        })
      ).toBe(false);
    });

    it("accepts with string label and expectedPubkey", () => {
      expect(
        isPrimarySignerProfile({
          type: "nip46",
          method: "bunker_input",
          bunkerInput: "x",
          label: "My signer",
          expectedPubkey: "abc",
          updatedAt: "2025-06-15T12:00:00Z",
        })
      ).toBe(true);
    });
  });
});
