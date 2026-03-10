/**
 * Unit tests for job payload schemas
 * Tests app/lib/validation/schemas/job-payloads.schemas.ts
 */

import { describe, it, expect } from "vitest";
import { z } from "zod";

import {
  postJobDataSchema,
  longFormPostJobDataSchema,
  validatePostJobData,
  validateLongFormPostJobData,
  safeValidatePostJobData,
  safeValidateLongFormPostJobData,
} from "~/lib/validation/schemas/job-payloads.schemas";

const validSignedEvent = {
  id: "ev-id",
  pubkey: "pk",
  created_at: 1234567890,
  kind: 1,
  tags: [],
  content: "",
  sig: "sig",
};

describe("Job Payload Schemas", () => {
  describe("postJobDataSchema", () => {
    it("accepts valid payload", () => {
      const payload = {
        postId: "post-1",
        userId: "user-1",
        signedEvent: validSignedEvent,
      };
      const result = postJobDataSchema.safeParse(payload);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.postId).toBe("post-1");
        expect(result.data.userId).toBe("user-1");
      }
    });

    it("accepts optional correlationId and schemaVersion", () => {
      const payload = {
        postId: "p",
        userId: "u",
        signedEvent: validSignedEvent,
        correlationId: "corr-1",
        schemaVersion: "1.0",
      };
      const result = postJobDataSchema.safeParse(payload);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.correlationId).toBe("corr-1");
        expect(result.data.schemaVersion).toBe("1.0");
      }
    });

    it("rejects empty postId", () => {
      const result = postJobDataSchema.safeParse({
        postId: "",
        userId: "u",
        signedEvent: validSignedEvent,
      });
      expect(result.success).toBe(false);
    });

    it("rejects missing postId", () => {
      const result = postJobDataSchema.safeParse({
        userId: "u",
        signedEvent: validSignedEvent,
      });
      expect(result.success).toBe(false);
    });

    it("rejects missing userId", () => {
      const result = postJobDataSchema.safeParse({
        postId: "p",
        signedEvent: validSignedEvent,
      });
      expect(result.success).toBe(false);
    });

    it("rejects invalid signedEvent shape", () => {
      const result = postJobDataSchema.safeParse({
        postId: "p",
        userId: "u",
        signedEvent: { id: "ev", pubkey: "pk" },
      });
      expect(result.success).toBe(false);
    });
  });

  describe("longFormPostJobDataSchema", () => {
    it("accepts valid payload", () => {
      const payload = {
        postId: "lf-1",
        userId: "user-1",
        signedEvent: validSignedEvent,
      };
      const result = longFormPostJobDataSchema.safeParse(payload);
      expect(result.success).toBe(true);
    });

    it("rejects empty postId", () => {
      const result = longFormPostJobDataSchema.safeParse({
        postId: "",
        userId: "u",
        signedEvent: validSignedEvent,
      });
      expect(result.success).toBe(false);
    });
  });

  describe("validatePostJobData", () => {
    it("returns validated data for valid payload", () => {
      const payload = {
        postId: "p",
        userId: "u",
        signedEvent: validSignedEvent,
      };
      const data = validatePostJobData(payload);
      expect(data.postId).toBe("p");
      expect(data.userId).toBe("u");
    });

    it("throws ZodError for invalid payload", () => {
      expect(() => validatePostJobData({ postId: "p", userId: "" })).toThrow(
        z.ZodError
      );
    });
  });

  describe("safeValidatePostJobData", () => {
    it("returns success true and data for valid payload", () => {
      const payload = {
        postId: "p",
        userId: "u",
        signedEvent: validSignedEvent,
      };
      const result = safeValidatePostJobData(payload);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.postId).toBe("p");
      }
    });

    it("returns success false and error for invalid payload", () => {
      const result = safeValidatePostJobData({});
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(z.ZodError);
      }
    });
  });

  describe("validateLongFormPostJobData", () => {
    it("returns validated data for valid payload", () => {
      const payload = {
        postId: "lf",
        userId: "u",
        signedEvent: validSignedEvent,
      };
      const data = validateLongFormPostJobData(payload);
      expect(data.postId).toBe("lf");
    });

    it("throws ZodError for invalid payload", () => {
      expect(() => validateLongFormPostJobData(null)).toThrow(z.ZodError);
    });
  });

  describe("safeValidateLongFormPostJobData", () => {
    it("returns success true for valid payload", () => {
      const result = safeValidateLongFormPostJobData({
        postId: "lf",
        userId: "u",
        signedEvent: validSignedEvent,
      });
      expect(result.success).toBe(true);
    });

    it("returns success false for invalid payload", () => {
      const result = safeValidateLongFormPostJobData({ postId: "" });
      expect(result.success).toBe(false);
    });
  });
});
