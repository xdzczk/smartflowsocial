/**
 * Unit tests for post filtering utilities
 * Tests app/features/posts/services/post-filtering.server.ts
 */

import { describe, it, expect } from "vitest";

import {
  filterPostsByQueueType,
  filterPostsArraysByQueueType,
} from "~/features/posts/services/post-filtering.server";

describe("Post Filtering Utilities", () => {
  describe("filterPostsByQueueType", () => {
    it("should return all posts when queueType is 'all'", () => {
      const posts = [
        { id: "1", queueType: { name: "queue1" } },
        { id: "2", queueType: { name: "queue2" } },
        { id: "3", queueType: null },
      ];

      const result = filterPostsByQueueType(posts, "all");

      expect(result).toEqual(posts);
      expect(result).toHaveLength(3);
    });

    it("should filter posts by queue type name", () => {
      const posts = [
        { id: "1", queueType: { name: "queue1" } },
        { id: "2", queueType: { name: "queue2" } },
        { id: "3", queueType: { name: "queue1" } },
        { id: "4", queueType: null },
      ];

      const result = filterPostsByQueueType(posts, "queue1");

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe("1");
      expect(result[1].id).toBe("3");
    });

    it("should return empty array when no posts match", () => {
      const posts = [
        { id: "1", queueType: { name: "queue1" } },
        { id: "2", queueType: { name: "queue2" } },
      ];

      const result = filterPostsByQueueType(posts, "queue3");

      expect(result).toEqual([]);
    });

    it("should handle posts with null queueType", () => {
      const posts = [
        { id: "1", queueType: { name: "queue1" } },
        { id: "2", queueType: null },
        { id: "3", queueType: { name: "queue2" } },
      ];

      const result = filterPostsByQueueType(posts, "queue1");

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("1");
    });

    it("should handle posts with queueType.name as null", () => {
      const posts = [
        { id: "1", queueType: { name: "queue1" } },
        { id: "2", queueType: { name: null } },
        { id: "3", queueType: { name: "queue2" } },
      ];

      const result = filterPostsByQueueType(posts, "queue1");

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("1");
    });

    it("should handle empty array", () => {
      const result = filterPostsByQueueType([], "queue1");

      expect(result).toEqual([]);
    });
  });

  describe("filterPostsArraysByQueueType", () => {
    it("should filter all post arrays by queue type", () => {
      const config = {
        scheduledPosts: [
          { id: "1", queueType: { name: "queue1" } },
          { id: "2", queueType: { name: "queue2" } },
        ],
        scheduledLongFormPosts: [
          { id: "3", queueType: { name: "queue1" } },
          { id: "4", queueType: { name: "queue3" } },
        ],
        pastPosts: [{ id: "5", queueType: { name: "queue1" } }],
        pastLongFormPosts: [{ id: "6", queueType: { name: "queue2" } }],
        queueType: "queue1",
      };

      const result = filterPostsArraysByQueueType(config);

      expect(result.scheduledPosts).toHaveLength(1);
      expect(result.scheduledPosts[0].id).toBe("1");
      expect(result.scheduledLongFormPosts).toHaveLength(1);
      expect(result.scheduledLongFormPosts[0].id).toBe("3");
      expect(result.pastPosts).toHaveLength(1);
      expect(result.pastPosts[0].id).toBe("5");
      expect(result.pastLongFormPosts).toHaveLength(0);
    });

    it("should return all posts when queueType is 'all'", () => {
      const config = {
        scheduledPosts: [
          { id: "1", queueType: { name: "queue1" } },
          { id: "2", queueType: { name: "queue2" } },
        ],
        scheduledLongFormPosts: [{ id: "3", queueType: { name: "queue1" } }],
        pastPosts: [],
        pastLongFormPosts: [],
        queueType: "all",
      };

      const result = filterPostsArraysByQueueType(config);

      expect(result.scheduledPosts).toHaveLength(2);
      expect(result.scheduledLongFormPosts).toHaveLength(1);
      expect(result.pastPosts).toHaveLength(0);
      expect(result.pastLongFormPosts).toHaveLength(0);
    });

    it("should handle undefined arrays", () => {
      const config = {
        scheduledPosts: undefined,
        scheduledLongFormPosts: undefined,
        pastPosts: undefined,
        pastLongFormPosts: undefined,
        queueType: "queue1",
      };

      const result = filterPostsArraysByQueueType(config);

      expect(result.scheduledPosts).toEqual([]);
      expect(result.scheduledLongFormPosts).toEqual([]);
      expect(result.pastPosts).toEqual([]);
      expect(result.pastLongFormPosts).toEqual([]);
    });

    it("should handle empty arrays", () => {
      const config = {
        scheduledPosts: [],
        scheduledLongFormPosts: [],
        pastPosts: [],
        pastLongFormPosts: [],
        queueType: "queue1",
      };

      const result = filterPostsArraysByQueueType(config);

      expect(result.scheduledPosts).toEqual([]);
      expect(result.scheduledLongFormPosts).toEqual([]);
      expect(result.pastPosts).toEqual([]);
      expect(result.pastLongFormPosts).toEqual([]);
    });
  });
});


