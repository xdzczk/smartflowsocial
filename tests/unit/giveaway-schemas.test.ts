/**
 * Unit tests for giveaway Zod schemas.
 * Tests app/features/giveaway/schemas.ts
 */

import { describe, it, expect } from "vitest";

import {
  scopeReferencePeriodSchema,
  scopeReferenceSinglePostSchema,
  scopeReferenceQueueSchema,
  createGiveawaySchema,
  winnerSnapshotSchema,
  createGiveawayPresetSchema,
} from "~/features/giveaway/schemas";

describe("giveaway-schemas", () => {
  describe("scopeReferencePeriodSchema", () => {
    it("accepts valid period with days", () => {
      const result = scopeReferencePeriodSchema.safeParse({ days: 7 });
      expect(result.success).toBe(true);
    });

    it("accepts optional from/to strings", () => {
      const result = scopeReferencePeriodSchema.safeParse({
        days: 14,
        from: "2025-01-01",
        to: "2025-01-31",
      });
      expect(result.success).toBe(true);
    });

    it("rejects days out of range", () => {
      expect(scopeReferencePeriodSchema.safeParse({ days: 0 }).success).toBe(
        false
      );
      expect(scopeReferencePeriodSchema.safeParse({ days: 400 }).success).toBe(
        false
      );
    });
  });

  describe("scopeReferenceSinglePostSchema", () => {
    it("accepts postId non-empty string", () => {
      const result = scopeReferenceSinglePostSchema.safeParse({
        postId: "post-123",
      });
      expect(result.success).toBe(true);
    });

    it("rejects empty postId", () => {
      expect(
        scopeReferenceSinglePostSchema.safeParse({ postId: "" }).success
      ).toBe(false);
    });
  });

  describe("scopeReferenceQueueSchema", () => {
    it("accepts queueId and optional from/to", () => {
      const result = scopeReferenceQueueSchema.safeParse({
        queueId: "queue-1",
        from: "2025-01-01",
        to: "2025-01-31",
      });
      expect(result.success).toBe(true);
    });

    it("rejects empty queueId", () => {
      expect(scopeReferenceQueueSchema.safeParse({ queueId: "" }).success).toBe(
        false
      );
    });
  });

  describe("createGiveawaySchema", () => {
    it("accepts valid create payload", () => {
      const result = createGiveawaySchema.safeParse({
        scopeType: "PERIOD",
        scopeReference: { days: 7 },
        engagementTypes: ["REACTION", "ZAP"],
        winnerCount: 3,
        selectionMode: "UNIQUE_USER",
      });
      expect(result.success).toBe(true);
    });

    it("accepts all scope types", () => {
      for (const scopeType of [
        "PERIOD",
        "SINGLE_POST",
        "QUEUE",
        "FOLLOWERS",
        "FOLLOWING",
      ]) {
        const result = createGiveawaySchema.safeParse({
          scopeType,
          scopeReference:
            scopeType === "SINGLE_POST"
              ? { postId: "p1" }
              : scopeType === "QUEUE"
                ? { queueId: "q1" }
                : {},
          engagementTypes: ["REACTION"],
          winnerCount: 1,
        });
        expect(result.success).toBe(true);
      }
    });

    it("rejects invalid scopeType", () => {
      const result = createGiveawaySchema.safeParse({
        scopeType: "INVALID",
        scopeReference: {},
        engagementTypes: ["REACTION"],
        winnerCount: 1,
      });
      expect(result.success).toBe(false);
    });

    it("rejects empty engagementTypes", () => {
      const result = createGiveawaySchema.safeParse({
        scopeType: "PERIOD",
        scopeReference: {},
        engagementTypes: [],
        winnerCount: 1,
      });
      expect(result.success).toBe(false);
    });

    it("rejects winnerCount out of range", () => {
      expect(
        createGiveawaySchema.safeParse({
          scopeType: "PERIOD",
          scopeReference: {},
          engagementTypes: ["REACTION"],
          winnerCount: 0,
        }).success
      ).toBe(false);
      expect(
        createGiveawaySchema.safeParse({
          scopeType: "PERIOD",
          scopeReference: {},
          engagementTypes: ["REACTION"],
          winnerCount: 101,
        }).success
      ).toBe(false);
    });

    it("accepts valid filters", () => {
      const result = createGiveawaySchema.safeParse({
        scopeType: "PERIOD",
        scopeReference: {},
        engagementTypes: ["REACTION"],
        winnerCount: 1,
        filters: { excludeMuted: true, minFollowers: 10 },
      });
      expect(result.success).toBe(true);
    });
  });

  describe("winnerSnapshotSchema", () => {
    it("accepts valid winner snapshot", () => {
      const result = winnerSnapshotSchema.safeParse([
        {
          pubkey: "pk1",
          npub: "npub1",
          qualifyingActions: [{ kind: 7, eventId: "ev1" }],
        },
      ]);
      expect(result.success).toBe(true);
    });

    it("rejects missing pubkey", () => {
      const result = winnerSnapshotSchema.safeParse([
        {
          npub: "npub1",
          qualifyingActions: [],
        },
      ]);
      expect(result.success).toBe(false);
    });
  });

  describe("createGiveawayPresetSchema", () => {
    it("accepts valid preset payload", () => {
      const result = createGiveawayPresetSchema.safeParse({
        name: "My Preset",
        scopeType: "PERIOD",
        scopeReference: { days: 7 },
        engagementTypes: ["REACTION", "REPOST"],
        winnerCount: 5,
      });
      expect(result.success).toBe(true);
    });

    it("rejects name too long", () => {
      const result = createGiveawayPresetSchema.safeParse({
        name: "a".repeat(101),
        scopeType: "PERIOD",
        scopeReference: {},
        engagementTypes: ["REACTION"],
        winnerCount: 1,
      });
      expect(result.success).toBe(false);
    });

    it("rejects invalid engagement type", () => {
      const result = createGiveawayPresetSchema.safeParse({
        name: "Preset",
        scopeType: "PERIOD",
        scopeReference: {},
        engagementTypes: ["INVALID"],
        winnerCount: 1,
      });
      expect(result.success).toBe(false);
    });
  });
});
