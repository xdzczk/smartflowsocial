/**
 * Unit tests for Nostr conversion utilities
 * 
 * Tests the utility functions in app/lib/nostr-conversion.ts
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { nip19 } from "nostr-tools";
import { convertToHex, convertHexToNpub } from "~/lib/nostr-conversion";

// Mock nostr-tools
vi.mock("nostr-tools", () => ({
  nip19: {
    decode: vi.fn(),
    npubEncode: vi.fn(),
  },
}));

describe("Nostr Conversion Utilities", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("convertToHex", () => {
    it("should convert valid npub to hex", () => {
      const testNpub = "npub1test123";
      const testHex = "abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890";

      (nip19.decode as ReturnType<typeof vi.fn>).mockReturnValue({
        type: "npub",
        data: testHex,
      });

      const result = convertToHex(testNpub);

      expect(nip19.decode).toHaveBeenCalledWith(testNpub);
      expect(result).toBe(testHex);
    });

    it("should return null when decode throws error", () => {
      const invalidNpub = "invalid-npub";

      (nip19.decode as ReturnType<typeof vi.fn>).mockImplementation(() => {
        throw new Error("Invalid npub");
      });

      const result = convertToHex(invalidNpub);

      expect(result).toBeNull();
    });

    it("should return null for empty string", () => {
      (nip19.decode as ReturnType<typeof vi.fn>).mockImplementation(() => {
        throw new Error("Invalid");
      });

      const result = convertToHex("");

      expect(result).toBeNull();
    });

    it("should handle decode returning non-string data", () => {
      const testNpub = "npub1test";

      (nip19.decode as ReturnType<typeof vi.fn>).mockReturnValue({
        type: "npub",
        data: { some: "object" }, // Non-string data
      });

      const result = convertToHex(testNpub);

      // Should return the data as string (cast)
      expect(result).toBeDefined();
    });

    it("should log error on decode failure", () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      const invalidNpub = "invalid";

      (nip19.decode as ReturnType<typeof vi.fn>).mockImplementation(() => {
        throw new Error("Decode failed");
      });

      convertToHex(invalidNpub);

      expect(consoleSpy).toHaveBeenCalledWith(
        "Error decoding npub:",
        expect.any(Error),
      );

      consoleSpy.mockRestore();
    });
  });

  describe("convertHexToNpub", () => {
    it("should convert valid hex to npub", () => {
      const testHex = "abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890";
      const testNpub = "npub1converted123";

      (nip19.npubEncode as ReturnType<typeof vi.fn>).mockReturnValue(testNpub);

      const result = convertHexToNpub(testHex);

      expect(nip19.npubEncode).toHaveBeenCalledWith(testHex);
      expect(result).toBe(testNpub);
    });

    it("should return original hex when encode throws error", () => {
      const testHex = "invalid-hex";

      (nip19.npubEncode as ReturnType<typeof vi.fn>).mockImplementation(() => {
        throw new Error("Invalid hex");
      });

      const result = convertHexToNpub(testHex);

      expect(result).toBe(testHex); // Should return original hex
    });

    it("should handle empty hex string", () => {
      (nip19.npubEncode as ReturnType<typeof vi.fn>).mockImplementation(() => {
        throw new Error("Invalid");
      });

      const result = convertHexToNpub("");

      expect(result).toBe("");
    });

    it("should log error on encode failure", () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      const invalidHex = "invalid-hex";

      (nip19.npubEncode as ReturnType<typeof vi.fn>).mockImplementation(() => {
        throw new Error("Encode failed");
      });

      convertHexToNpub(invalidHex);

      expect(consoleSpy).toHaveBeenCalledWith(
        "Error encoding hex to npub:",
        expect.any(Error),
      );

      consoleSpy.mockRestore();
    });

    it("should handle valid 64-character hex string", () => {
      const validHex = "a".repeat(64);
      const testNpub = "npub1valid";

      (nip19.npubEncode as ReturnType<typeof vi.fn>).mockReturnValue(testNpub);

      const result = convertHexToNpub(validHex);

      expect(result).toBe(testNpub);
    });

    it("should handle short hex strings", () => {
      const shortHex = "abc123";
      const testNpub = "npub1short";

      (nip19.npubEncode as ReturnType<typeof vi.fn>).mockReturnValue(testNpub);

      const result = convertHexToNpub(shortHex);

      expect(result).toBe(testNpub);
    });
  });

  describe("Round-trip conversion", () => {
    it("should handle conversion chain", () => {
      const testHex = "abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890";
      const testNpub = "npub1test123";

      (nip19.decode as ReturnType<typeof vi.fn>).mockReturnValue({
        type: "npub",
        data: testHex,
      });
      (nip19.npubEncode as ReturnType<typeof vi.fn>).mockReturnValue(testNpub);

      const hex = convertToHex(testNpub);
      const npub = convertHexToNpub(hex!);

      expect(hex).toBe(testHex);
      expect(npub).toBe(testNpub);
    });
  });
});




