/**
 * Unit tests for drafts post conversion utilities
 * Tests app/lib/validation/drafts-post-conversion.ts
 */

import { describe, it, expect } from "vitest";

import type { PostData } from "~/features/posts/types";
import {
  convertDraftsPostToPostData,
  convertDraftsPostsToPostDataArray,
  type DraftsStatePost,
} from "~/lib/validation/drafts-post-conversion";

describe("Drafts Post Conversion", () => {
  describe("convertDraftsPostToPostData", () => {
    it("should return original PostData when found in originalPosts", () => {
      const draftsPost = {
        id: "post-1",
        caption: "Draft caption",
        createdAt: "2024-01-01T00:00:00Z",
      };

      const originalPost: PostData = {
        id: "post-1",
        caption: "Original caption",
        scheduledFor: new Date("2024-01-02"),
      } as unknown as PostData;

      const originalPosts: PostData[] = [originalPost];

      const result = convertDraftsPostToPostData(
        draftsPost,
        originalPosts,
      );

      expect(result).toEqual(originalPost);
      expect(result?.id).toBe("post-1");
      expect(result?.caption).toBe("Original caption");
    });

    it("should return null when original PostData not found", () => {
      const draftsPost = {
        id: "post-1",
        caption: "Draft caption",
        createdAt: "2024-01-01T00:00:00Z",
      };

      const originalPosts: PostData[] = [
        {
          id: "post-2",
          caption: "Other post",
        } as unknown as PostData,
      ];

      const result = convertDraftsPostToPostData(
        draftsPost,
        originalPosts,
      );

      expect(result).toBeNull();
    });

    it("should return null when originalPosts is empty", () => {
      const draftsPost = {
        id: "post-1",
        caption: "Draft caption",
        createdAt: "2024-01-01T00:00:00Z",
      };

      const originalPosts: PostData[] = [];

      const result = convertDraftsPostToPostData(
        draftsPost,
        originalPosts,
      );

      expect(result).toBeNull();
    });

    it("should match by id correctly", () => {
      const draftsPost = {
        id: "post-2",
        caption: "Draft",
        createdAt: "2024-01-01T00:00:00Z",
      };

      const originalPosts: PostData[] = [
        { id: "post-1", caption: "Post 1" } as unknown as PostData,
        { id: "post-2", caption: "Post 2" } as unknown as PostData,
        { id: "post-3", caption: "Post 3" } as unknown as PostData,
      ];

      const result = convertDraftsPostToPostData(
        draftsPost,
        originalPosts,
      );

      expect(result).not.toBeNull();
      expect(result?.id).toBe("post-2");
      expect(result?.caption).toBe("Post 2");
    });
  });

  describe("convertDraftsPostsToPostDataArray", () => {
    it("should convert all drafts posts when all found", () => {
      const draftsPosts = [
        {
          id: "post-1",
          caption: "Draft 1",
          createdAt: "2024-01-01T00:00:00Z",
        },
        {
          id: "post-2",
          caption: "Draft 2",
          createdAt: "2024-01-02T00:00:00Z",
        },
      ];

      const originalPosts: PostData[] = [
        { id: "post-1", caption: "Post 1" } as unknown as PostData,
        { id: "post-2", caption: "Post 2" } as unknown as PostData,
      ];

      const result = convertDraftsPostsToPostDataArray(
        draftsPosts,
        originalPosts,
      );

      expect(result).toHaveLength(2);
      expect(result[0]?.id).toBe("post-1");
      expect(result[1]?.id).toBe("post-2");
    });

    it("should filter out posts that can't be converted", () => {
      const draftsPosts = [
        {
          id: "post-1",
          caption: "Draft 1",
          createdAt: "2024-01-01T00:00:00Z",
        },
        {
          id: "post-2",
          caption: "Draft 2",
          createdAt: "2024-01-02T00:00:00Z",
        },
        {
          id: "post-3",
          caption: "Draft 3",
          createdAt: "2024-01-03T00:00:00Z",
        },
      ];

      const originalPosts: PostData[] = [
        { id: "post-1", caption: "Post 1" } as unknown as PostData,
        // post-2 missing
        { id: "post-3", caption: "Post 3" } as unknown as PostData,
      ];

      const result = convertDraftsPostsToPostDataArray(
        draftsPosts,
        originalPosts,
      );

      expect(result).toHaveLength(2);
      expect(result[0]?.id).toBe("post-1");
      expect(result[1]?.id).toBe("post-3");
    });

    it("should return empty array when no posts can be converted", () => {
      const draftsPosts = [
        {
          id: "post-1",
          caption: "Draft 1",
          createdAt: "2024-01-01T00:00:00Z",
        },
      ];

      const originalPosts: PostData[] = [
        { id: "post-2", caption: "Post 2" } as unknown as PostData,
      ];

      const result = convertDraftsPostsToPostDataArray(
        draftsPosts,
        originalPosts,
      );

      expect(result).toHaveLength(0);
    });

    it("should return empty array for empty draftsPosts", () => {
      const draftsPosts: DraftsStatePost[] = [];
      const originalPosts: PostData[] = [
        { id: "post-1", caption: "Post 1" } as unknown as PostData,
      ];

      const result = convertDraftsPostsToPostDataArray(
        draftsPosts,
        originalPosts,
      );

      expect(result).toHaveLength(0);
    });

    it("should return empty array for empty originalPosts", () => {
      const draftsPosts = [
        {
          id: "post-1",
          caption: "Draft 1",
          createdAt: "2024-01-01T00:00:00Z",
        },
      ];

      const originalPosts: PostData[] = [];

      const result = convertDraftsPostsToPostDataArray(
        draftsPosts,
        originalPosts,
      );

      expect(result).toHaveLength(0);
    });
  });
});

