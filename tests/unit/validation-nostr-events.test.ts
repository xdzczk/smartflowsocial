/**
 * Unit tests for Nostr event validation utilities
 * Tests app/lib/validation/nostr-events.server.ts
 */

import type { Prisma } from "@prisma/client";
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock error logger
vi.mock("~/lib/error-logger.server", () => ({
  logError: vi.fn(),
}));

import { logError } from "~/lib/error-logger.server";
import {
  validateSignedEvent,
  validateNostrEvent,
} from "~/lib/validation/nostr-events.server";

describe("Nostr Event Validation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("validateSignedEvent", () => {
    it("should return null for null input", () => {
      const result = validateSignedEvent(null);
      expect(result).toBeNull();
    });

    it("should return null for undefined input", () => {
      const result = validateSignedEvent(undefined);
      expect(result).toBeNull();
    });

    it("should return null for non-object input", () => {
      expect(validateSignedEvent("string")).toBeNull();
      expect(validateSignedEvent(123)).toBeNull();
      expect(validateSignedEvent([])).toBeNull();
    });

    it("should return validated SignedEvent for valid input", () => {
      const validEvent: Prisma.JsonValue = {
        id: "event-id-123",
        pubkey: "pubkey-123",
        created_at: 1234567890,
        kind: 1,
        tags: [["tag1", "value1"]],
        content: "Test content",
        sig: "signature-123",
      };

      const result = validateSignedEvent(validEvent);

      expect(result).not.toBeNull();
      if (result) {
        expect(result.id).toBe("event-id-123");
        expect(result.pubkey).toBe("pubkey-123");
        expect(result.created_at).toBe(1234567890);
        expect(result.kind).toBe(1);
        expect(result.content).toBe("Test content");
        expect(result.sig).toBe("signature-123");
        expect(Array.isArray(result.tags)).toBe(true);
      }
    });

    it("should return null for invalid SignedEvent structure", () => {
      const invalidEvent: Prisma.JsonValue = {
        id: "event-id-123",
        // Missing required fields
      };

      const result = validateSignedEvent(invalidEvent);

      expect(result).toBeNull();
      expect(logError).toHaveBeenCalled();
    });

    it("should return null for SignedEvent with wrong types", () => {
      const invalidEvent: Prisma.JsonValue = {
        id: 123, // Should be string
        pubkey: "pubkey-123",
        created_at: "not-a-number", // Should be number
        kind: 1,
        tags: [],
        content: "Test",
        sig: "sig",
      };

      const result = validateSignedEvent(invalidEvent);

      expect(result).toBeNull();
      expect(logError).toHaveBeenCalled();
    });

    it("should log error details when validation fails", () => {
      const invalidEvent: Prisma.JsonValue = {
        id: "event-id",
        // Missing required fields
      };

      validateSignedEvent(invalidEvent);

      expect(logError).toHaveBeenCalled();
      const callArgs = vi.mocked(logError).mock.calls[0];
      expect(callArgs?.[1]?.["message"]).toContain("Invalid SignedEvent");
      expect(callArgs?.[1]?.["context"]).toBeDefined();
    });

    it("should handle SignedEvent with empty tags", () => {
      const validEvent: Prisma.JsonValue = {
        id: "event-id-123",
        pubkey: "pubkey-123",
        created_at: 1234567890,
        kind: 1,
        tags: [],
        content: "Test content",
        sig: "signature-123",
      };

      const result = validateSignedEvent(validEvent);

      expect(result).not.toBeNull();
      if (result) {
        expect(result.tags).toEqual([]);
      }
    });

    it("should handle SignedEvent with multiple tags", () => {
      const validEvent: Prisma.JsonValue = {
        id: "event-id-123",
        pubkey: "pubkey-123",
        created_at: 1234567890,
        kind: 1,
        tags: [
          ["tag1", "value1"],
          ["tag2", "value2", "value3"],
        ],
        content: "Test content",
        sig: "signature-123",
      };

      const result = validateSignedEvent(validEvent);

      expect(result).not.toBeNull();
      if (result) {
        expect(result.tags).toHaveLength(2);
        expect(result.tags[0]).toEqual(["tag1", "value1"]);
        expect(result.tags[1]).toEqual(["tag2", "value2", "value3"]);
      }
    });
  });

  describe("validateNostrEvent", () => {
    it("should return null for null input", () => {
      const result = validateNostrEvent(null);
      expect(result).toBeNull();
    });

    it("should return null for undefined input", () => {
      const result = validateNostrEvent(undefined);
      expect(result).toBeNull();
    });

    it("should return null for non-object input", () => {
      expect(validateNostrEvent("string")).toBeNull();
      expect(validateNostrEvent(123)).toBeNull();
      expect(validateNostrEvent([])).toBeNull();
    });

    it("should return validated NostrEvent for valid input", () => {
      const validEvent: Prisma.JsonValue = {
        content: "Test content",
        created_at: 1234567890,
        kind: 1,
        tags: [["tag1", "value1"]],
      };

      const result = validateNostrEvent(validEvent);

      expect(result).not.toBeNull();
      if (result) {
        expect(result.content).toBe("Test content");
        expect(result.created_at).toBe(1234567890);
        expect(result.kind).toBe(1);
        expect(Array.isArray(result.tags)).toBe(true);
      }
    });

    it("should return null for invalid NostrEvent structure", () => {
      const invalidEvent: Prisma.JsonValue = {
        content: "Test",
        // Missing required fields
      };

      const result = validateNostrEvent(invalidEvent);

      expect(result).toBeNull();
      expect(logError).toHaveBeenCalled();
    });

    it("should return null for NostrEvent with wrong types", () => {
      const invalidEvent: Prisma.JsonValue = {
        content: 123, // Should be string
        created_at: "not-a-number", // Should be number
        kind: "1", // Should be number
        tags: "not-an-array", // Should be array
      };

      const result = validateNostrEvent(invalidEvent);

      expect(result).toBeNull();
      expect(logError).toHaveBeenCalled();
    });

    it("should log error details when validation fails", () => {
      const invalidEvent: Prisma.JsonValue = {
        content: "Test",
        // Missing required fields
      };

      validateNostrEvent(invalidEvent);

      expect(logError).toHaveBeenCalled();
      const callArgs = vi.mocked(logError).mock.calls[0];
      expect(callArgs?.[1]?.["message"]).toContain("Invalid NostrEvent");
      expect(callArgs?.[1]?.["context"]).toBeDefined();
    });

    it("should handle NostrEvent with empty tags", () => {
      const validEvent: Prisma.JsonValue = {
        content: "Test content",
        created_at: 1234567890,
        kind: 1,
        tags: [],
      };

      const result = validateNostrEvent(validEvent);

      expect(result).not.toBeNull();
      if (result) {
        expect(result.tags).toEqual([]);
      }
    });

    it("should handle different event kinds", () => {
      const event1: Prisma.JsonValue = {
        content: "Note",
        created_at: 1234567890,
        kind: 1,
        tags: [],
      };

      const event2: Prisma.JsonValue = {
        content: "Metadata",
        created_at: 1234567890,
        kind: 0,
        tags: [],
      };

      const result1 = validateNostrEvent(event1);
      const result2 = validateNostrEvent(event2);

      expect(result1).not.toBeNull();
      expect(result2).not.toBeNull();
      if (result1 && result2) {
        expect(result1.kind).toBe(1);
        expect(result2.kind).toBe(0);
      }
    });
  });
});
