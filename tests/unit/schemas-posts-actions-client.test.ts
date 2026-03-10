/**
 * Unit tests for client-side post action schemas (reschedule modals).
 * Tests app/lib/validation/schemas/posts-actions.client.schemas.ts
 */

import { describe, it, expect } from "vitest";

import {
  rescheduleModalClientSchema,
  rescheduleLongformModalClientSchema,
} from "~/lib/validation/schemas/posts-actions.client.schemas";

describe("posts-actions.client.schemas", () => {
  describe("rescheduleModalClientSchema", () => {
    it("parses valid future date and optional queueTypeId", () => {
      const future = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const result = rescheduleModalClientSchema.parse({
        scheduledFor: future,
        queueTypeId: "qt-1",
      });
      expect(result.scheduledFor).toEqual(future);
      expect(result.queueTypeId).toBe("qt-1");
    });

    it("rejects when scheduledFor is in the past (refine)", () => {
      const past = new Date(Date.now() - 60 * 1000);
      const parsed = rescheduleModalClientSchema.safeParse({
        scheduledFor: past,
      });
      expect(parsed.success).toBe(false);
      if (!parsed.success) {
        const scheduledForError = parsed.error.issues.find(
          (i) => i.path.join(".") === "scheduledFor"
        );
        expect(scheduledForError).toBeDefined();
        expect(scheduledForError?.message).toContain("past");
      }
    });
  });

  describe("rescheduleLongformModalClientSchema", () => {
    it("parses valid future date", () => {
      const future = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const result = rescheduleLongformModalClientSchema.parse({
        scheduledFor: future,
      });
      expect(result.scheduledFor).toEqual(future);
    });

    it("rejects when scheduledFor is in the past (refine)", () => {
      const past = new Date(Date.now() - 60 * 1000);
      const parsed = rescheduleLongformModalClientSchema.safeParse({
        scheduledFor: past,
      });
      expect(parsed.success).toBe(false);
      if (!parsed.success) {
        const scheduledForError = parsed.error.issues.find(
          (i) => i.path.join(".") === "scheduledFor"
        );
        expect(scheduledForError).toBeDefined();
        expect(scheduledForError?.message).toContain("past");
      }
    });
  });
});
