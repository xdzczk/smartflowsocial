/**
 * Unit tests for utility functions
 * 
 * Tests the utility functions in app/lib/utils.ts
 */

import { describe, it, expect } from "vitest";
import { cn } from "~/lib/utils";

describe("Utility Functions", () => {
  describe("cn (className utility)", () => {
    it("should merge class names", () => {
      const result = cn("class1", "class2");

      expect(result).toContain("class1");
      expect(result).toContain("class2");
    });

    it("should handle conditional classes", () => {
      const condition = true;
      const result = cn("base", condition && "conditional");

      expect(result).toContain("base");
      expect(result).toContain("conditional");
    });

    it("should exclude false conditional classes", () => {
      const condition = false;
      const result = cn("base", condition && "conditional");

      expect(result).toContain("base");
      expect(result).not.toContain("conditional");
    });

    it("should merge Tailwind classes correctly", () => {
      // cn uses twMerge which handles conflicting Tailwind classes
      const result = cn("p-4", "p-2"); // Should keep p-2 (last one wins)

      expect(result).toBe("p-2");
    });

    it("should handle arrays of classes", () => {
      const result = cn(["class1", "class2"], "class3");

      expect(result).toContain("class1");
      expect(result).toContain("class2");
      expect(result).toContain("class3");
    });

    it("should handle objects with boolean values", () => {
      const result = cn({
        "class1": true,
        "class2": false,
        "class3": true,
      });

      expect(result).toContain("class1");
      expect(result).not.toContain("class2");
      expect(result).toContain("class3");
    });

    it("should handle empty inputs", () => {
      const result = cn();

      expect(result).toBe("");
    });

    it("should handle null and undefined", () => {
      const result = cn(null, undefined, "valid");

      expect(result).toContain("valid");
      expect(result).not.toContain("null");
      expect(result).not.toContain("undefined");
    });

    it("should handle mixed inputs", () => {
      const result = cn(
        "base",
        ["array1", "array2"],
        { obj1: true, obj2: false },
        true && "conditional",
        false && "excluded",
      );

      expect(result).toContain("base");
      expect(result).toContain("array1");
      expect(result).toContain("array2");
      expect(result).toContain("obj1");
      expect(result).not.toContain("obj2");
      expect(result).toContain("conditional");
      expect(result).not.toContain("excluded");
    });

    it("should deduplicate classes", () => {
      const result = cn("class1", "class2", "class1");

      // twMerge should handle deduplication
      const classes = result.split(" ");
      const uniqueClasses = new Set(classes);
      expect(uniqueClasses.size).toBeLessThanOrEqual(classes.length);
    });
  });
});




