/**
 * Unit tests for Nostr conversion utilities
 * Tests app/lib/nostr-conversion.ts
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

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

import {
  convertToHex,
  convertHexToNpub,
  formatNpubShort,
} from "~/lib/nostr-conversion";

describe("Nostr Conversion Utilities", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

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

    it("should return null when decode throws", () => {
      const result = convertToHex("not-npub-prefix");

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

  describe("formatNpubShort", () => {
    it("should return empty string for empty input", () => {
      expect(formatNpubShort("")).toBe("");
    });

    it("should return empty string for undefined", () => {
      expect(formatNpubShort(undefined)).toBe("");
    });

    it("should return npub as-is when length <= 20", () => {
      const short = "npub1234567890123456";
      expect(formatNpubShort(short)).toBe(short);
    });

    it("should shorten npub when length > 20", () => {
      const long = "npub123456789012345678901234567890ab";
      expect(formatNpubShort(long)).toBe(
        `${long.slice(0, 8)}...${long.slice(-8)}`
      );
    });

    it("should convert hex to npub and shorten when npub length > 20", () => {
      const hex = "a".repeat(32);
      const result = formatNpubShort(hex);
      expect(result).toMatch(/^npub.{4}\.\.\..{8}$/);
    });

    it("should return shortened hex when encode fails and hex length > 20", () => {
      const longHex = "x".repeat(25);
      const result = formatNpubShort(longHex);
      expect(result).toBe(`${longHex.slice(0, 8)}...${longHex.slice(-8)}`);
    });

    it("should return hex as-is when encode fails and hex length <= 20", () => {
      const shortHex = "ab";
      const result = formatNpubShort(shortHex);
      expect(result).toBe(shortHex);
    });
  });
});
