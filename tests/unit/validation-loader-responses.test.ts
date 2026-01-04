/**
 * Unit tests for loader response validation utilities
 * Tests app/lib/validation/loader-responses.server.ts
 */

import { describe, it, expect } from "vitest";
import { z } from "zod";

import { ValidationError } from "~/lib/errors";
import {
  validateLoaderResponse,
  safeValidateLoaderResponse,
} from "~/lib/validation/loader-responses.server";

describe("Loader Response Validation", () => {
  describe("validateLoaderResponse", () => {
    it("should return validated data for valid input", () => {
      const schema = z.object({
        user: z.object({
          id: z.string(),
          name: z.string(),
        }),
        posts: z.array(z.string()),
      });

      const data = {
        user: { id: "1", name: "John" },
        posts: ["post1", "post2"],
      };

      const result = validateLoaderResponse(data, schema);

      expect(result.user.id).toBe("1");
      expect(result.user.name).toBe("John");
      expect(result.posts).toEqual(["post1", "post2"]);
    });

    it("should throw ValidationError for invalid input", () => {
      const schema = z.object({
        user: z.object({
          id: z.string(),
          name: z.string(),
        }),
      });

      const data = {
        user: { id: "1" }, // Missing name
      };

      expect(() => validateLoaderResponse(data, schema)).toThrow(
        ValidationError,
      );
    });

    it("should throw ValidationError with formatted error details", () => {
      const schema = z.object({
        email: z.string().email(),
        age: z.number().min(18),
      });

      const data = {
        email: "invalid-email",
        age: 15,
      };

      try {
        validateLoaderResponse(data, schema);
        expect.fail("Should have thrown ValidationError");
      } catch (error) {
        expect(error).toBeInstanceOf(ValidationError);
        if (error instanceof ValidationError) {
          expect(error.message).toBe("Loader response validation failed");
          expect(error.context?.errors).toBeDefined();
          const errors = error.context?.errors as Array<{
            path: string;
            message: string;
          }>;
          expect(Array.isArray(errors)).toBe(true);
          expect(errors.length).toBeGreaterThan(0);
        }
      }
    });

    it("should handle nested objects", () => {
      const schema = z.object({
        user: z.object({
          profile: z.object({
            bio: z.string(),
          }),
        }),
      });

      const data = {
        user: {
          profile: {
            bio: "Test bio",
          },
        },
      };

      const result = validateLoaderResponse(data, schema);
      expect(result.user.profile.bio).toBe("Test bio");
    });

    it("should handle arrays", () => {
      const schema = z.object({
        items: z.array(
          z.object({
            id: z.string(),
            value: z.number(),
          }),
        ),
      });

      const data = {
        items: [
          { id: "1", value: 10 },
          { id: "2", value: 20 },
        ],
      };

      const result = validateLoaderResponse(data, schema);
      expect(result.items).toHaveLength(2);
      expect(result.items[0]?.id).toBe("1");
      expect(result.items[1]?.value).toBe(20);
    });

    it("should handle optional fields", () => {
      const schema = z.object({
        required: z.string(),
        optional: z.string().optional(),
      });

      const data = {
        required: "value",
      };

      const result = validateLoaderResponse(data, schema);
      expect(result.required).toBe("value");
      expect(result.optional).toBeUndefined();
    });

    it("should handle nullable fields", () => {
      const schema = z.object({
        value: z.string().nullable(),
      });

      const data1 = { value: "test" };
      const result1 = validateLoaderResponse(data1, schema);
      expect(result1.value).toBe("test");

      const data2 = { value: null };
      const result2 = validateLoaderResponse(data2, schema);
      expect(result2.value).toBeNull();
    });

    it("should re-throw non-ZodError exceptions", () => {
      // Create a schema that will throw a non-ZodError
      const throwingSchema = {
        parse: () => {
          throw new Error("Custom error");
        },
      } as unknown as z.ZodTypeAny;

      expect(() => validateLoaderResponse({ value: "test" }, throwingSchema)).toThrow(
        "Custom error",
      );
    });
  });

  describe("safeValidateLoaderResponse", () => {
    it("should return validated data for valid input", () => {
      const schema = z.object({
        user: z.object({
          id: z.string(),
          name: z.string(),
        }),
      });

      const data = {
        user: { id: "1", name: "John" },
      };

      const result = safeValidateLoaderResponse(data, schema);

      expect(result).not.toBeNull();
      if (result) {
        expect(result.user.id).toBe("1");
        expect(result.user.name).toBe("John");
      }
    });

    it("should return null for invalid input", () => {
      const schema = z.object({
        user: z.object({
          id: z.string(),
          name: z.string(),
        }),
      });

      const data = {
        user: { id: "1" }, // Missing name
      };

      const result = safeValidateLoaderResponse(data, schema);

      expect(result).toBeNull();
    });

    it("should not throw for invalid input", () => {
      const schema = z.object({
        email: z.string().email(),
      });

      const data = {
        email: "invalid-email",
      };

      expect(() => safeValidateLoaderResponse(data, schema)).not.toThrow();
      const result = safeValidateLoaderResponse(data, schema);
      expect(result).toBeNull();
    });

    it("should handle nested validation failures gracefully", () => {
      const schema = z.object({
        user: z.object({
          profile: z.object({
            bio: z.string().min(10),
          }),
        }),
      });

      const data = {
        user: {
          profile: {
            bio: "short", // Too short
          },
        },
      };

      const result = safeValidateLoaderResponse(data, schema);
      expect(result).toBeNull();
    });

    it("should handle array validation failures gracefully", () => {
      const schema = z.object({
        items: z.array(z.string().min(3)),
      });

      const data = {
        items: ["ab", "cd"], // Too short
      };

      const result = safeValidateLoaderResponse(data, schema);
      expect(result).toBeNull();
    });

    it("should return null for completely invalid data", () => {
      const schema = z.object({
        value: z.string(),
      });

      const data = null;

      const result = safeValidateLoaderResponse(data, schema);
      expect(result).toBeNull();
    });

    it("should return null for wrong data type", () => {
      const schema = z.object({
        value: z.string(),
      });

      const data = 123;

      const result = safeValidateLoaderResponse(data, schema);
      expect(result).toBeNull();
    });
  });
});

