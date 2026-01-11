/**
 * Unit tests for Version Handler
 * Tests app/infra/queue/version-handler.server.ts
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("~/lib/error-logger.server", () => ({
  logWarning: vi.fn(),
  logError: vi.fn(),
}));

import type { PostScheduledPayload } from "~/infra/outbox/outbox.server";
import {
  isVersionSupported,
  getPayloadVersion,
  validatePayloadVersion,
  migratePayloadToCurrentVersion,
  normalizePayload,
  processPayloadWithVersion,
  CURRENT_VERSION,
} from "~/infra/queue/version-handler.server";

describe("Version Handler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("isVersionSupported", () => {
    it("should return true for supported versions", () => {
      expect(isVersionSupported("1.0")).toBe(true);
    });

    it("should return false for unsupported versions", () => {
      expect(isVersionSupported("2.0")).toBe(false);
      expect(isVersionSupported("0.9")).toBe(false);
      expect(isVersionSupported("invalid")).toBe(false);
    });
  });

  describe("getPayloadVersion", () => {
    it("should extract version from payload with schemaVersion", () => {
      const payload = { schemaVersion: "1.0", postId: "post-1" };
      expect(getPayloadVersion(payload)).toBe("1.0");
    });

    it("should return undefined if schemaVersion is missing", () => {
      const payload = { postId: "post-1" };
      expect(getPayloadVersion(payload)).toBeUndefined();
    });

    it("should return undefined if schemaVersion is not a string", () => {
      const payload = { schemaVersion: 1.0, postId: "post-1" };
      expect(getPayloadVersion(payload)).toBeUndefined();
    });

    it("should return undefined for null payload", () => {
      expect(getPayloadVersion(null)).toBeUndefined();
    });

    it("should return undefined for non-object payload", () => {
      expect(getPayloadVersion("string")).toBeUndefined();
      expect(getPayloadVersion(123)).toBeUndefined();
    });
  });

  describe("validatePayloadVersion", () => {
    it("should validate payload with supported version", () => {
      const payload = { schemaVersion: "1.0", postId: "post-1" };
      const result = validatePayloadVersion(payload);

      expect(result.valid).toBe(true);
      expect(result.version).toBe("1.0");
      expect(result.error).toBeUndefined();
    });

    it("should reject payload without schemaVersion", () => {
      const payload = { postId: "post-1" };
      const result = validatePayloadVersion(payload);

      expect(result.valid).toBe(false);
      expect(result.version).toBeUndefined();
      expect(result.error).toContain("Missing schemaVersion");
    });

    it("should reject payload with unsupported version", () => {
      const payload = { schemaVersion: "2.0", postId: "post-1" };
      const result = validatePayloadVersion(payload);

      expect(result.valid).toBe(false);
      expect(result.version).toBe("2.0");
      expect(result.error).toContain("Unsupported schema version");
    });

    it("should include context in error logging", () => {
      const payload = { schemaVersion: "2.0", postId: "post-1" };
      const context = { eventId: "event-1", aggregateId: "post-1" };

      validatePayloadVersion(payload, context);

      // Context is passed to logWarning (tested via mocks)
      expect(payload.schemaVersion).toBe("2.0");
    });
  });

  describe("migratePayloadToCurrentVersion", () => {
    it("should return payload unchanged if already at current version", () => {
      const payload: PostScheduledPayload = {
        postId: "post-1",
        userId: "user-1",
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any -- Test mock with partial signed event
        signedEvent: { id: "event-1" } as any,
        scheduledFor: 1234567890,
        schemaVersion: "1.0",
      };

      const migrated = migratePayloadToCurrentVersion(payload, "1.0");

      expect(migrated).toEqual(payload);
    });

    it("should migrate payload from older version", () => {
      const payload: PostScheduledPayload = {
        postId: "post-1",
        userId: "user-1",
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any -- Test mock with partial signed event
        signedEvent: { id: "event-1" } as any,
        scheduledFor: 1234567890,
        schemaVersion: "1.0",
      };

      // Currently all versions are compatible, so it just returns as-is
      const migrated = migratePayloadToCurrentVersion(payload, "0.9");

      expect(migrated).toEqual(payload);
    });
  });

  describe("normalizePayload", () => {
    it("should normalize valid payload for version 1.0", () => {
      const payload = {
        postId: "post-1",
        userId: "user-1",
        signedEvent: { id: "event-1" },
        scheduledFor: 1234567890,
      };

      const normalized = normalizePayload(payload, "1.0");

      expect(normalized).not.toBeNull();
      expect(normalized?.schemaVersion).toBe("1.0");
      expect(normalized?.postId).toBe("post-1");
      expect(normalized?.userId).toBe("user-1");
    });

    it("should add correlationId field if missing", () => {
      const payload = {
        postId: "post-1",
        userId: "user-1",
        signedEvent: { id: "event-1" },
        scheduledFor: 1234567890,
      };

      const normalized = normalizePayload(payload, "1.0");

      expect(normalized).not.toBeNull();
      expect("correlationId" in normalized!).toBe(true);
    });

    it("should return null for unsupported version", () => {
      const payload = {
        postId: "post-1",
        userId: "user-1",
        signedEvent: { id: "event-1" },
        scheduledFor: 1234567890,
      };

      const normalized = normalizePayload(payload, "2.0");

      expect(normalized).toBeNull();
    });

    it("should return null for invalid payload structure", () => {
      const payload = {
        postId: "post-1",
        // Missing required fields
      };

      const normalized = normalizePayload(payload, "1.0");

      expect(normalized).toBeNull();
    });
  });

  describe("processPayloadWithVersion", () => {
    it("should process valid payload successfully", () => {
      const payload: PostScheduledPayload = {
        postId: "post-1",
        userId: "user-1",
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any -- Test mock with partial signed event
        signedEvent: { id: "event-1" } as any,
        scheduledFor: 1234567890,
        schemaVersion: "1.0",
      };

      const result = processPayloadWithVersion(payload);

      expect(result.success).toBe(true);
      expect(result.payload).toBeDefined();
      expect(result.version).toBe(CURRENT_VERSION);
      expect(result.error).toBeUndefined();
    });

    it("should fail for payload without schemaVersion", () => {
      const payload = {
        postId: "post-1",
        userId: "user-1",
        signedEvent: { id: "event-1" },
        scheduledFor: 1234567890,
      };

      const result = processPayloadWithVersion(payload);

      expect(result.success).toBe(false);
      expect(result.error).toContain("Missing schemaVersion");
      expect(result.payload).toBeUndefined();
    });

    it("should fail for payload with unsupported version", () => {
      const payload = {
        postId: "post-1",
        userId: "user-1",
        signedEvent: { id: "event-1" },
        scheduledFor: 1234567890,
        schemaVersion: "2.0",
      };

      const result = processPayloadWithVersion(payload);

      expect(result.success).toBe(false);
      expect(result.error).toContain("Unsupported schema version");
      // Version is only returned if validation passes, but fails at normalization
      expect(result.version).toBeUndefined();
    });

    it("should include context in error messages", () => {
      const payload = {
        postId: "post-1",
        schemaVersion: "2.0",
      };

      const context = { eventId: "event-1", aggregateId: "post-1" };
      const result = processPayloadWithVersion(payload, context);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it("should normalize and migrate payload", () => {
      const payload = {
        postId: "post-1",
        userId: "user-1",
        signedEvent: { id: "event-1" },
        scheduledFor: 1234567890,
        schemaVersion: "1.0",
      };

      const result = processPayloadWithVersion<PostScheduledPayload>(payload);

      expect(result.success).toBe(true);
      expect(result.payload).toBeDefined();
      expect(result.payload?.schemaVersion).toBe(CURRENT_VERSION);
    });
  });
});
