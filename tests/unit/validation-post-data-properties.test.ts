/**
 * Unit tests for post data properties utilities
 * Tests app/lib/validation/post-data-properties.ts
 */

import { describe, it, expect } from "vitest";

import type { PostData } from "~/features/posts/types";
import {
  getPostDataProperty,
  comparePostDataByProperty,
} from "~/lib/validation/post-data-properties";

describe("Post Data Properties", () => {
  describe("getPostDataProperty", () => {
    it("should return id property", () => {
      const post: PostData = {
        id: "post-1",
      } as unknown as PostData;

      const result = getPostDataProperty(post, "id");

      expect(result).toBe("post-1");
    });

    it("should return caption property", () => {
      const post: PostData = {
        id: "post-1",
        caption: "Test caption",
      } as unknown as PostData;

      const result = getPostDataProperty(post, "caption");

      expect(result).toBe("Test caption");
    });

    it("should return undefined for null caption", () => {
      const post: PostData = {
        id: "post-1",
        caption: null,
      } as unknown as PostData;

      const result = getPostDataProperty(post, "caption");

      expect(result).toBeUndefined();
    });

    it("should return Date for scheduledFor when Date", () => {
      const date = new Date("2024-01-01T12:00:00Z");
      const post: PostData = {
        id: "post-1",
        scheduledFor: date,
      } as unknown as PostData;

      const result = getPostDataProperty(post, "scheduledFor");

      expect(result).toBeInstanceOf(Date);
      expect(result).toBe(date);
    });

    it("should convert string scheduledFor to Date", () => {
      const post: PostData = {
        id: "post-1",
        scheduledFor: "2024-01-01T12:00:00Z",
      } as unknown as PostData;

      const result = getPostDataProperty(post, "scheduledFor");

      expect(result).toBeInstanceOf(Date);
      expect((result as Date).getTime()).toBe(
        new Date("2024-01-01T12:00:00Z").getTime(),
      );
    });

    it("should return undefined for null scheduledFor", () => {
      const post: PostData = {
        id: "post-1",
        scheduledFor: null,
      } as unknown as PostData;

      const result = getPostDataProperty(post, "scheduledFor");

      expect(result).toBeUndefined();
    });

    it("should handle postedAt Date", () => {
      const date = new Date("2024-01-01T12:00:00Z");
      const post: PostData = {
        id: "post-1",
        postedAt: date,
      } as unknown as PostData;

      const result = getPostDataProperty(post, "postedAt");

      expect(result).toBeInstanceOf(Date);
      expect(result).toBe(date);
    });

    it("should convert string postedAt to Date", () => {
      const post: PostData = {
        id: "post-1",
        postedAt: "2024-01-01T12:00:00Z",
      } as unknown as PostData;

      const result = getPostDataProperty(post, "postedAt");

      expect(result).toBeInstanceOf(Date);
    });

    it("should handle createdAt Date", () => {
      const date = new Date("2024-01-01T12:00:00Z");
      const post: PostData = {
        id: "post-1",
        createdAt: date,
      } as unknown as PostData;

      const result = getPostDataProperty(post, "createdAt");

      expect(result).toBeInstanceOf(Date);
    });

    it("should handle updatedAt Date", () => {
      const date = new Date("2024-01-01T12:00:00Z");
      const post: PostData = {
        id: "post-1",
        updatedAt: date,
      } as unknown as PostData;

      const result = getPostDataProperty(post, "updatedAt");

      expect(result).toBeInstanceOf(Date);
    });

    it("should return undefined for unknown property", () => {
      const post: PostData = {
        id: "post-1",
      } as unknown as PostData;

      const result = getPostDataProperty(post, "unknownProperty");

      expect(result).toBeUndefined();
    });

    it("should return value for other string properties", () => {
      const post: PostData = {
        id: "post-1",
        customProperty: "custom value",
      } as unknown as PostData;

      const result = getPostDataProperty(post, "customProperty");

      expect(result).toBe("custom value");
    });

    it("should return value for number properties", () => {
      const post: PostData = {
        id: "post-1",
        customNumber: 42,
      } as unknown as PostData;

      const result = getPostDataProperty(post, "customNumber");

      expect(result).toBe(42);
    });
  });

  describe("comparePostDataByProperty", () => {
    it("should compare by id ascending", () => {
      const a: PostData = { id: "post-1" } as unknown as PostData;
      const b: PostData = { id: "post-2" } as unknown as PostData;

      const result = comparePostDataByProperty(a, b, "id", "asc");

      expect(result).toBeLessThan(0);
    });

    it("should compare by id descending", () => {
      const a: PostData = { id: "post-1" } as unknown as PostData;
      const b: PostData = { id: "post-2" } as unknown as PostData;

      const result = comparePostDataByProperty(a, b, "id", "desc");

      expect(result).toBeGreaterThan(0);
    });

    it("should return 0 when values are equal", () => {
      const a: PostData = { id: "post-1" } as unknown as PostData;
      const b: PostData = { id: "post-1" } as unknown as PostData;

      const result = comparePostDataByProperty(a, b, "id", "asc");

      expect(result).toBe(0);
    });

    it("should handle undefined values in ascending order", () => {
      const a: PostData = { id: "post-1" } as unknown as PostData;
      const b: PostData = { id: "post-2", caption: "test" } as unknown as PostData;

      const result = comparePostDataByProperty(a, b, "caption", "asc");

      expect(result).toBeLessThan(0); // undefined comes first in asc
    });

    it("should handle undefined values in descending order", () => {
      const a: PostData = { id: "post-1" } as unknown as PostData;
      const b: PostData = { id: "post-2", caption: "test" } as unknown as PostData;

      const result = comparePostDataByProperty(a, b, "caption", "desc");

      expect(result).toBeGreaterThan(0); // undefined comes last in desc
    });

    it("should compare Date values", () => {
      const a: PostData = {
        id: "post-1",
        scheduledFor: new Date("2024-01-01T12:00:00Z"),
      } as unknown as PostData;
      const b: PostData = {
        id: "post-2",
        scheduledFor: new Date("2024-01-02T12:00:00Z"),
      } as unknown as PostData;

      const result = comparePostDataByProperty(a, b, "scheduledFor", "asc");

      expect(result).toBeLessThan(0);
    });

    it("should compare string values", () => {
      const a: PostData = { id: "post-1", caption: "A" } as unknown as PostData;
      const b: PostData = { id: "post-2", caption: "B" } as unknown as PostData;

      const result = comparePostDataByProperty(a, b, "caption", "asc");

      expect(result).toBeLessThan(0);
    });

    it("should compare number values", () => {
      const a: PostData = { id: "post-1", customNumber: 10 } as unknown as PostData;
      const b: PostData = { id: "post-2", customNumber: 20 } as unknown as PostData;

      const result = comparePostDataByProperty(a, b, "customNumber", "asc");

      expect(result).toBeLessThan(0);
    });
  });
});

