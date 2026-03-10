/**
 * Unit tests for search client schemas
 * Tests app/lib/validation/schemas/search.client.schemas.ts
 */

import { describe, it, expect } from "vitest";

import { searchFormClientSchema } from "~/lib/validation/schemas/search.client.schemas";

describe("search.client.schemas", () => {
  describe("searchFormClientSchema", () => {
    it("accepts 64-char hex event ID", () => {
      const hex = "a".repeat(64);
      const result = searchFormClientSchema.parse({ eventInput: hex });
      expect(result.eventInput).toBe(hex);
    });

    it("accepts note1 prefix", () => {
      const result = searchFormClientSchema.parse({ eventInput: "note1abc" });
      expect(result.eventInput).toBe("note1abc");
    });

    it("accepts nevent1 prefix", () => {
      const result = searchFormClientSchema.parse({ eventInput: "nevent1xyz" });
      expect(result.eventInput).toBe("nevent1xyz");
    });

    it("trims whitespace", () => {
      const result = searchFormClientSchema.parse({
        eventInput: "  " + "a".repeat(64) + "  ",
      });
      expect(result.eventInput).toBe("a".repeat(64));
    });

    it("rejects empty string", () => {
      expect(() => searchFormClientSchema.parse({ eventInput: "" })).toThrow();
    });

    it("rejects invalid format (short hex)", () => {
      expect(() =>
        searchFormClientSchema.parse({ eventInput: "abc" })
      ).toThrow();
    });

    it("rejects invalid format (random string)", () => {
      expect(() =>
        searchFormClientSchema.parse({ eventInput: "not-hex-or-bech32" })
      ).toThrow();
    });
  });
});
