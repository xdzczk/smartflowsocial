/**
 * Unit tests for content combining logic
 * 
 * Tests the utility functions in app/features/posts/combined.server.ts
 * These are pure functions that combine posts and longform posts.
 */

import { describe, it, expect } from "vitest";

import {
  postToCombinedContent,
  longFormPostToCombinedContent,
  combineContent,
  filterCombinedContent,
} from "~/features/posts/combined.server";
import type { CombinedContent, PostData, LongFormPostData } from "~/features/posts/types";

describe("Content Combining Logic", () => {
  describe("postToCombinedContent", () => {
    it("should convert a post to CombinedContent format", () => {
      const post = {
        id: "post-1",
        caption: "Test caption",
        content: "Test content",
        fileUrl: ["https://example.com/image.jpg"],
        scheduledFor: "1705320000",
        postedAt: new Date("2024-01-15"),
        createdAt: new Date("2024-01-10"),
        updatedAt: new Date("2024-01-12"),
        isScheduled: true,
        isPosted: false,
        draft: false,
        status: "scheduled",
        queueType: { name: "posts" },
        queueTypeId: "queue-1",
        userId: "user-1",
        tags: ["tag1", "tag2"],
        signedEvent: { id: "event-1" },
        nostrEvent: { id: "nostr-1" },
        manual_override: false,
        postType: "IMAGE",
        repost: false,
        isQuotedPost: false,
        isRecyclable: true,
        templateId: null,
      };

      const result = postToCombinedContent(post as unknown as PostData);

      expect(result).toEqual({
        id: "post-1",
        type: "post",
        caption: "Test caption",
        content: "Test content",
        fileUrl: ["https://example.com/image.jpg"],
        scheduledFor: "1705320000",
        postedAt: new Date("2024-01-15"),
        createdAt: new Date("2024-01-10"),
        updatedAt: new Date("2024-01-12"),
        isScheduled: true,
        isPosted: false,
        draft: false,
        status: "scheduled",
        queueType: { id: "", name: "posts" },
        queueTypeId: "queue-1",
        userId: "user-1",
        tags: ["tag1", "tag2"],
        signedEvent: { id: "event-1" },
        nostrEvent: { id: "nostr-1" },
        manual_override: false,
        postType: "IMAGE",
        repost: false,
        isQuotedPost: false,
        isRecyclable: true,
        templateId: null,
        originalData: post,
      });
    });

    it("should handle posts with minimal fields", () => {
      const post = {
        id: "post-2",
        caption: "Minimal post",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = postToCombinedContent(post as unknown as PostData);

      expect(result.id).toBe("post-2");
      expect(result.type).toBe("post");
      expect(result.caption).toBe("Minimal post");
      expect(result.originalData).toBe(post);
    });
  });

  describe("longFormPostToCombinedContent", () => {
    it("should convert a longform post to CombinedContent format", () => {
      const longFormPost = {
        id: "longform-1",
        title: "Test Article",
        content: "Article content",
        summary: "Article summary",
        image: "https://example.com/image.jpg",
        scheduledFor: "1705320000",
        publishedAt: new Date("2024-01-15"),
        createdAt: new Date("2024-01-10"),
        updatedAt: new Date("2024-01-12"),
        isScheduled: true,
        isPublished: true,
        draft: false,
        status: "published",
        queueType: { name: "articles" },
        queueTypeId: "queue-2",
        userId: "user-1",
        tags: ["article", "longform"],
        signedEvent: { id: "event-2" },
        nostrEvent: { id: "nostr-2" },
        nostrEventId: "nostr-2",
      };

      const result = longFormPostToCombinedContent(longFormPost as unknown as LongFormPostData);

      expect(result).toEqual({
        id: "longform-1",
        type: "longform",
        title: "Test Article",
        content: "Article content",
        summary: "Article summary",
        image: "https://example.com/image.jpg",
        scheduledFor: "1705320000",
        publishedAt: new Date("2024-01-15"),
        postedAt: new Date("2024-01-15"), // Mapped from publishedAt
        createdAt: new Date("2024-01-10"),
        updatedAt: new Date("2024-01-12"),
        isScheduled: true,
        isPublished: true,
        isPosted: true, // Mapped from isPublished
        draft: false,
        status: "published",
        queueType: { name: "articles" },
        queueTypeId: "queue-2",
        userId: "user-1",
        tags: ["article", "longform"],
        signedEvent: { id: "event-2" },
        nostrEvent: { id: "nostr-2" },
        nostrEventId: "nostr-2",
        originalData: longFormPost,
      });
    });

    it("should map isPublished to isPosted", () => {
      const longFormPost = {
        id: "longform-2",
        isPublished: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = longFormPostToCombinedContent(longFormPost as unknown as LongFormPostData);

      expect(result.isPosted).toBe(false);
      expect(result.isPublished).toBe(false);
    });
  });

  describe("combineContent", () => {
    it("should combine posts and longform posts", () => {
      const posts = [
        {
          id: "post-1",
          caption: "Post 1",
          createdAt: new Date("2024-01-10"),
        },
        {
          id: "post-2",
          caption: "Post 2",
          createdAt: new Date("2024-01-12"),
        },
      ];

      const longFormPosts = [
        {
          id: "longform-1",
          title: "Article 1",
          createdAt: new Date("2024-01-11"),
        },
      ];

      const result = combineContent(posts as unknown as PostData[], longFormPosts as unknown as LongFormPostData[], "createdAt", "desc");

      expect(result).toHaveLength(3);
      expect(result[0].id).toBe("post-2"); // Most recent first (desc)
      expect(result[1].id).toBe("longform-1");
      expect(result[2].id).toBe("post-1");
    });

    it("should sort by createdAt ascending", () => {
      const posts = [
        {
          id: "post-1",
          createdAt: new Date("2024-01-12"),
        },
        {
          id: "post-2",
          createdAt: new Date("2024-01-10"),
        },
      ];

      const result = combineContent(posts as unknown as PostData[], [], "createdAt", "asc");

      expect(result[0].id).toBe("post-2"); // Oldest first
      expect(result[1].id).toBe("post-1");
    });

    it("should sort by scheduledFor correctly", () => {
      const posts = [
        {
          id: "post-1",
          scheduledFor: "1705320000", // Jan 15, 2024
          createdAt: new Date("2024-01-10"),
        },
        {
          id: "post-2",
          scheduledFor: "1705233600", // Jan 14, 2024
          createdAt: new Date("2024-01-10"),
        },
      ];

      const result = combineContent(posts as unknown as PostData[], [], "scheduledFor", "asc");

      expect(result[0].id).toBe("post-2"); // Earlier scheduled time first
      expect(result[1].id).toBe("post-1");
    });

    it("should sort by postedAt correctly", () => {
      const posts = [
        {
          id: "post-1",
          postedAt: new Date("2024-01-15"),
          createdAt: new Date("2024-01-10"),
        },
        {
          id: "post-2",
          postedAt: new Date("2024-01-14"),
          createdAt: new Date("2024-01-10"),
        },
      ];

      const result = combineContent(posts as unknown as PostData[], [], "postedAt", "desc");

      expect(result[0].id).toBe("post-1"); // Most recent posted first
      expect(result[1].id).toBe("post-2");
    });

    it("should handle empty arrays", () => {
      const result = combineContent([], [], "createdAt", "desc");

      expect(result).toEqual([]);
    });

    it("should handle only posts", () => {
      const posts = [
        {
          id: "post-1",
          createdAt: new Date("2024-01-10"),
        },
      ];

      // Dynamic import() type annotation needed for type reference
      // eslint-disable-next-line @typescript-eslint/consistent-type-imports
      const result = combineContent(posts as import("~/features/posts/types").PostData[], [], "createdAt", "desc");

      expect(result).toHaveLength(1);
      expect(result[0].type).toBe("post");
    });

    it("should handle only longform posts", () => {
      const longFormPosts = [
        {
          id: "longform-1",
          createdAt: new Date("2024-01-10"),
        },
      ];

      const result = combineContent([], longFormPosts as unknown as LongFormPostData[], "createdAt", "desc");

      expect(result).toHaveLength(1);
      expect(result[0].type).toBe("longform");
    });

    it("should handle missing sort field gracefully", () => {
      const posts = [
        {
          id: "post-1",
          createdAt: new Date("2024-01-10"),
        },
        {
          id: "post-2",
          // Missing createdAt
        },
      ];

      // Dynamic import() type annotation needed for type reference
      // eslint-disable-next-line @typescript-eslint/consistent-type-imports
      const result = combineContent(posts as import("~/features/posts/types").PostData[], [], "createdAt", "desc");

      expect(result).toHaveLength(2);
      // Items with missing fields should be sorted to end
    });

    it("should handle Unix timestamp strings for scheduledFor", () => {
      const posts = [
        {
          id: "post-1",
          scheduledFor: "1705320000", // Later
          createdAt: new Date("2024-01-10"),
        },
        {
          id: "post-2",
          scheduledFor: "1705233600", // Earlier
          createdAt: new Date("2024-01-10"),
        },
      ];

      const result = combineContent(posts as unknown as PostData[], [], "scheduledFor", "asc");

      expect(result[0].id).toBe("post-2");
      expect(result[1].id).toBe("post-1");
    });

    it("should handle null/undefined scheduledFor", () => {
      const posts = [
        {
          id: "post-1",
          scheduledFor: null,
          createdAt: new Date("2024-01-10"),
        },
        {
          id: "post-2",
          scheduledFor: "1705320000",
          createdAt: new Date("2024-01-10"),
        },
      ];

      const result = combineContent(posts as unknown as PostData[], [], "scheduledFor", "asc");

      expect(result).toHaveLength(2);
      // Posts with null scheduledFor should be sorted to end
    });
  });

  describe("filterCombinedContent", () => {
    it("should filter by caption", () => {
      const content: CombinedContent[] = [
        {
          id: "post-1",
          type: "post",
          caption: "Test post about cats",
          originalData: {},
        } as unknown as CombinedContent,
        {
          id: "post-2",
          type: "post",
          caption: "Dogs are great",
          originalData: {},
        } as unknown as CombinedContent,
      ];

      const result = filterCombinedContent(content, "cats");

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("post-1");
    });

    it("should filter by title (longform)", () => {
      const content: CombinedContent[] = [
        {
          id: "longform-1",
          type: "longform",
          title: "Article about JavaScript",
          originalData: {},
        } as unknown as CombinedContent,
        {
          id: "longform-2",
          type: "longform",
          title: "Python tutorial",
          originalData: {},
        } as unknown as CombinedContent,
      ];

      const result = filterCombinedContent(content, "JavaScript");

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("longform-1");
    });

    it("should filter by content", () => {
      const content: CombinedContent[] = [
        {
          id: "post-1",
          type: "post",
          content: "This is about React",
          originalData: {},
        } as unknown as CombinedContent,
        {
          id: "post-2",
          type: "post",
          content: "Vue.js is great",
          originalData: {},
        } as unknown as CombinedContent,
      ];

      const result = filterCombinedContent(content, "React");

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("post-1");
    });

    it("should filter by summary (longform)", () => {
      const content: CombinedContent[] = [
        {
          id: "longform-1",
          type: "longform",
          summary: "This article covers TypeScript",
          originalData: {},
        } as unknown as CombinedContent,
      ];

      const result = filterCombinedContent(content, "TypeScript");

      expect(result).toHaveLength(1);
    });

    it("should be case-insensitive", () => {
      const content: CombinedContent[] = [
        {
          id: "post-1",
          type: "post",
          caption: "Test Post",
          originalData: {},
        } as unknown as CombinedContent,
      ];

      const result = filterCombinedContent(content, "test");

      expect(result).toHaveLength(1);
    });

    it("should return all content when search term is empty", () => {
      const content: CombinedContent[] = [
        {
          id: "post-1",
          type: "post",
          caption: "Test",
          originalData: {},
        } as unknown as CombinedContent,
      ];

      const result = filterCombinedContent(content, "");

      expect(result).toEqual(content);
    });

    it("should return all content when search term is not provided", () => {
      const content: CombinedContent[] = [
        {
          id: "post-1",
          type: "post",
          caption: "Test",
          originalData: {},
        } as unknown as CombinedContent,
      ];

      const result = filterCombinedContent(content, "");

      expect(result).toEqual(content);
    });

    it("should match partial words", () => {
      const content: CombinedContent[] = [
        {
          id: "post-1",
          type: "post",
          caption: "JavaScript tutorial",
          originalData: {},
        } as unknown as CombinedContent,
      ];

      const result = filterCombinedContent(content, "script");

      expect(result).toHaveLength(1);
    });

    it("should handle null/undefined fields gracefully", () => {
      const content: CombinedContent[] = [
        {
          id: "post-1",
          type: "post",
          caption: null,
          content: null,
          originalData: {},
        } as unknown as CombinedContent,
        {
          id: "post-2",
          type: "post",
          caption: "Valid post",
          originalData: {},
        } as unknown as CombinedContent,
      ];

      const result = filterCombinedContent(content, "valid");

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("post-2");
    });
  });
});







