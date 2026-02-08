/**
 * Unit tests for calendar post converter functions
 * Tests functions in app/features/posts/utils/calendar-post-converter.ts
 */

import { describe, it, expect } from "vitest";

import type { PostData, LongFormPostData } from "~/features/posts/types";
import {
  postDataToCalendarPost,
  longFormPostDataToCalendarPost,
  postsToCalendarPosts,
  longFormPostsToCalendarPosts,
  mixedPostsToCalendarPosts,
} from "~/features/posts/utils/calendar-post-converter";

describe("Calendar Post Converter", () => {
  describe("postDataToCalendarPost", () => {
    it("should convert PostData to CalendarPost", () => {
      // scheduledFor should be a Unix timestamp string (in seconds)
      const scheduledForUnix = Math.floor(
        new Date("2024-01-15T10:00:00Z").getTime() / 1000
      );
      const postData: PostData = {
        id: "post-1",
        caption: "Test post",
        scheduledAtUtc: new Date("2024-01-15T10:00:00Z"),
        currentState: "SCHEDULED",
        publishedAt: null,
        queueType: null,
      } as unknown as PostData;

      const result = postDataToCalendarPost(postData);

      expect(result.id).toBe("post-1");
      expect(result.caption).toBe("Test post");
      expect(result.scheduledFor).toBe(String(scheduledForUnix));
      expect(result.publishedAt).toBeNull();
      expect(result.queueType).toBeNull();
      expect(result.manual_override).toBe(false);
    });

    it("should handle publishedAt as Date", () => {
      const publishedAt = new Date("2024-01-15T10:00:00Z");
      const postData: PostData = {
        id: "post-1",
        publishedAt,
      } as unknown as PostData;

      const result = postDataToCalendarPost(postData);
      expect(result.publishedAt).toBe(publishedAt);
    });

    it("should handle publishedAt as string", () => {
      const publishedAt = "2024-01-15T10:00:00Z";
      const postData: PostData = {
        id: "post-1",
        publishedAt,
      } as unknown as PostData;

      const result = postDataToCalendarPost(postData);
      expect(result.publishedAt).toBe(publishedAt);
    });

    it("should handle null publishedAt", () => {
      const postData: PostData = {
        id: "post-1",
      } as unknown as PostData;

      const result = postDataToCalendarPost(postData);
      expect(result.publishedAt).toBeNull();
    });
  });

  describe("longFormPostDataToCalendarPost", () => {
    it("should convert LongFormPostData to CalendarPost", () => {
      // scheduledFor should be a Unix timestamp string (in seconds)
      const scheduledForUnix = Math.floor(
        new Date("2024-01-15T10:00:00Z").getTime() / 1000
      );
      const longFormData: LongFormPostData = {
        id: "longform-1",
        title: "Test Article",
        content: "Article content",
        scheduledAtUtc: new Date("2024-01-15T10:00:00Z"),
        currentState: "SCHEDULED",
      } as unknown as LongFormPostData;

      const result = longFormPostDataToCalendarPost(longFormData);

      expect(result.id).toBe("longform-1");
      expect(result.title).toBe("Test Article");
      expect(result.caption).toBe("Article content");
      expect(result.scheduledFor).toBe(String(scheduledForUnix));
      expect(result.currentState).toBe("SCHEDULED");
      expect(result.isScheduled).toBe(true); // Derived from currentState
      expect(result.isPosted).toBe(false); // Derived from currentState
      expect(result.fileUrl).toEqual([]);
      expect(result.manual_override).toBe(false);
    });

    it("should convert tags array to hashtags string", () => {
      const longFormData: LongFormPostData = {
        id: "longform-1",
        tags: ["tag1", "tag2", "tag3"],
      } as unknown as LongFormPostData;

      const result = longFormPostDataToCalendarPost(longFormData);
      expect(result.hashtags).toBe("tag1 tag2 tag3");
    });

    it("should handle templateId", () => {
      const longFormData: LongFormPostData = {
        id: "longform-1",
        templateId: "template-123",
      } as unknown as LongFormPostData;

      const result = longFormPostDataToCalendarPost(longFormData);
      expect(result.templateId).toBe("template-123");
    });

    it("should handle isRecyclable", () => {
      const longFormData: LongFormPostData = {
        id: "longform-1",
        isRecyclable: true,
      } as unknown as LongFormPostData;

      const result = longFormPostDataToCalendarPost(longFormData);
      expect(result.isRecyclable).toBe(true);
    });

    it("should set publishedAt from publishedAt", () => {
      const publishedAt = new Date("2024-01-15T10:00:00Z");
      const longFormData: LongFormPostData = {
        id: "longform-1",
        publishedAt,
      } as unknown as LongFormPostData;

      const result = longFormPostDataToCalendarPost(longFormData);
      expect(result.publishedAt).toBe(publishedAt);
      expect(result.publishedAt).toBe(publishedAt);
    });
  });

  describe("postsToCalendarPosts", () => {
    it("should convert array of PostData", () => {
      const posts: PostData[] = [
        { id: "post-1" } as unknown as PostData,
        { id: "post-2" } as unknown as PostData,
      ];

      const result = postsToCalendarPosts(posts);
      expect(result).toHaveLength(2);
      expect(result[0]?.id).toBe("post-1");
      expect(result[1]?.id).toBe("post-2");
    });

    it("should return empty array for empty input", () => {
      const result = postsToCalendarPosts([]);
      expect(result).toEqual([]);
    });
  });

  describe("longFormPostsToCalendarPosts", () => {
    it("should convert array of LongFormPostData", () => {
      const posts: LongFormPostData[] = [
        { id: "longform-1" } as unknown as LongFormPostData,
        { id: "longform-2" } as unknown as LongFormPostData,
      ];

      const result = longFormPostsToCalendarPosts(posts);
      expect(result).toHaveLength(2);
      expect(result[0]?.id).toBe("longform-1");
      expect(result[1]?.id).toBe("longform-2");
    });

    it("should return empty array for empty input", () => {
      const result = longFormPostsToCalendarPosts([]);
      expect(result).toEqual([]);
    });
  });

  describe("mixedPostsToCalendarPosts", () => {
    it("should convert mixed arrays", () => {
      const posts: PostData[] = [{ id: "post-1" } as unknown as PostData];
      const longFormPosts: LongFormPostData[] = [
        { id: "longform-1" } as unknown as LongFormPostData,
      ];

      const result = mixedPostsToCalendarPosts(posts, longFormPosts);
      expect(result).toHaveLength(2);
      expect(result[0]?.id).toBe("post-1");
      expect(result[1]?.id).toBe("longform-1");
    });

    it("should handle empty arrays", () => {
      const result = mixedPostsToCalendarPosts([], []);
      expect(result).toEqual([]);
    });

    it("should handle only posts", () => {
      const posts: PostData[] = [
        { id: "post-1" } as unknown as PostData,
        { id: "post-2" } as unknown as PostData,
      ];
      const result = mixedPostsToCalendarPosts(posts, []);
      expect(result).toHaveLength(2);
    });

    it("should handle only longform posts", () => {
      const longFormPosts: LongFormPostData[] = [
        { id: "longform-1" } as unknown as LongFormPostData,
      ];
      const result = mixedPostsToCalendarPosts([], longFormPosts);
      expect(result).toHaveLength(1);
    });
  });
});
