/**
 * Unit tests for post data conversion utilities
 * Tests app/lib/validation/post-data-conversion.ts
 */

import { describe, it, expect } from "vitest";

import type { PostData } from "~/features/posts/types";
import {
  convertPostDataToScheduledTablePost,
  convertPostDataArrayToScheduledTablePosts,
} from "~/lib/validation/post-data-conversion";

describe("Post Data Conversion", () => {
  describe("convertPostDataToScheduledTablePost", () => {
    it("should include scheduledAtUtc from PostData", () => {
      const post: PostData = {
        id: "post-1",
        caption: "Test caption",
        scheduledAtUtc: new Date("2024-01-01T12:00:00Z"),
      } as unknown as PostData;

      const result = convertPostDataToScheduledTablePost(post);

      expect(result.id).toBe("post-1");
      expect(result.caption).toBe("Test caption");
      expect(result.scheduledAtUtc).toEqual(new Date("2024-01-01T12:00:00Z"));
    });

    it("should handle null scheduledAtUtc", () => {
      const post: PostData = {
        id: "post-1",
        scheduledAtUtc: null,
      } as unknown as PostData;

      const result = convertPostDataToScheduledTablePost(post);

      expect(result.scheduledAtUtc).toBeNull();
    });

    it("should handle undefined scheduledAtUtc", () => {
      const post: PostData = {
        id: "post-1",
      } as unknown as PostData;

      const result = convertPostDataToScheduledTablePost(post);

      expect(result.scheduledAtUtc).toBeNull();
    });

    it("should convert queueType correctly", () => {
      const post: PostData = {
        id: "post-1",
        queueType: {
          id: "queue-1",
          name: "Morning",
          color: "blue",
        },
      } as unknown as PostData;

      const result = convertPostDataToScheduledTablePost(post);

      // color is derived from colorToken via getQueueAccentHex; no colorToken → slate default
      expect(result.queueType).toEqual({
        name: "Morning",
        color: "#7C8FA8", // slate accent when colorToken is null
        colorToken: null,
      });
    });

    it("should handle queueType with null color", () => {
      const post: PostData = {
        id: "post-1",
        queueType: {
          id: "queue-1",
          name: "Morning",
          color: null,
        },
      } as unknown as PostData;

      const result = convertPostDataToScheduledTablePost(post);

      // color is always from getQueueAccentHex(colorToken); null colorToken → slate
      expect(result.queueType).toEqual({
        name: "Morning",
        color: "#7C8FA8",
        colorToken: null,
      });
    });

    it("should handle null queueType", () => {
      const post: PostData = {
        id: "post-1",
        queueType: null,
      } as unknown as PostData;

      const result = convertPostDataToScheduledTablePost(post);

      expect(result.queueType).toBeNull();
    });

    it("should convert fileUrl correctly", () => {
      const post: PostData = {
        id: "post-1",
        fileUrl: ["url1", "url2"],
      } as unknown as PostData;

      const result = convertPostDataToScheduledTablePost(post);

      expect(result.fileUrl).toEqual(["url1", "url2"]);
    });

    it("should handle null fileUrl", () => {
      const post: PostData = {
        id: "post-1",
        fileUrl: null,
      } as unknown as PostData;

      const result = convertPostDataToScheduledTablePost(post);

      expect(result.fileUrl).toBeNull();
    });

    it("should convert repost flag", () => {
      const post: PostData = {
        id: "post-1",
        repost: true,
      } as unknown as PostData;

      const result = convertPostDataToScheduledTablePost(post);

      expect(result.repost).toBe(true);
    });

    it("should default repost to false when not set", () => {
      const post: PostData = {
        id: "post-1",
      } as unknown as PostData;

      const result = convertPostDataToScheduledTablePost(post);

      expect(result.repost).toBe(false);
    });

    it("should convert isQuotedPost flag", () => {
      const post: PostData = {
        id: "post-1",
        isQuotedPost: true,
      } as unknown as PostData;

      const result = convertPostDataToScheduledTablePost(post);

      expect(result.isQuotedPost).toBe(true);
    });

    it("should convert isPostSigned based on signedEvent", () => {
      const post: PostData = {
        id: "post-1",
        signedEvent: {
          id: "event-1",
          pubkey: "pubkey",
          created_at: 1234567890,
          kind: 1,
          tags: [],
          content: "content",
          sig: "sig",
        },
      } as unknown as PostData;

      const result = convertPostDataToScheduledTablePost(post);

      expect(result.isPostSigned).toBe(true);
    });

    it("should set isPostSigned to false when signedEvent is null", () => {
      const post: PostData = {
        id: "post-1",
        signedEvent: null,
      } as unknown as PostData;

      const result = convertPostDataToScheduledTablePost(post);

      expect(result.isPostSigned).toBe(false);
    });
  });

  describe("convertPostDataArrayToScheduledTablePosts", () => {
    it("should convert array of PostData", () => {
      const posts: PostData[] = [
        {
          id: "post-1",
          caption: "Post 1",
          scheduledAtUtc: new Date("2024-01-01T12:00:00Z"),
        } as unknown as PostData,
        {
          id: "post-2",
          caption: "Post 2",
          scheduledAtUtc: new Date("2024-01-02T12:00:00Z"),
        } as unknown as PostData,
      ];

      const result = convertPostDataArrayToScheduledTablePosts(posts);

      expect(result).toHaveLength(2);
      expect(result[0]?.id).toBe("post-1");
      expect(result[1]?.id).toBe("post-2");
    });

    it("should return empty array for empty input", () => {
      const posts: PostData[] = [];

      const result = convertPostDataArrayToScheduledTablePosts(posts);

      expect(result).toHaveLength(0);
    });
  });
});
