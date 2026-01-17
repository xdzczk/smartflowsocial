/**
 * Unit tests for combined content utilities
 * Tests app/features/posts/combined.server.ts
 */

import { describe, it, expect } from "vitest";

import {
  TEST_USER_ID,
  TEST_POST_ID,
  TEST_LONGFORM_ID,
} from "../utils/test-helpers";

import {
  nullToUndefined,
  postToCombinedContent,
  longFormPostToCombinedContent,
  combineContent,
  filterCombinedContent,
} from "~/features/posts/combined.server";
import type {
  PostData,
  LongFormPostData,
  CombinedContent,
} from "~/features/posts/types";

describe("Combined Content Utilities", () => {
  describe("nullToUndefined", () => {
    it("should convert null to undefined", () => {
      expect(nullToUndefined(null)).toBeUndefined();
    });

    it("should return value if not null", () => {
      expect(nullToUndefined("test")).toBe("test");
      expect(nullToUndefined(0)).toBe(0);
      expect(nullToUndefined(false)).toBe(false);
    });
  });

  describe("postToCombinedContent", () => {
    it("should convert PostData to CombinedContent", () => {
      const post: PostData = {
        id: TEST_POST_ID,
        userId: TEST_USER_ID,
        content: "Test content",
        caption: "Test caption",
        fileUrl: ["https://example.com/image.jpg"],
        createdAt: new Date(),
        updatedAt: new Date(),
        currentState: "PUBLISHED",
        status: "ACTIVE",
        postType: "IMAGE",
        tags: [],
        manual_override: false,
        repost: false,
        isQuotedPost: false,
        isRecyclable: false,
        hashTagPresetId: null,
        nostrEventId: null,
        scheduledFor: null,
        postedAt: new Date(),
        signedEvent: null,
        nostrEvent: null,
      } as unknown as PostData;

      const result = postToCombinedContent(post);

      expect(result.id).toBe(TEST_POST_ID);
      expect(result.type).toBe("post");
      expect(result.content).toBe("Test content");
      expect(result.caption).toBe("Test caption");
      expect(result.fileUrl).toEqual(["https://example.com/image.jpg"]);
      expect(result.currentState).toBe("PUBLISHED");
      expect(result.isScheduled).toBe(false); // Derived from currentState
      expect(result.isPosted).toBe(true); // Derived from currentState
      expect(result.originalData).toEqual(post);
    });

    it("should handle null values", () => {
      const post: PostData = {
        id: TEST_POST_ID,
        userId: TEST_USER_ID,
        content: null,
        caption: null,
        fileUrl: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        currentState: "DRAFT",
        status: "DRAFT",
        postType: "TEXT",
        tags: [],
        manual_override: false,
        repost: false,
        isQuotedPost: false,
        isRecyclable: false,
        hashTagPresetId: null,
        nostrEventId: null,
        scheduledFor: null,
        postedAt: null,
        signedEvent: null,
        nostrEvent: null,
      } as unknown as PostData;

      const result = postToCombinedContent(post);

      expect(result.content).toBeUndefined();
      expect(result.caption).toBeUndefined();
    });

    it("should handle queue type", () => {
      const post: PostData = {
        id: TEST_POST_ID,
        userId: TEST_USER_ID,
        fileUrl: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        currentState: "DRAFT",
        status: "DRAFT",
        postType: "TEXT",
        tags: [],
        manual_override: false,
        repost: false,
        isQuotedPost: false,
        isRecyclable: false,
        queueType: {
          id: "queue-1",
          name: "Queue 1",
          color: "#FF0000",
        },
        hashTagPresetId: null,
        nostrEventId: null,
        scheduledFor: null,
        postedAt: null,
        signedEvent: null,
        nostrEvent: null,
      } as unknown as PostData;

      const result = postToCombinedContent(post);

      expect(result.queueType).toBeDefined();
      expect(result.queueType?.name).toBe("Queue 1");
      expect(result.queueType?.color).toBe("#FF0000");
    });
  });

  describe("longFormPostToCombinedContent", () => {
    it("should convert LongFormPostData to CombinedContent", () => {
      const longFormPost: LongFormPostData = {
        id: TEST_LONGFORM_ID,
        userId: TEST_USER_ID,
        title: "Test Title",
        content: "Test content",
        summary: "Test summary",
        image: "https://example.com/image.jpg",
        createdAt: new Date(),
        updatedAt: new Date(),
        currentState: "PUBLISHED",
        status: "ACTIVE",
        tags: [],
        hashTagPresetId: null,
        nostrEventId: null,
        scheduledFor: null,
        postedAt: null,
        publishedAt: new Date(),
        signedEvent: null,
        nostrEvent: null,
      } as unknown as LongFormPostData;

      const result = longFormPostToCombinedContent(longFormPost);

      expect(result.id).toBe(TEST_LONGFORM_ID);
      expect(result.type).toBe("longform");
      expect(result.title).toBe("Test Title");
      expect(result.content).toBe("Test content");
      expect(result.summary).toBe("Test summary");
      expect(result.image).toBe("https://example.com/image.jpg");
      expect(result.currentState).toBe("PUBLISHED");
      expect(result.isPublished).toBe(true); // Derived from currentState
      expect(result.isPosted).toBe(true); // Derived from currentState
      expect(result.originalData).toEqual(longFormPost);
    });

    it("should map publishedAt to postedAt", () => {
      const publishedAt = new Date("2024-12-25T12:00:00Z");
      const longFormPost: LongFormPostData = {
        id: TEST_LONGFORM_ID,
        userId: TEST_USER_ID,
        createdAt: new Date(),
        updatedAt: new Date(),
        currentState: "PUBLISHED",
        status: "ACTIVE",
        tags: [],
        publishedAt,
        title: "",
        content: "",
        summary: "",
        image: null,
        hashTagPresetId: null,
        nostrEventId: null,
        scheduledFor: null,
        postedAt: null,
        signedEvent: null,
        nostrEvent: null,
      } as unknown as LongFormPostData;

      const result = longFormPostToCombinedContent(longFormPost);

      expect(result.postedAt).toEqual(publishedAt);
      expect(result.publishedAt).toEqual(publishedAt);
    });
  });

  describe("combineContent", () => {
    it("should combine posts and longform posts", () => {
      const posts: PostData[] = [
        {
          id: "post-1",
          userId: TEST_USER_ID,
          fileUrl: [],
          createdAt: new Date("2024-01-01"),
          updatedAt: new Date("2024-01-01"),
          currentState: "DRAFT",
          status: "DRAFT",
          postType: "TEXT",
          tags: [],
          manual_override: false,
          repost: false,
          isQuotedPost: false,
          isRecyclable: false,
        },
      ] as unknown as PostData[];
      const longFormPosts: LongFormPostData[] = [
        {
          id: "longform-1",
          userId: TEST_USER_ID,
          createdAt: new Date("2024-01-02"),
          updatedAt: new Date("2024-01-02"),
          currentState: "DRAFT",
          status: "DRAFT",
          tags: [],
        },
      ] as unknown as LongFormPostData[];

      const result = combineContent(posts, longFormPosts);

      expect(result).toHaveLength(2);
      // Default sort is by createdAt desc, so newer item comes first
      expect(result[0]?.type).toBe("longform");
      expect(result[1]?.type).toBe("post");
    });

    it("should sort by createdAt descending by default", () => {
      const posts: PostData[] = [
        {
          id: "post-1",
          userId: TEST_USER_ID,
          fileUrl: [],
          createdAt: new Date("2024-01-01"),
          updatedAt: new Date("2024-01-01"),
          currentState: "DRAFT",
          status: "DRAFT",
          postType: "TEXT",
          tags: [],
          manual_override: false,
          repost: false,
          isQuotedPost: false,
          isRecyclable: false,
        },
      ] as unknown as PostData[];
      const longFormPosts: LongFormPostData[] = [
        {
          id: "longform-1",
          userId: TEST_USER_ID,
          createdAt: new Date("2024-01-02"),
          updatedAt: new Date("2024-01-02"),
          currentState: "DRAFT",
          status: "DRAFT",
          tags: [],
        },
      ] as unknown as LongFormPostData[];

      const result = combineContent(posts, longFormPosts, "createdAt", "desc");

      expect(result[0]?.["id"]).toBe("longform-1"); // Newer first
      expect(result[1]?.["id"]).toBe("post-1");
    });

    it("should sort by scheduledFor", () => {
      const posts: PostData[] = [
        {
          id: "post-1",
          userId: TEST_USER_ID,
          fileUrl: [],
          scheduledFor: "1704067200", // 2024-01-01
          createdAt: new Date(),
          updatedAt: new Date(),
          currentState: "SCHEDULED",
          status: "SCHEDULED",
          postType: "TEXT",
          tags: [],
          manual_override: false,
          repost: false,
          isQuotedPost: false,
          isRecyclable: false,
        },
      ] as unknown as PostData[];
      const longFormPosts: LongFormPostData[] = [
        {
          id: "longform-1",
          userId: TEST_USER_ID,
          scheduledFor: "1704153600", // 2024-01-02
          createdAt: new Date(),
          updatedAt: new Date(),
          currentState: "SCHEDULED",
          status: "SCHEDULED",
          tags: [],
        },
      ] as unknown as LongFormPostData[];

      const result = combineContent(
        posts,
        longFormPosts,
        "scheduledFor",
        "asc"
      );

      expect(result[0]?.["id"]).toBe("post-1"); // Earlier first
      expect(result[1]?.["id"]).toBe("longform-1");
    });

    it("should handle empty arrays", () => {
      const result = combineContent([], []);

      expect(result).toEqual([]);
    });
  });

  describe("filterCombinedContent", () => {
    it("should filter by caption", () => {
      const content = [
        {
          id: "1",
          type: "post" as const,
          caption: "Test caption",
          fileUrl: [],
          createdAt: new Date(),
          updatedAt: new Date(),
          currentState: "DRAFT",
          status: "DRAFT" as const,
          userId: TEST_USER_ID,
          tags: [],
          manual_override: false,
          postType: "TEXT" as const,
          repost: false,
          isQuotedPost: false,
          isRecyclable: false,
        },
        {
          id: "2",
          type: "post" as const,
          caption: "Other caption",
          fileUrl: [],
          createdAt: new Date(),
          updatedAt: new Date(),
          currentState: "DRAFT",
          status: "DRAFT" as const,
          userId: TEST_USER_ID,
          tags: [],
          manual_override: false,
          postType: "TEXT" as const,
          repost: false,
          isQuotedPost: false,
          isRecyclable: false,
          originalData: {} as unknown as PostData,
        },
        {
          id: "2",
          type: "post" as const,
          caption: "Other caption",
          fileUrl: [],
          createdAt: new Date(),
          updatedAt: new Date(),
          currentState: "DRAFT",
          status: "DRAFT" as const,
          userId: TEST_USER_ID,
          tags: [],
          manual_override: false,
          postType: "TEXT" as const,
          repost: false,
          isQuotedPost: false,
          isRecyclable: false,
          originalData: {} as unknown as PostData,
        },
      ] as unknown as CombinedContent[];

      const result = filterCombinedContent(content, "Test");

      expect(result).toHaveLength(1);
      expect(result[0]?.["id"]).toBe("1");
    });

    it("should filter by title", () => {
      const content = [
        {
          id: "1",
          type: "longform" as const,
          title: "Test Title",
          fileUrl: [],
          createdAt: new Date(),
          updatedAt: new Date(),
          currentState: "DRAFT",
          status: "DRAFT" as const,
          userId: TEST_USER_ID,
          tags: [],
          originalData: {} as unknown as LongFormPostData,
        },
      ] as unknown as CombinedContent[];

      const result = filterCombinedContent(content, "Test");

      expect(result).toHaveLength(1);
    });

    it("should return all content if search term is empty", () => {
      const content = [
        {
          id: "1",
          type: "post" as const,
          fileUrl: [],
          createdAt: new Date(),
          updatedAt: new Date(),
          currentState: "DRAFT",
          status: "DRAFT" as const,
          userId: TEST_USER_ID,
          tags: [],
          manual_override: false,
          postType: "TEXT" as const,
          repost: false,
          isQuotedPost: false,
          isRecyclable: false,
          originalData: {} as unknown as PostData,
        },
      ] as unknown as CombinedContent[];

      const result = filterCombinedContent(content, "");

      expect(result).toEqual(content);
    });

    it("should be case insensitive", () => {
      const content = [
        {
          id: "1",
          type: "post" as const,
          caption: "Test Caption",
          fileUrl: [],
          createdAt: new Date(),
          updatedAt: new Date(),
          currentState: "DRAFT",
          status: "DRAFT" as const,
          userId: TEST_USER_ID,
          tags: [],
          manual_override: false,
          postType: "TEXT" as const,
          repost: false,
          isQuotedPost: false,
          isRecyclable: false,
          originalData: {} as unknown as PostData,
        },
      ] as unknown as CombinedContent[];

      const result = filterCombinedContent(content, "test");

      expect(result).toHaveLength(1);
    });
  });
});
