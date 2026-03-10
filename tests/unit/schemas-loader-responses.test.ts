/**
 * Unit tests for loader-responses validation schemas
 * Tests app/lib/validation/schemas/loader-responses.schemas.ts
 * Covers longFormPostDTOSchema transforms (lines 186-191) via loader schemas that use it.
 */

import { describe, it, expect } from "vitest";

import {
  draftsLoaderDataSchema,
  publishedPostsLoaderDataSchema,
  userSchema,
} from "~/lib/validation/schemas/loader-responses.schemas";

const minimalPostDTO = {
  id: "post-1",
  caption: null,
  fileUrl: [],
  scheduledAtUtc: null,
  publishedAt: null,
  content: "x",
  postType: "TEXT" as const,
  repost: false,
  isQuotedPost: false,
  isRecyclable: false,
  createdAt: "2025-01-01T00:00:00Z",
  updatedAt: "2025-01-01T00:00:00Z",
  status: "DRAFT" as const,
  currentState: "draft",
  signedEvent: null,
  nostrEvent: null,
  queueTypeId: null,
  tags: [],
  manual_override: false,
  userId: "user-1",
  templateId: null,
  hashTagPresetId: null,
  queueType: null,
  hashTagPreset: null,
};

const minimalUser = {
  id: "user-1",
  npub: "npub1abc",
  createdAt: "2025-01-01",
  updatedAt: "2025-01-01",
  isEnabled: true,
  timezone: "UTC",
  userRelays: [],
  giveawayBlackListed: [],
  uploadProvider: "S3" as const,
  scheduleInterval: [4],
  pendingParentRequests: [],
  pendingChildRequests: [],
};

const minimalQueueType = {
  id: "q1",
  name: "Main",
};

const minimalPagination = { total: 0, pages: 0, currentPage: 1, limit: 10 };

describe("loader-responses.schemas", () => {
  describe("longFormPostDTOSchema (via draftsLoaderDataSchema)", () => {
    it("parses longformPosts with nullish title and content (transform val ?? null)", () => {
      const data = {
        posts: [],
        longformPosts: [
          {
            id: "lf-1",
            title: undefined,
            summary: null,
            content: null,
            image: null,
            scheduledAtUtc: null,
            postedAt: null,
            publishedAt: null,
            updatedAt: "2025-01-01",
            createdAt: "2025-01-01",
            status: "DRAFT" as const,
            currentState: "draft",
            queueTypeId: null,
            tags: [],
            userId: "user-1",
            hashTagPresetId: null,
            queueType: null,
          },
        ],
        user: null,
        queueTypes: [minimalQueueType],
        selectedQueueType: "q1",
        pagination: minimalPagination,
      };

      const result = draftsLoaderDataSchema.parse(data);
      expect(result.longformPosts).toHaveLength(1);
      expect(result.longformPosts[0]?.title).toBeNull();
      expect(result.longformPosts[0]?.content).toBeNull();
    });

    it("parses longformPosts with string title and content", () => {
      const data = {
        posts: [],
        longformPosts: [
          {
            id: "lf-2",
            title: "My Title",
            summary: "Summary",
            content: "Body",
            image: null,
            scheduledAtUtc: null,
            postedAt: null,
            publishedAt: null,
            updatedAt: "2025-01-01",
            createdAt: "2025-01-01",
            status: "ACTIVE" as const,
            currentState: "active",
            queueTypeId: null,
            tags: [],
            userId: "user-1",
            hashTagPresetId: null,
            queueType: null,
          },
        ],
        user: null,
        queueTypes: [],
        selectedQueueType: "",
        pagination: minimalPagination,
      };

      const result = draftsLoaderDataSchema.parse(data);
      expect(result.longformPosts[0]?.title).toBe("My Title");
      expect(result.longformPosts[0]?.content).toBe("Body");
    });
  });

  describe("publishedPostsLoaderDataSchema", () => {
    it("parses valid loader data with posts and longformPosts", () => {
      const data = {
        posts: [minimalPostDTO],
        longformPosts: [
          {
            id: "lf-1",
            title: "Title",
            content: "Content",
            image: null,
            scheduledAtUtc: null,
            postedAt: null,
            publishedAt: null,
            updatedAt: "2025-01-01",
            createdAt: "2025-01-01",
            status: "POSTED" as const,
            currentState: "posted",
            queueTypeId: null,
            tags: [],
            userId: "user-1",
            hashTagPresetId: null,
            queueType: null,
          },
        ],
        user: minimalUser,
        queueTypes: [minimalQueueType],
        pagination: minimalPagination,
        stats: {},
      };

      const result = publishedPostsLoaderDataSchema.parse(data);
      expect(result.posts).toHaveLength(1);
      expect(result.longformPosts).toHaveLength(1);
    });
  });

  describe("userSchema", () => {
    it("parses user with required fields", () => {
      const result = userSchema.parse(minimalUser);
      expect(result.id).toBe("user-1");
      expect(result.npub).toBe("npub1abc");
    });

    it("rejects when required id is missing", () => {
      const invalid = { ...minimalUser, id: undefined };
      expect(() => userSchema.parse(invalid)).toThrow();
    });
  });
});
