/**
 * Unit tests for post stats validation utilities
 * Tests app/lib/validation/post-stats.ts
 */

import { describe, it, expect } from "vitest";

import {
  isPostStats,
  getPostStats,
  getPostStatsValue,
} from "~/lib/validation/post-stats";

describe("Post Stats Validation", () => {
  describe("isPostStats", () => {
    it("should return false for null", () => {
      expect(isPostStats(null)).toBe(false);
    });

    it("should return false for undefined", () => {
      expect(isPostStats(undefined)).toBe(false);
    });

    it("should return false for non-object values", () => {
      expect(isPostStats("string")).toBe(false);
      expect(isPostStats(123)).toBe(false);
      expect(isPostStats([])).toBe(false);
    });

    it("should return true for valid PostStats", () => {
      const stats = {
        likes: 10,
        replies: 5,
        mentions: 2,
        reposts: 3,
        zaps: 1,
        satszapped: 1000,
      };

      expect(isPostStats(stats)).toBe(true);
    });

    it("should return false when missing required fields", () => {
      const invalidStats = {
        likes: 10,
        replies: 5,
        // Missing other fields
      };

      expect(isPostStats(invalidStats)).toBe(false);
    });

    it("should return false when fields have wrong types", () => {
      const invalidStats = {
        likes: "10", // Should be number
        replies: 5,
        mentions: 2,
        reposts: 3,
        zaps: 1,
        satszapped: 1000,
      };

      expect(isPostStats(invalidStats)).toBe(false);
    });

    it("should return false for empty object", () => {
      expect(isPostStats({})).toBe(false);
    });
  });

  describe("getPostStats", () => {
    it("should return empty stats when stats is null", () => {
      const result = getPostStats(null, "event-1");

      expect(result).toEqual({
        likes: 0,
        replies: 0,
        mentions: 0,
        reposts: 0,
        zaps: 0,
        satszapped: 0,
      });
    });

    it("should return empty stats when stats is undefined", () => {
      const result = getPostStats(undefined, "event-1");

      expect(result).toEqual({
        likes: 0,
        replies: 0,
        mentions: 0,
        reposts: 0,
        zaps: 0,
        satszapped: 0,
      });
    });

    it("should return empty stats when eventId is null", () => {
      const stats = {
        "event-1": {
          likes: 10,
          replies: 5,
          mentions: 2,
          reposts: 3,
          zaps: 1,
          satszapped: 1000,
        },
      };

      const result = getPostStats(stats, null);

      expect(result).toEqual({
        likes: 0,
        replies: 0,
        mentions: 0,
        reposts: 0,
        zaps: 0,
        satszapped: 0,
      });
    });

    it("should return empty stats when eventId is undefined", () => {
      const stats = {
        "event-1": {
          likes: 10,
          replies: 5,
          mentions: 2,
          reposts: 3,
          zaps: 1,
          satszapped: 1000,
        },
      };

      const result = getPostStats(stats, undefined);

      expect(result).toEqual({
        likes: 0,
        replies: 0,
        mentions: 0,
        reposts: 0,
        zaps: 0,
        satszapped: 0,
      });
    });

    it("should return stats for valid eventId", () => {
      const stats = {
        "event-1": {
          likes: 10,
          replies: 5,
          mentions: 2,
          reposts: 3,
          zaps: 1,
          satszapped: 1000,
        },
        "event-2": {
          likes: 20,
          replies: 10,
          mentions: 5,
          reposts: 6,
          zaps: 2,
          satszapped: 2000,
        },
      };

      const result = getPostStats(stats, "event-1");

      expect(result).toEqual({
        likes: 10,
        replies: 5,
        mentions: 2,
        reposts: 3,
        zaps: 1,
        satszapped: 1000,
      });
    });

    it("should return empty stats when eventId not found", () => {
      const stats = {
        "event-1": {
          likes: 10,
          replies: 5,
          mentions: 2,
          reposts: 3,
          zaps: 1,
          satszapped: 1000,
        },
      };

      const result = getPostStats(stats, "event-2");

      expect(result).toEqual({
        likes: 0,
        replies: 0,
        mentions: 0,
        reposts: 0,
        zaps: 0,
        satszapped: 0,
      });
    });

    it("should return empty stats when eventStats is invalid", () => {
      const stats = {
        "event-1": {
          invalid: "data",
        },
      };

      const result = getPostStats(stats, "event-1");

      expect(result).toEqual({
        likes: 0,
        replies: 0,
        mentions: 0,
        reposts: 0,
        zaps: 0,
        satszapped: 0,
      });
    });

    it("should return empty stats when stats is array", () => {
      const stats = [] as unknown as Record<string, unknown> | null | undefined;

      const result = getPostStats(stats, "event-1");

      expect(result).toEqual({
        likes: 0,
        replies: 0,
        mentions: 0,
        reposts: 0,
        zaps: 0,
        satszapped: 0,
      });
    });
  });

  describe("getPostStatsValue", () => {
    it("should return value for valid key", () => {
      const stats = {
        likes: 10,
        replies: 5,
        mentions: 2,
        reposts: 3,
        zaps: 1,
        satszapped: 1000,
      };

      expect(getPostStatsValue(stats, "likes")).toBe(10);
      expect(getPostStatsValue(stats, "replies")).toBe(5);
      expect(getPostStatsValue(stats, "zaps")).toBe(1);
      expect(getPostStatsValue(stats, "satszapped")).toBe(1000);
    });

    it("should return 0 for invalid key", () => {
      const stats = {
        likes: 10,
        replies: 5,
        mentions: 2,
        reposts: 3,
        zaps: 1,
        satszapped: 1000,
      };

      expect(getPostStatsValue(stats, "unknown")).toBe(0);
    });

    it("should return 0 when value is not a number", () => {
      const stats = {
        likes: "10" as unknown as number,
        replies: 5,
        mentions: 2,
        reposts: 3,
        zaps: 1,
        satszapped: 1000,
      };

      expect(getPostStatsValue(stats, "likes")).toBe(0);
    });
  });
});
