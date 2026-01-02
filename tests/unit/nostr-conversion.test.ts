/**
 * Unit tests for Nostr conversion utilities
 * Tests app/lib/nostr-conversion.ts
 */

import { describe, it, expect, vi } from "vitest";

// Mock nip19
vi.mock("nostr-tools", () => ({
  nip19: {
    decode: vi.fn((npub: string) => {
      if (!npub.startsWith("npub")) throw new Error("Invalid npub");
      return { type: "npub", data: npub.slice(4, 36) };
    }),
    npubEncode: vi.fn((hex: string) => {
      if (!hex || hex.length < 32) throw new Error("Invalid hex");
      return `npub${hex.slice(0, 32)}`;
    }),
  },
}));

import { convertToHex, convertHexToNpub } from "~/lib/nostr-conversion";

describe("Nostr Conversion Utilities", () => {
  describe("convertToHex", () => {
    it("should convert valid npub to hex", () => {
      const result = convertToHex("npub1abc123");

      expect(result).toBe("1abc123");
    });

    it("should return null for invalid npub", () => {
      const result = convertToHex("invalid");

      expect(result).toBeNull();
    });

    it("should return null for empty string", () => {
      const result = convertToHex("");

      expect(result).toBeNull();
    });
  });

  describe("convertHexToNpub", () => {
    it("should convert valid hex to npub", () => {
      const hex = "a".repeat(64);
      const result = convertHexToNpub(hex);

      expect(result).toMatch(/^npub/);
    });

    it("should return original hex if conversion fails", () => {
      const invalidHex = "short";
      const result = convertHexToNpub(invalidHex);

      expect(result).toBe(invalidHex);
    });
  });
});
