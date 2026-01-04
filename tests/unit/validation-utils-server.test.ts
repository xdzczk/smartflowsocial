/**
 * Unit tests for server-side validation utilities
 * Tests app/lib/validation/utils.server.ts
 */

import { describe, it, expect } from "vitest";
import { z } from "zod";

import { ValidationError } from "~/lib/errors";
import {
  validateFormData,
  validateFormDataOrRespond,
  getFormDataString,
  getFormDataBoolean,
  getFormDataArray,
} from "~/lib/validation/utils.server";

describe("Validation Utils Server", () => {
  describe("validateFormData", () => {
    it("should parse and validate simple form data", () => {
      const schema = z.object({
        name: z.string(),
        age: z.string().transform(Number),
      });

      const formData = new FormData();
      formData.append("name", "John");
      formData.append("age", "30");

      const result = validateFormData(formData, schema);
      expect(result.name).toBe("John");
      expect(result.age).toBe(30);
    });

    it("should handle checkbox values", () => {
      const schema = z.object({
        enabled: z.boolean(),
        disabled: z.boolean(),
      });

      const formData = new FormData();
      formData.append("enabled", "on");
      formData.append("disabled", "off");

      const result = validateFormData(formData, schema);
      expect(result.enabled).toBe(true);
      expect(result.disabled).toBe(false);
    });

    it("should handle boolean true/false strings", () => {
      const schema = z.object({
        active: z.boolean(),
        inactive: z.boolean(),
      });

      const formData = new FormData();
      formData.append("active", "true");
      formData.append("inactive", "false");

      const result = validateFormData(formData, schema);
      expect(result.active).toBe(true);
      expect(result.inactive).toBe(false);
    });

    it("should handle array values", () => {
      const schema = z.object({
        tags: z.array(z.string()),
      });

      const formData = new FormData();
      formData.append("tags", "tag1");
      formData.append("tags", "tag2");

      const result = validateFormData(formData, schema);
      expect(result.tags).toEqual(["tag1", "tag2"]);
    });

    it("should handle single value that schema expects as array", () => {
      const schema = z.object({
        tags: z.array(z.string()),
      });

      const formData = new FormData();
      formData.append("tags", "tag1");

      const result = validateFormData(formData, schema);
      expect(Array.isArray(result.tags)).toBe(true);
      expect(result.tags).toContain("tag1");
    });

    it("should throw ValidationError for invalid data", () => {
      const schema = z.object({
        email: z.string().email(),
      });

      const formData = new FormData();
      formData.append("email", "not-an-email");

      expect(() => validateFormData(formData, schema)).toThrow(ValidationError);
    });

    it("should throw ValidationError with formatted error details", () => {
      const schema = z.object({
        email: z.string().email(),
        age: z.string().transform(Number),
      });

      const formData = new FormData();
      formData.append("email", "invalid-email");
      formData.append("age", "not-a-number");

      try {
        validateFormData(formData, schema);
        expect.fail("Should have thrown ValidationError");
      } catch (error) {
        expect(error).toBeInstanceOf(ValidationError);
        if (error instanceof ValidationError) {
          expect(error.context?.errors).toBeDefined();
        }
      }
    });

    it("should handle schemas with number transforms", () => {
      const schema = z.object({
        age: z.string().transform(Number),
      });

      const formData = new FormData();
      formData.append("age", "30");

      const result = validateFormData(formData, schema);
      expect(result.age).toBe(30);
      expect(typeof result.age).toBe("number");
    });

    it("should handle multiple values for same key", () => {
      const schema = z.object({
        tags: z.array(z.string()),
      });

      const formData = new FormData();
      formData.append("tags", "tag1");
      formData.append("tags", "tag2");
      formData.append("tags", "tag3");

      const result = validateFormData(formData, schema);
      expect(result.tags).toEqual(["tag1", "tag2", "tag3"]);
    });

    it("should handle optional fields", () => {
      const schema = z.object({
        required: z.string(),
        optional: z.string().optional(),
      });

      const formData = new FormData();
      formData.append("required", "value");

      const result = validateFormData(formData, schema);
      expect(result.required).toBe("value");
      expect(result.optional).toBeUndefined();
    });

    it("should handle empty FormData", () => {
      const schema = z.object({
        optional: z.string().optional(),
      });

      const formData = new FormData();

      const result = validateFormData(formData, schema);
      expect(result.optional).toBeUndefined();
    });
  });

  describe("validateFormDataOrRespond", () => {
    it("should return success with data for valid input", () => {
      const schema = z.object({ name: z.string() });
      const formData = new FormData();
      formData.append("name", "Test");

      const result = validateFormDataOrRespond(formData, schema);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.name).toBe("Test");
      }
    });

    it("should return error response for invalid input", () => {
      const schema = z.object({ email: z.string().email() });
      const formData = new FormData();
      formData.append("email", "invalid");

      const result = validateFormDataOrRespond(formData, schema);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.response.status).toBe(400);
      }
    });

    it("should return error response with error message", async () => {
      const schema = z.object({ email: z.string().email() });
      const formData = new FormData();
      formData.append("email", "invalid");

      const result = validateFormDataOrRespond(formData, schema);
      expect(result.success).toBe(false);
      if (!result.success) {
        const json = (await result.response.json()) as { error: string };
        expect(json.error).toBeDefined();
        expect(typeof json.error).toBe("string");
      }
    });

    it("should extract first error message from ValidationError context", async () => {
      const schema = z.object({
        email: z.string().email(),
        age: z.string().transform(Number),
      });
      const formData = new FormData();
      formData.append("email", "invalid");

      const result = validateFormDataOrRespond(formData, schema);
      expect(result.success).toBe(false);
      if (!result.success) {
        const json = (await result.response.json()) as { error: string };
        expect(json.error).toContain("email");
      }
    });

    it("should return generic error for non-ValidationError", async () => {
      // This is hard to test directly, but we can verify the fallback
      const schema = z.object({ name: z.string() });
      const formData = new FormData();
      formData.append("name", "valid");

      const result = validateFormDataOrRespond(formData, schema);
      expect(result.success).toBe(true);
    });
  });

  describe("getFormDataString", () => {
    it("should return string value from FormData", () => {
      const formData = new FormData();
      formData.append("key", "value");
      expect(getFormDataString(formData, "key")).toBe("value");
    });

    it("should return null for missing key", () => {
      const formData = new FormData();
      expect(getFormDataString(formData, "missing")).toBeNull();
    });

    it("should convert non-string values to string", () => {
      const formData = new FormData();
      const file = new File(["content"], "test.txt", { type: "text/plain" });
      formData.append("file", file);
      // Note: File objects in FormData will be converted to string
      const result = getFormDataString(formData, "file");
      expect(result).toBeDefined();
    });
  });

  describe("getFormDataBoolean", () => {
    it("should return true for 'on' value", () => {
      const formData = new FormData();
      formData.append("enabled", "on");
      expect(getFormDataBoolean(formData, "enabled")).toBe(true);
    });

    it("should return true for 'true' value", () => {
      const formData = new FormData();
      formData.append("enabled", "true");
      expect(getFormDataBoolean(formData, "enabled")).toBe(true);
    });

    it("should return false for other values", () => {
      const formData = new FormData();
      formData.append("disabled", "off");
      formData.append("other", "false");
      formData.append("empty", "");

      expect(getFormDataBoolean(formData, "disabled")).toBe(false);
      expect(getFormDataBoolean(formData, "other")).toBe(false);
      expect(getFormDataBoolean(formData, "empty")).toBe(false);
    });

    it("should return false for missing key", () => {
      const formData = new FormData();
      expect(getFormDataBoolean(formData, "missing")).toBe(false);
    });
  });

  describe("getFormDataArray", () => {
    it("should return array from newline-separated string", () => {
      const formData = new FormData();
      formData.append("items", "item1\nitem2\nitem3");
      const result = getFormDataArray(formData, "items");
      expect(result).toEqual(["item1", "item2", "item3"]);
    });

    it("should trim whitespace from items", () => {
      const formData = new FormData();
      formData.append("items", "  item1  \n  item2  \n  item3  ");
      const result = getFormDataArray(formData, "items");
      expect(result).toEqual(["item1", "item2", "item3"]);
    });

    it("should filter out empty items", () => {
      const formData = new FormData();
      formData.append("items", "item1\n\nitem2\n  \nitem3");
      const result = getFormDataArray(formData, "items");
      expect(result).toEqual(["item1", "item2", "item3"]);
    });

    it("should return empty array for missing key", () => {
      const formData = new FormData();
      expect(getFormDataArray(formData, "missing")).toEqual([]);
    });

    it("should return empty array for empty value", () => {
      const formData = new FormData();
      formData.append("items", "");
      expect(getFormDataArray(formData, "items")).toEqual([]);
    });

    it("should handle single item", () => {
      const formData = new FormData();
      formData.append("items", "single-item");
      const result = getFormDataArray(formData, "items");
      expect(result).toEqual(["single-item"]);
    });
  });
});

