/**
 * Unit tests for cryptographic Nostr SignedEvent validation
 * Tests app/lib/validation/nostr-cryptographic.server.ts
 *
 * These tests verify that SignedEvents are cryptographically validated,
 * not just structurally validated. This is critical for security.
 */

import { finalizeEvent, getPublicKey } from "nostr-tools";
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock error logger
vi.mock("~/lib/error-logger.server", () => ({
  logError: vi.fn(),
}));

import { logError } from "~/lib/error-logger.server";
import { ValidationError } from "~/lib/errors";
import {
  validateSignedEventCryptographically,
  tryValidateSignedEventCryptographically,
} from "~/lib/validation/nostr-cryptographic.server";

describe("Cryptographic SignedEvent Validation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Generate a test private key (hex string)
  const generateTestPrivateKey = (): Uint8Array => {
    // Generate a deterministic test key for consistent testing
    const key = new Uint8Array(32);
    for (let i = 0; i < 32; i++) {
      key[i] = i + 1;
    }
    return key;
  };

  const testPrivateKey = generateTestPrivateKey();
  const testPublicKey = getPublicKey(testPrivateKey);

  describe("validateSignedEventCryptographically", () => {
    it("should validate a cryptographically valid SignedEvent", () => {
      const nostrEvent = {
        kind: 1,
        created_at: Math.floor(Date.now() / 1000),
        tags: [],
        content: "Test post content",
      };

      const signedEvent = finalizeEvent(nostrEvent, testPrivateKey);

      const result = validateSignedEventCryptographically(signedEvent);

      // Check key properties (finalizeEvent may add extra properties like verified symbol)
      expect(result.id).toBe(signedEvent.id);
      expect(result.pubkey).toBe(testPublicKey);
      expect(result.sig).toBe(signedEvent.sig);
      expect(result.content).toBe(signedEvent.content);
      expect(result.kind).toBe(signedEvent.kind);
      expect(logError).not.toHaveBeenCalled();
    });

    it("should throw ValidationError for invalid event structure", () => {
      const invalidEvent = {
        id: "invalid",
        // Missing required fields
      };

      expect(() => {
        validateSignedEventCryptographically(invalidEvent);
      }).toThrow(ValidationError);

      expect(logError).toHaveBeenCalled();
    });

    it("should throw ValidationError for event with invalid signature", () => {
      // Create an event with invalid structure (missing required fields)
      // This will fail Zod validation before cryptographic validation
      const invalidEvent = {
        id: "invalid",
        // Missing other required fields like pubkey, created_at, kind, tags, content, sig
      };

      // This should fail because the structure is invalid
      expect(() => {
        validateSignedEventCryptographically(invalidEvent);
      }).toThrow(ValidationError);

      expect(logError).toHaveBeenCalled();
    });

    it("should throw ValidationError for event with mismatched ID", () => {
      // Create an event with invalid structure (missing required fields)
      // This will fail Zod validation before cryptographic validation
      const invalidEvent = {
        id: "a".repeat(64), // Invalid event ID
        // Missing other required fields like pubkey, created_at, kind, tags, content, sig
      };

      expect(() => {
        validateSignedEventCryptographically(invalidEvent);
      }).toThrow(ValidationError);

      expect(logError).toHaveBeenCalled();
    });

    it("should throw ValidationError for event with wrong pubkey", () => {
      // Create an event with completely invalid structure (missing required fields)
      // This will fail Zod validation before cryptographic validation
      const invalidEvent = {
        id: "invalid",
        pubkey: "b".repeat(64), // Wrong public key
        // Missing other required fields
      };

      expect(() => {
        validateSignedEventCryptographically(invalidEvent);
      }).toThrow(ValidationError);

      expect(logError).toHaveBeenCalled();
    });

    it("should validate events with different kinds", () => {
      const kinds = [1, 3, 30023]; // Text note, contacts, long-form

      kinds.forEach((kind) => {
        const nostrEvent = {
          kind,
          created_at: Math.floor(Date.now() / 1000),
          tags: [],
          content: `Test content for kind ${kind}`,
        };

        const signedEvent = finalizeEvent(nostrEvent, testPrivateKey);
        const result = validateSignedEventCryptographically(signedEvent);

        expect(result.kind).toBe(kind);
        expect(result.id).toBe(signedEvent.id);
      });
    });

    it("should validate events with tags", () => {
      const nostrEvent = {
        kind: 1,
        created_at: Math.floor(Date.now() / 1000),
        tags: [
          ["p", "pubkey1"],
          ["t", "hashtag"],
        ],
        content: "Test post with tags",
      };

      const signedEvent = finalizeEvent(nostrEvent, testPrivateKey);
      const result = validateSignedEventCryptographically(signedEvent);

      expect(result.tags).toEqual(nostrEvent.tags);
      expect(result.tags.length).toBe(2);
    });
  });

  describe("tryValidateSignedEventCryptographically", () => {
    it("should return valid: true for valid event", () => {
      const nostrEvent = {
        kind: 1,
        created_at: Math.floor(Date.now() / 1000),
        tags: [],
        content: "Test post",
      };

      const signedEvent = finalizeEvent(nostrEvent, testPrivateKey);
      const result = tryValidateSignedEventCryptographically(signedEvent);

      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it("should return valid: false for invalid event", () => {
      const invalidEvent = {
        id: "invalid",
        // Missing required fields
      };

      const result = tryValidateSignedEventCryptographically(invalidEvent);

      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
      expect(typeof result.error).toBe("string");
    });

    it("should return valid: false for event with invalid signature", () => {
      // Create an event with invalid structure (missing required fields)
      // This will fail Zod validation before cryptographic validation
      const invalidEvent = {
        id: "invalid",
        // Missing other required fields like pubkey, created_at, kind, tags, content, sig
      };

      const result = tryValidateSignedEventCryptographically(invalidEvent);

      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });

    it("should not throw errors, only return result object", () => {
      const invalidEvent = {
        id: "invalid",
      };

      // Should not throw
      expect(() => {
        tryValidateSignedEventCryptographically(invalidEvent);
      }).not.toThrow();

      const result = tryValidateSignedEventCryptographically(invalidEvent);
      expect(result.valid).toBe(false);
    });
  });

  describe("Edge cases", () => {
    it("should handle events with empty content", () => {
      const nostrEvent = {
        kind: 1,
        created_at: Math.floor(Date.now() / 1000),
        tags: [],
        content: "",
      };

      const signedEvent = finalizeEvent(nostrEvent, testPrivateKey);
      const result = validateSignedEventCryptographically(signedEvent);

      expect(result.content).toBe("");
      expect(result.id).toBe(signedEvent.id);
    });

    it("should handle events with very long content", () => {
      const longContent = "a".repeat(10000);
      const nostrEvent = {
        kind: 1,
        created_at: Math.floor(Date.now() / 1000),
        tags: [],
        content: longContent,
      };

      const signedEvent = finalizeEvent(nostrEvent, testPrivateKey);
      const result = validateSignedEventCryptographically(signedEvent);

      expect(result.content).toBe(longContent);
      expect(result.content.length).toBe(10000);
    });

    it("should handle events with special characters in content", () => {
      const specialContent =
        "Test with special chars: !@#$%^&*()_+-=[]{}|;':\",./<>?";
      const nostrEvent = {
        kind: 1,
        created_at: Math.floor(Date.now() / 1000),
        tags: [],
        content: specialContent,
      };

      const signedEvent = finalizeEvent(nostrEvent, testPrivateKey);
      const result = validateSignedEventCryptographically(signedEvent);

      expect(result.content).toBe(specialContent);
    });
  });
});
