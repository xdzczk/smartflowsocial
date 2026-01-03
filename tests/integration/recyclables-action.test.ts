/**
 * Integration tests for recyclables action handler
 *
 * Tests app/routes/dashboard.recyclables.tsx action
 * Tests handleRecyclablePostAction function
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Set SESSION_SECRET for tests (must be before any imports that use it)
process.env.SESSION_SECRET = "test-session-secret";

// Mock session.server to prevent SESSION_SECRET invariant error
vi.mock("~/features/auth/session.server", () => ({
  requireUserId: vi.fn(),
  sessionStorage: {
    getSession: vi.fn(),
    commitSession: vi.fn(),
    destroySession: vi.fn(),
  },
}));

// Mock Prisma to prevent $use errors
vi.mock("~/lib/prisma.server", () => ({
  prisma: {
    $use: vi.fn(),
  },
}));

// Mock dependencies
vi.mock("~/models/post.commands.server", () => ({
  deletePost: vi.fn(),
}));

vi.mock("~/models/post.queries.server", () => ({
  getPostsByIds: vi.fn(),
}));

import { handleRecyclablePostAction } from "~/features/posts/posts.server";
import { deletePost } from "~/models/post.commands.server";
import { getPostsByIds } from "~/models/post.queries.server";

import {
  createActionFormData,
  TEST_USER_ID,
  TEST_POST_ID,
  createPostIds,
  createMockPost,
} from "../utils/test-helpers";

describe("Recyclables Action Handler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Delete Action", () => {
    it("should delete a single recyclable post", async () => {
      (deletePost as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

      const formData = createActionFormData("delete", {
        postId: TEST_POST_ID,
      });

      const result = await handleRecyclablePostAction(formData, TEST_USER_ID);
      const dataRaw: unknown = await result.json();
      const data =
        dataRaw && typeof dataRaw === "object" && !Array.isArray(dataRaw)
          ? (dataRaw as {
              success?: unknown;
              repostData?: unknown;
              scheduledRepostData?: unknown;
              quotePostData?: unknown;
              repostEventData?: unknown;
              originalPost?: unknown;
              error?: unknown;
            })
          : {};
      const success =
        typeof data.success === "boolean"
          ? data.success
          : data.success === true || data.success === 1;

      expect(deletePost).toHaveBeenCalledWith({
        id: TEST_POST_ID,
        userId: TEST_USER_ID,
      });
      expect(success).toBe(true);
    });
  });

  describe("Bulk Delete Action", () => {
    it("should delete multiple recyclable posts", async () => {
      const postIds = createPostIds(3);
      (deletePost as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

      const formData = createActionFormData("bulkDelete", {
        postIds: JSON.stringify(postIds),
      });

      const result = await handleRecyclablePostAction(formData, TEST_USER_ID);
      const dataRaw: unknown = await result.json();
      const data =
        dataRaw && typeof dataRaw === "object" && !Array.isArray(dataRaw)
          ? (dataRaw as {
              success?: unknown;
              repostData?: unknown;
              scheduledRepostData?: unknown;
              quotePostData?: unknown;
              repostEventData?: unknown;
              originalPost?: unknown;
              error?: unknown;
            })
          : {};
      const success =
        typeof data.success === "boolean"
          ? data.success
          : data.success === true || data.success === 1;

      expect(deletePost).toHaveBeenCalledTimes(3);
      postIds.forEach((id) => {
        expect(deletePost).toHaveBeenCalledWith({
          id,
          userId: TEST_USER_ID,
        });
      });
      expect(success).toBe(true);
    });
  });

  describe("Bulk Repost Action", () => {
    it("should return posts data for bulk repost", async () => {
      const postIds = createPostIds(2);
      const mockPosts = postIds.map((id) =>
        createMockPost({
          id,
          signedEvent: { id: `event-${id}`, pubkey: "pubkey-1" },
          queueType: { name: "posts" },
        }),
      );

      (getPostsByIds as ReturnType<typeof vi.fn>).mockResolvedValue(mockPosts);

      const formData = createActionFormData("bulkRepost", {
        postIds: JSON.stringify(postIds),
      });

      const result = await handleRecyclablePostAction(formData, TEST_USER_ID);
      const dataRaw: unknown = await result.json();
      const data =
        dataRaw && typeof dataRaw === "object" && !Array.isArray(dataRaw)
          ? (dataRaw as {
              success?: unknown;
              repostData?: unknown;
              scheduledRepostData?: unknown;
              quotePostData?: unknown;
              repostEventData?: unknown;
              originalPost?: unknown;
              error?: unknown;
            })
          : {};
      const repostData = Array.isArray(data.repostData) ? data.repostData : [];

      expect(getPostsByIds).toHaveBeenCalledWith({
        ids: postIds,
        userId: TEST_USER_ID,
      });
      // Dates are serialized to strings in JSON responses
      const expectedPosts = mockPosts.map((post) => ({
        ...post,
        createdAt: post.createdAt.toISOString(),
        updatedAt: post.updatedAt.toISOString(),
      }));
      expect(repostData).toEqual(expectedPosts);
    });
  });

  describe("Bulk Scheduled Repost Action", () => {
    it("should return posts data for bulk scheduled repost", async () => {
      const postIds = createPostIds(2);
      const mockPosts = postIds.map((id) =>
        createMockPost({
          id,
          signedEvent: { id: `event-${id}`, pubkey: "pubkey-1" },
          queueType: { name: "posts" },
        }),
      );

      (getPostsByIds as ReturnType<typeof vi.fn>).mockResolvedValue(mockPosts);

      const formData = createActionFormData("bulkScheduledRepost", {
        postIds: JSON.stringify(postIds),
      });

      const result = await handleRecyclablePostAction(formData, TEST_USER_ID);
      const dataRaw: unknown = await result.json();
      const data =
        dataRaw && typeof dataRaw === "object" && !Array.isArray(dataRaw)
          ? (dataRaw as {
              success?: unknown;
              repostData?: unknown;
              scheduledRepostData?: unknown;
              quotePostData?: unknown;
              repostEventData?: unknown;
              originalPost?: unknown;
              error?: unknown;
            })
          : {};
      const scheduledRepostData = Array.isArray(data.scheduledRepostData)
        ? data.scheduledRepostData
        : [];

      // Dates are serialized to strings in JSON responses
      const expectedPosts = mockPosts.map((post) => ({
        ...post,
        createdAt: post.createdAt.toISOString(),
        updatedAt: post.updatedAt.toISOString(),
      }));
      expect(scheduledRepostData).toEqual(expectedPosts);
    });
  });

  describe("Bulk Quote Action", () => {
    it("should return quote post data for bulk quote", async () => {
      const postIds = createPostIds(2);
      const mockPosts = postIds.map((id) =>
        createMockPost({
          id,
          caption: `Caption ${id}`,
          fileUrl: [`https://example.com/image-${id}.jpg`],
          queueType: { name: "posts" },
          signedEvent: { id: `event-${id}`, pubkey: "pubkey-1" },
        }),
      );

      (getPostsByIds as ReturnType<typeof vi.fn>).mockResolvedValue(mockPosts);

      const formData = createActionFormData("bulkQuote", {
        postIds: JSON.stringify(postIds),
      });

      const result = await handleRecyclablePostAction(formData, TEST_USER_ID);
      const dataRaw: unknown = await result.json();
      const data =
        dataRaw && typeof dataRaw === "object" && !Array.isArray(dataRaw)
          ? (dataRaw as {
              success?: unknown;
              repostData?: unknown;
              scheduledRepostData?: unknown;
              quotePostData?: unknown;
              repostEventData?: unknown;
              originalPost?: unknown;
              error?: unknown;
            })
          : {};
      const quotePostData = Array.isArray(data.quotePostData)
        ? data.quotePostData
        : [];
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const firstQuotePost =
        quotePostData[0] &&
        typeof quotePostData[0] === "object" &&
        !Array.isArray(quotePostData[0])
          ? quotePostData[0]
          : {};

      expect(quotePostData).toHaveLength(2);
      expect(firstQuotePost).toMatchObject({
        caption: "",
        fileUrl: `https://example.com/image-${postIds[0]}.jpg`, // Implementation returns first element as string
        queueType: "posts",
        scheduledFor: "",
        originalPostId: postIds[0],
        originalEventId: `event-${postIds[0]}`,
        originalEventPubkey: "pubkey-1",
        isQuotePost: true,
        originalCaption: `Caption ${postIds[0]}`,
      });
    });
  });

  describe("Repost Action", () => {
    it("should return kind 6 repost event data", async () => {
      const mockPost = createMockPost({
        id: TEST_POST_ID,
        signedEvent: {
          id: "event-123",
          pubkey: "pubkey-123",
          kind: 1,
        },
      });

      (getPostsByIds as ReturnType<typeof vi.fn>).mockResolvedValue([mockPost]);

      const formData = createActionFormData("repost", {
        postId: TEST_POST_ID,
      });

      const result = await handleRecyclablePostAction(formData, TEST_USER_ID);
      const dataRaw: unknown = await result.json();
      const data =
        dataRaw && typeof dataRaw === "object" && !Array.isArray(dataRaw)
          ? (dataRaw as {
              success?: unknown;
              repostData?: unknown;
              scheduledRepostData?: unknown;
              quotePostData?: unknown;
              repostEventData?: unknown;
              originalPost?: unknown;
              error?: unknown;
            })
          : {};
      const repostEventData =
        data.repostEventData &&
        typeof data.repostEventData === "object" &&
        !Array.isArray(data.repostEventData)
          ? data.repostEventData
          : {};
      const originalPost =
        data.originalPost &&
        typeof data.originalPost === "object" &&
        !Array.isArray(data.originalPost)
          ? data.originalPost
          : {};

      expect(repostEventData).toMatchObject({
        kind: 6,
        content: "",
        tags: [
          ["e", "event-123", "wss://relay.primal.net"],
          ["p", "pubkey-123"],
        ],
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        created_at: expect.any(Number),
      });
      // Dates are serialized to strings in JSON responses
      const expectedPost = {
        ...mockPost,
        createdAt: mockPost.createdAt.toISOString(),
        updatedAt: mockPost.updatedAt.toISOString(),
      };
      expect(originalPost).toEqual(expectedPost);
    });

    it("should handle post not found error", async () => {
      (getPostsByIds as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      const formData = createActionFormData("repost", {
        postId: "non-existent",
      });

      const result = await handleRecyclablePostAction(formData, TEST_USER_ID);

      expect(result.status).toBeGreaterThanOrEqual(400);
    });
  });

  describe("Quote Action", () => {
    it("should return quote post data", async () => {
      const mockPost = createMockPost({
        id: TEST_POST_ID,
        caption: "Original caption",
        fileUrl: ["https://example.com/image.jpg"],
        queueType: { name: "posts" },
        signedEvent: {
          id: "event-123",
          pubkey: "pubkey-123",
        },
      });

      (getPostsByIds as ReturnType<typeof vi.fn>).mockResolvedValue([mockPost]);

      const formData = createActionFormData("quote", {
        postId: TEST_POST_ID,
      });

      const result = await handleRecyclablePostAction(formData, TEST_USER_ID);
      const dataRaw: unknown = await result.json();
      const data =
        dataRaw && typeof dataRaw === "object" && !Array.isArray(dataRaw)
          ? (dataRaw as {
              success?: unknown;
              repostData?: unknown;
              scheduledRepostData?: unknown;
              quotePostData?: unknown;
              repostEventData?: unknown;
              originalPost?: unknown;
              error?: unknown;
            })
          : {};
      const quotePostData = Array.isArray(data.quotePostData)
        ? data.quotePostData
        : [];
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const firstQuotePost =
        quotePostData[0] &&
        typeof quotePostData[0] === "object" &&
        !Array.isArray(quotePostData[0])
          ? quotePostData[0]
          : {};

      expect(quotePostData).toHaveLength(1);
      expect(firstQuotePost).toMatchObject({
        caption: "",
        fileUrl: "https://example.com/image.jpg", // Implementation returns first element as string
        queueType: "posts",
        scheduledFor: "",
        originalPostId: TEST_POST_ID,
        originalEventId: "event-123",
        originalEventPubkey: "pubkey-123",
        isQuotePost: true,
        originalCaption: "Original caption",
      });
    });

    it("should handle post not found error", async () => {
      (getPostsByIds as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      const formData = createActionFormData("quote", {
        postId: "non-existent",
      });

      const result = await handleRecyclablePostAction(formData, TEST_USER_ID);

      expect(result.status).toBeGreaterThanOrEqual(400);
    });
  });

  describe("Invalid Action", () => {
    it("should return error for invalid action", async () => {
      const formData = createActionFormData("invalid_action", {});

      const result = await handleRecyclablePostAction(formData, TEST_USER_ID);
      const dataRaw: unknown = await result.json();
      const data =
        dataRaw && typeof dataRaw === "object" && !Array.isArray(dataRaw)
          ? (dataRaw as {
              success?: unknown;
              repostData?: unknown;
              scheduledRepostData?: unknown;
              quotePostData?: unknown;
              repostEventData?: unknown;
              originalPost?: unknown;
              error?: unknown;
            })
          : {};
      const error = typeof data.error === "string" ? data.error : "";

      expect(result.status).toBe(400);
      expect(error).toContain("Invalid");
    });
  });
});
