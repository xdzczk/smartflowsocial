/**
 * Unit tests for longform status calculator
 * Tests app/features/posts/services/longform-status-calculator.server.ts
 */

import { describe, it, expect } from "vitest";

import type { SignedEvent } from "~/features/nostr/types";
import { calculateLongFormStatus } from "~/features/posts/server";

describe("Longform Status Calculator", () => {
  describe("calculateLongFormStatus", () => {
    it("should return ACTIVE status for published posts", () => {
      const result = calculateLongFormStatus({
        isPublished: true,
        scheduledFor: null,
        signedEvent: null,
      });

      expect(result.status).toBe("ACTIVE");
      expect(result.isScheduled).toBe(false);
      expect(result.isDraft).toBe(false);
      expect(result.publishedAt).toBeInstanceOf(Date);
    });

    it("should return SCHEDULED status for scheduled posts", () => {
      const scheduledFor = String(Math.floor(Date.now() / 1000) + 3600); // 1 hour from now
      const result = calculateLongFormStatus({
        isPublished: false,
        scheduledFor,
        signedEvent: null,
      });

      expect(result.status).toBe("SCHEDULED");
      expect(result.isScheduled).toBe(true);
      expect(result.isDraft).toBe(false);
      expect(result.finalScheduledFor).toBe(scheduledFor);
      expect(result.publishedAt).toBeInstanceOf(Date);
    });

    it("should return DRAFT status for unpublished, unscheduled posts", () => {
      const result = calculateLongFormStatus({
        isPublished: false,
        scheduledFor: null,
        signedEvent: null,
      });

      expect(result.status).toBe("DRAFT");
      expect(result.isScheduled).toBe(false);
      expect(result.isDraft).toBe(true);
      expect(result.publishedAt).toBeNull();
    });

    it("should extract scheduledFor from signedEvent tags if not provided", () => {
      const publishedAtTimestamp = Math.floor(Date.now() / 1000) + 7200; // 2 hours from now
      const signedEvent: SignedEvent = {
        id: "event-123",
        pubkey: "pubkey-123",
        created_at: Math.floor(Date.now() / 1000),
        kind: 30023,
        tags: [["published_at", String(publishedAtTimestamp)]],
        content: "Test content",
        sig: "sig-123",
      };

      const result = calculateLongFormStatus({
        isPublished: false,
        scheduledFor: null,
        signedEvent,
      });

      expect(result.status).toBe("SCHEDULED");
      expect(result.isScheduled).toBe(true);
      expect(result.finalScheduledFor).toBe(String(publishedAtTimestamp));
    });

    it("should use provided scheduledFor over signedEvent tags", () => {
      const scheduledFor = String(Math.floor(Date.now() / 1000) + 3600);
      const signedEvent: SignedEvent = {
        id: "event-123",
        pubkey: "pubkey-123",
        created_at: Math.floor(Date.now() / 1000),
        kind: 30023,
        tags: [["published_at", String(Math.floor(Date.now() / 1000) + 7200)]],
        content: "Test content",
        sig: "sig-123",
      };

      const result = calculateLongFormStatus({
        isPublished: false,
        scheduledFor,
        signedEvent,
      });

      expect(result.finalScheduledFor).toBe(scheduledFor);
    });

    it("should extract nostrEventId from signedEvent", () => {
      const signedEvent: SignedEvent = {
        id: "event-456",
        pubkey: "pubkey-123",
        created_at: Math.floor(Date.now() / 1000),
        kind: 30023,
        tags: [],
        content: "Test content",
        sig: "sig-123",
      };

      const result = calculateLongFormStatus({
        isPublished: true,
        scheduledFor: null,
        signedEvent,
      });

      expect(result.nostrEventId).toBe("event-456");
    });

    it("should return null nostrEventId if signedEvent is null", () => {
      const result = calculateLongFormStatus({
        isPublished: true,
        scheduledFor: null,
        signedEvent: null,
      });

      expect(result.nostrEventId).toBeNull();
    });

    it("should extract publishedAt from signedEvent tags for published posts", () => {
      const publishedAtTimestamp = Math.floor(Date.now() / 1000) - 3600; // 1 hour ago
      const signedEvent: SignedEvent = {
        id: "event-123",
        pubkey: "pubkey-123",
        created_at: Math.floor(Date.now() / 1000),
        kind: 30023,
        tags: [["published_at", String(publishedAtTimestamp)]],
        content: "Test content",
        sig: "sig-123",
      };

      const result = calculateLongFormStatus({
        isPublished: true,
        scheduledFor: null,
        signedEvent,
      });

      expect(result.publishedAt).toBeInstanceOf(Date);
      expect(result.publishedAt?.getTime()).toBe(publishedAtTimestamp * 1000);
    });

    it("should use current time for publishedAt if no published_at tag", () => {
      const before = Date.now();
      const result = calculateLongFormStatus({
        isPublished: true,
        scheduledFor: null,
        signedEvent: null,
      });
      const after = Date.now();

      expect(result.publishedAt).toBeInstanceOf(Date);
      expect(result.publishedAt?.getTime()).toBeGreaterThanOrEqual(before);
      expect(result.publishedAt?.getTime()).toBeLessThanOrEqual(after);
    });

    it("should handle published_at tag with number value", () => {
      const publishedAtTimestamp = Math.floor(Date.now() / 1000) - 1800; // 30 minutes ago
      const signedEvent: SignedEvent = {
        id: "event-123",
        pubkey: "pubkey-123",
        created_at: Math.floor(Date.now() / 1000),
        kind: 30023,
        tags: [["published_at", String(publishedAtTimestamp)]],
        content: "Test content",
        sig: "sig-123",
      };

      const result = calculateLongFormStatus({
        isPublished: true,
        scheduledFor: null,
        signedEvent,
      });

      expect(result.publishedAt).toBeInstanceOf(Date);
      expect(result.publishedAt?.getTime()).toBe(publishedAtTimestamp * 1000);
    });

    it("should handle published_at tag with string value", () => {
      const publishedAtTimestamp = Math.floor(Date.now() / 1000) - 900; // 15 minutes ago
      const signedEvent: SignedEvent = {
        id: "event-123",
        pubkey: "pubkey-123",
        created_at: Math.floor(Date.now() / 1000),
        kind: 30023,
        tags: [["published_at", String(publishedAtTimestamp)]],
        content: "Test content",
        sig: "sig-123",
      };

      const result = calculateLongFormStatus({
        isPublished: true,
        scheduledFor: null,
        signedEvent,
      });

      expect(result.publishedAt).toBeInstanceOf(Date);
      expect(result.publishedAt?.getTime()).toBe(publishedAtTimestamp * 1000);
    });

    it("should handle empty tags array", () => {
      const signedEvent: SignedEvent = {
        id: "event-123",
        pubkey: "pubkey-123",
        created_at: Math.floor(Date.now() / 1000),
        kind: 30023,
        tags: [],
        content: "Test content",
        sig: "sig-123",
      };

      const result = calculateLongFormStatus({
        isPublished: false,
        scheduledFor: null,
        signedEvent,
      });

      expect(result.status).toBe("DRAFT");
      expect(result.finalScheduledFor).toBeNull();
    });

    it("should handle tags without published_at", () => {
      const signedEvent: SignedEvent = {
        id: "event-123",
        pubkey: "pubkey-123",
        created_at: Math.floor(Date.now() / 1000),
        kind: 30023,
        tags: [
          ["t", "tag1"],
          ["t", "tag2"],
        ],
        content: "Test content",
        sig: "sig-123",
      };

      const result = calculateLongFormStatus({
        isPublished: false,
        scheduledFor: null,
        signedEvent,
      });

      expect(result.status).toBe("DRAFT");
      expect(result.finalScheduledFor).toBeNull();
    });
  });
});
