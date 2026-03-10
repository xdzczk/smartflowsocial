/**
 * Unit tests for nostr-signer-keys (hexToBytes, serializeSecretKey, parseSecretKeyHex).
 * Tests app/features/auth/signer/nostr-signer-keys.client.ts
 */

import { describe, expect, it } from "vitest";

import {
  hexToBytes,
  serializeSecretKey,
  parseSecretKeyHex,
} from "~/features/auth/signer/nostr-signer-keys.client";

describe("nostr-signer-keys", () => {
  describe("hexToBytes", () => {
    it("parses valid hex string to Uint8Array", () => {
      const hex = "ab0f12";
      const bytes = hexToBytes(hex);
      expect(bytes).toBeInstanceOf(Uint8Array);
      expect(bytes.length).toBe(3);
      expect(bytes[0]).toBe(0xab);
      expect(bytes[1]).toBe(0x0f);
      expect(bytes[2]).toBe(0x12);
    });

    it("normalizes to lowercase", () => {
      const bytes = hexToBytes("AB");
      expect(bytes[0]).toBe(0xab);
    });

    it("trims whitespace", () => {
      const bytes = hexToBytes("  ab  ");
      expect(bytes.length).toBe(1);
      expect(bytes[0]).toBe(0xab);
    });

    it("throws for invalid hex characters", () => {
      expect(() => hexToBytes("gh")).toThrow("Invalid hex");
      expect(() => hexToBytes("abzz")).toThrow("Invalid hex");
    });

    it("throws for odd length", () => {
      expect(() => hexToBytes("abc")).toThrow("Invalid hex");
    });
  });

  describe("serializeSecretKey", () => {
    it("converts Uint8Array to hex string", () => {
      const bytes = new Uint8Array([0xab, 0xcd, 0xef]);
      expect(serializeSecretKey(bytes)).toBe("abcdef");
    });
  });

  describe("parseSecretKeyHex", () => {
    it("delegates to hexToBytes", () => {
      const bytes = parseSecretKeyHex("abcd");
      expect(bytes).toBeInstanceOf(Uint8Array);
      expect(bytes.length).toBe(2);
      expect(bytes[0]).toBe(0xab);
      expect(bytes[1]).toBe(0xcd);
    });
  });
});
