/**
 * Integration tests for new post action handlers
 *
 * Tests the action handler logic directly, without requiring a browser.
 * For UI interaction tests, see tests/e2e/posts/new-post.cy.ts
 *
 * Note: This tests the core logic. File uploads are tested separately.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock dependencies
vi.mock("~/features/user", () => ({
  getUserById: vi.fn(),
  getQueueTypes: vi.fn(),
  getHashTagPresetById: vi.fn(),
}));

// Use cases: handlers import CreatePostUseCase from the use-case module, so mock there
const mockCreatePostExecute = vi.fn();
const mockPublishNowExecute = vi.fn();

vi.mock(
  "~/features/posts/composer/use-cases/create-post.use-case.server",
  () => ({
    CreatePostUseCase: class {
      execute = mockCreatePostExecute;
    },
  })
);

// Handlers import PublishNowUseCase from server (which re-exports from publishing); mock at source
vi.mock(
  "~/features/posts/publishing/use-cases/publish-now.use-case.server",
  () => ({
    PublishNowUseCase: class {
      execute = mockPublishNowExecute;
    },
  })
);

vi.mock("~/features/posts/server", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...(actual as Record<string, unknown>),
    PublishNowUseCase: class {
      execute = mockPublishNowExecute;
    },
  };
});

vi.mock("~/features/posts/services/queue-type-resolver.server", () => ({
  resolveQueueTypeId: vi.fn(),
}));

vi.mock("~/features/upload/s3.server", () => ({
  createUploadHandler: vi.fn(() => vi.fn()),
}));

// Relay resolution (resolveExecutionRelays) uses prisma.user + subscription
vi.mock("~/lib/prisma.server", () => ({
  prisma: {
    user: { findUnique: vi.fn() },
    subscription: { findUnique: vi.fn() },
  },
}));

// Mock global fetch for Nostr publisher
global.fetch = vi.fn();

import { createActionFormData, TEST_USER_ID } from "../utils/test-helpers";

import { handleNewPostAction } from "~/features/posts/server";
import { resolveQueueTypeId } from "~/features/posts/services/queue-type-resolver.server";
import {
  getUserById,
  getQueueTypes,
  getHashTagPresetById,
} from "~/features/user";
import { prisma } from "~/lib/prisma.server";
// Use cases are mocked above

describe("New Post Action Handler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env["NOSTR_PUBLISHER_URL"] =
      "https://api.nostr-publisher.com/publish";

    // Relay resolution (getRelayIntentFromDb, isBlastrEnabledForUserFromDb)
    (prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      userRelays: ["wss://relay1.com", "wss://relay2.com"],
    });
    (
      prisma.subscription.findUnique as ReturnType<typeof vi.fn>
    ).mockResolvedValue({ status: "INACTIVE", Plan: null });

    // Default mocks
    (getUserById as ReturnType<typeof vi.fn>).mockResolvedValue({
      npub: "test-pubkey",
      userRelays: ["wss://relay1.com", "wss://relay2.com"],
      showHashTagsinPosts: true,
    });
    (getQueueTypes as ReturnType<typeof vi.fn>).mockResolvedValue([
      {
        id: "queue-1",
        name: "posts",
        hashTagPreset: { id: "preset-1", tags: "#default #tags" },
      },
    ]);
    (getHashTagPresetById as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "preset-1",
      tags: "#custom #tags",
    });
    mockCreatePostExecute.mockResolvedValue({
      post: {
        id: "post-123",
        signedEvent: {
          id: "event-123",
          pubkey: "test-pubkey",
          created_at: 1234567890,
          kind: 1,
          tags: [],
          content: "test content",
          sig: "test-sig",
        },
      },
      needsScheduling: false,
    });
    mockPublishNowExecute.mockResolvedValue(undefined);
    (resolveQueueTypeId as ReturnType<typeof vi.fn>).mockImplementation(
      // eslint-disable-next-line @typescript-eslint/no-misused-promises -- Test functions can be async
      (userId, queueTypeId, queueType): Promise<string | null> => {
        // Mock behavior: if queueTypeId provided, use it; otherwise resolve from queueType name
        if (queueTypeId) return Promise.resolve(queueTypeId);
        if (queueType === "posts") return Promise.resolve("queue-1");
        return Promise.resolve(null);
      }
    );
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      statusText: "OK",
    });
  });

  describe("Draft Text Action", () => {
    it("should create a draft text post", async () => {
      const formData = createActionFormData("draft-text", {
        content: "This is a draft post",
        queueType: "posts",
        queueTypeId: "queue-1",
      });

      const request = new Request("http://localhost:3000/dashboard/newpost", {
        method: "POST",
        body: formData,
      });

      const result = await handleNewPostAction(TEST_USER_ID, request);

      expect(mockCreatePostExecute).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: TEST_USER_ID,
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- Jest expect matchers have complex types
          content: expect.stringContaining("This is a draft post"),
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- Jest expect matchers have complex types
          caption: expect.stringContaining("This is a draft post"),
          fileUrl: [],
          postType: "TEXT",
          queueTypeId: "queue-1",
          queueType: "posts",
        })
      );
      expect(result).toBeInstanceOf(Response);
      expect(result.status).toBe(302); // Redirect
    });

    it("should apply hashtag preset tags when showHashTagsinPosts is true", async () => {
      (getUserById as ReturnType<typeof vi.fn>).mockResolvedValue({
        npub: "test-pubkey",
        userRelays: ["wss://relay1.com"],
        showHashTagsinPosts: true,
      });

      const formData = createActionFormData("draft-text", {
        content: "Test post",
        queueType: "posts",
        useHashtagPresets: "on",
        hashTagPresetId: "preset-1",
      });

      const request = new Request("http://localhost:3000/dashboard/newpost", {
        method: "POST",
        body: formData,
      });

      await handleNewPostAction(TEST_USER_ID, request);

      expect(mockCreatePostExecute).toHaveBeenCalledWith(
        expect.objectContaining({
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- Jest expect matchers have complex types
          content: expect.stringContaining("#custom #tags"),
        })
      );
    });

    it("should not apply hashtag preset tags when showHashTagsinPosts is false", async () => {
      (getUserById as ReturnType<typeof vi.fn>).mockResolvedValue({
        npub: "test-pubkey",
        userRelays: ["wss://relay1.com"],
        showHashTagsinPosts: false,
      });

      const formData = createActionFormData("draft-text", {
        content: "Test post",
        queueType: "posts",
      });

      const request = new Request("http://localhost:3000/dashboard/newpost", {
        method: "POST",
        body: formData,
      });

      await handleNewPostAction(TEST_USER_ID, request);

      expect(mockCreatePostExecute).toHaveBeenCalledWith(
        expect.objectContaining({
          content: "Test post",
        })
      );
    });

    it("should use queue type default hashtag preset when not manually selected", async () => {
      const formData = createActionFormData("draft-text", {
        content: "Test post",
        queueType: "posts",
        queueTypeId: "queue-1",
      });

      const request = new Request("http://localhost:3000/dashboard/newpost", {
        method: "POST",
        body: formData,
      });

      await handleNewPostAction(TEST_USER_ID, request);

      expect(getQueueTypes).toHaveBeenCalledWith(TEST_USER_ID);
      expect(mockCreatePostExecute).toHaveBeenCalledWith(
        expect.objectContaining({
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- Jest expect matchers have complex types
          content: expect.stringContaining("#default #tags"),
        })
      );
    });
  });

  describe("Post Text Action", () => {
    it("should create and publish a text post immediately", async () => {
      const signedEvent = {
        id: "event-123",
        pubkey: "test-pubkey",
        created_at: 1234567890,
        kind: 1,
        tags: [],
        content: "This is a published post",
        sig: "test-sig",
      };
      const nostrEvent = {
        id: "nostr-123",
        pubkey: "test-pubkey",
        created_at: 1234567890,
        kind: 1,
        content: "test content",
      };

      const formData = createActionFormData("post-text", {
        content: "This is a published post",
        signedEvent: JSON.stringify(signedEvent),
        nostrEvent: JSON.stringify(nostrEvent),
        queueType: "posts",
      });

      const request = new Request("http://localhost:3000/dashboard/newpost", {
        method: "POST",
        body: formData,
      });

      const result = await handleNewPostAction(TEST_USER_ID, request);

      expect(mockCreatePostExecute).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: TEST_USER_ID,
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- Jest expect matchers have complex types
          content: expect.stringContaining("This is a published post"),
          postType: "TEXT",
          signedEvent,
          nostrEvent,
        })
      );
      expect(mockPublishNowExecute).toHaveBeenCalledWith(
        expect.objectContaining({
          postId: "post-123",
          userId: TEST_USER_ID,
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- expect.objectContaining returns any
          signedEvent: expect.objectContaining({
            id: "event-123",
          }),
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- expect.arrayContaining returns any
          relays: expect.arrayContaining([
            "wss://relay1.com",
            "wss://relay2.com",
          ]),
        })
      );
      // Note: fetch is called by PublishNowUseCase internally, but since we're mocking the use case,
      // we don't verify fetch here. The publisher is tested separately.
      expect(result).toBeInstanceOf(Response);
      expect(result.status).toBe(302); // Redirect to /dashboard/published
    });
  });

  describe("Schedule Text Action", () => {
    it("should schedule a text post", async () => {
      const signedEvent = {
        id: "event-123",
        pubkey: "test-pubkey",
        created_at: 1234567890,
        kind: 1,
        tags: [],
        content: "test content",
        sig: "test-sig",
      };
      const nostrEvent = {
        id: "nostr-123",
        pubkey: "test-pubkey",
        created_at: 1234567890,
        kind: 1,
        content: "test content",
      };

      const formData = createActionFormData("schedule-text", {
        content: "This is a scheduled post",
        signedEvent: JSON.stringify(signedEvent),
        nostrEvent: JSON.stringify(nostrEvent),
        queueType: "posts",
      });

      const request = new Request("http://localhost:3000/dashboard/newpost", {
        method: "POST",
        body: formData,
      });

      const result = await handleNewPostAction(TEST_USER_ID, request);

      expect(mockCreatePostExecute).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: TEST_USER_ID,
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- Jest expect matchers have complex types
          content: expect.stringContaining("This is a scheduled post"),
          postType: "TEXT",
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- Jest expect matchers have complex types
          scheduledFor: expect.any(Number),
        })
      );
      expect(global.fetch).not.toHaveBeenCalled(); // Should not publish immediately
      expect(result).toBeInstanceOf(Response);
      expect(result.status).toBe(302); // Redirect to /dashboard/scheduled
    });
  });

  describe("Upload Preview Action", () => {
    it("should return file URLs for valid upload preview", async () => {
      const formData = createActionFormData("upload-images-preview", {
        scheduledFor: "2024-01-01T10:00:00Z",
        caption: "Test caption",
        queueType: "posts",
      });
      // Add files as separate entries (not JSON string)
      formData.append("files", "https://example.com/image1.jpg");
      formData.append("files", "https://example.com/image2.jpg");

      const request = new Request("http://localhost:3000/dashboard/newpost", {
        method: "POST",
        body: formData,
      });

      const result = await handleNewPostAction(TEST_USER_ID, request);
      const dataRaw: unknown = await result.json();
      const data =
        dataRaw && typeof dataRaw === "object" && !Array.isArray(dataRaw)
          ? (dataRaw as {
              success?: unknown;
              fileUrls?: unknown[];
              error?: unknown;
            })
          : {};

      // handleUploadPreview returns Response.json with success and fileUrls
      expect(result.status).toBe(200);
      expect(data).toEqual({
        success: true,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- Jest expect matchers have complex types
        fileUrls: expect.any(Array),
      });
    });

    it("should return error for invalid file URLs", async () => {
      const formData = createActionFormData("upload-images-preview", {
        files: "invalid-url",
        scheduledFor: "2024-01-01T10:00:00Z",
        caption: "Test caption",
        queueType: "posts",
      });

      const request = new Request("http://localhost:3000/dashboard/newpost", {
        method: "POST",
        body: formData,
      });

      const result = await handleNewPostAction(TEST_USER_ID, request);
      const dataRaw: unknown = await result.json();
      const data =
        dataRaw && typeof dataRaw === "object" && !Array.isArray(dataRaw)
          ? (dataRaw as {
              success?: unknown;
              fileUrls?: unknown;
              error?: unknown;
            })
          : {};

      // Zod validation returns 400 with error message
      expect(result.status).toBe(400);
      expect(data).toHaveProperty("error");
      expect(String(data.error)).toBeTruthy();
    });
  });

  describe("Draft Images Action", () => {
    it("should create a draft image post", async () => {
      const fileUrl = JSON.stringify(["https://example.com/image.jpg"]);

      const formData = createActionFormData("draft-image", {
        fileUrl,
        caption: "Draft image caption",
        queueType: "posts",
      });

      const request = new Request("http://localhost:3000/dashboard/newpost", {
        method: "POST",
        body: formData,
      });

      const result = await handleNewPostAction(TEST_USER_ID, request);

      expect(mockCreatePostExecute).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: TEST_USER_ID,
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- Jest expect matchers have complex types
          fileUrl: expect.arrayContaining(["https://example.com/image.jpg"]),
          postType: "IMAGE",
        })
      );
      expect(result).toBeInstanceOf(Response);
      expect(result.status).toBe(302); // Redirect to /dashboard/drafts
    });

    it("should detect video files and set postType to VIDEO", async () => {
      const fileUrl = JSON.stringify(["https://example.com/video.mp4"]);

      const formData = createActionFormData("draft-image", {
        fileUrl,
        caption: "Draft video caption",
        queueType: "posts",
      });

      const request = new Request("http://localhost:3000/dashboard/newpost", {
        method: "POST",
        body: formData,
      });

      await handleNewPostAction(TEST_USER_ID, request);

      expect(mockCreatePostExecute).toHaveBeenCalledWith(
        expect.objectContaining({
          postType: "VIDEO",
        })
      );
    });
  });

  describe("Post Images Action", () => {
    it("should create and publish an image post immediately", async () => {
      const fileUrl = JSON.stringify(["https://example.com/image.jpg"]);
      const signedEvent = {
        id: "event-123",
        pubkey: "test-pubkey",
        created_at: 1234567890,
        kind: 1,
        tags: [],
        content: "test content",
        sig: "test-sig",
      };
      const nostrEvent = {
        id: "nostr-123",
        pubkey: "test-pubkey",
        created_at: 1234567890,
        kind: 1,
        content: "test content",
      };

      const formData = createActionFormData("post-image", {
        fileUrl,
        caption: "Published image caption",
        signedEvent: JSON.stringify(signedEvent),
        nostrEvent: JSON.stringify(nostrEvent),
        queueType: "posts",
      });

      const request = new Request("http://localhost:3000/dashboard/newpost", {
        method: "POST",
        body: formData,
      });

      const result = await handleNewPostAction(TEST_USER_ID, request);

      expect(mockCreatePostExecute).toHaveBeenCalled();
      expect(mockPublishNowExecute).toHaveBeenCalled();
      // Note: fetch is called by PublishNowUseCase internally, but since we're mocking the use case,
      // we don't verify fetch here. The publisher is tested separately.
      expect(result).toBeInstanceOf(Response);
      expect(result.status).toBe(302);
    });
  });

  describe("Schedule Images Action", () => {
    it("should schedule an image post", async () => {
      const fileUrl = JSON.stringify(["https://example.com/image.jpg"]);
      const signedEvent = {
        id: "event-123",
        pubkey: "test-pubkey",
        created_at: 1234567890,
        kind: 1,
        tags: [],
        content: "test content",
        sig: "test-sig",
      };
      const nostrEvent = {
        id: "nostr-123",
        pubkey: "test-pubkey",
        created_at: 1234567890,
        kind: 1,
        content: "test content",
      };

      const formData = createActionFormData("schedule-image", {
        fileUrl,
        caption: "Scheduled image caption",
        signedEvent: JSON.stringify(signedEvent),
        nostrEvent: JSON.stringify(nostrEvent),
        queueType: "posts",
      });

      const request = new Request("http://localhost:3000/dashboard/newpost", {
        method: "POST",
        body: formData,
      });

      const result = await handleNewPostAction(TEST_USER_ID, request);

      expect(mockCreatePostExecute).toHaveBeenCalledWith(
        expect.objectContaining({
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- Jest expect matchers have complex types
          scheduledFor: expect.any(Number),
        })
      );
      expect(global.fetch).not.toHaveBeenCalled(); // Should not publish immediately
      expect(result).toBeInstanceOf(Response);
      expect(result.status).toBe(302);
    });
  });

  describe("Error Handling", () => {
    it("should return error for invalid action", async () => {
      const formData = createActionFormData("invalid-action", {});

      const request = new Request("http://localhost:3000/dashboard/newpost", {
        method: "POST",
        body: formData,
      });

      const result = await handleNewPostAction(TEST_USER_ID, request);
      const dataRaw: unknown = await result.json();
      const data =
        dataRaw && typeof dataRaw === "object" && !Array.isArray(dataRaw)
          ? (dataRaw as {
              success?: unknown;
              fileUrls?: unknown;
              error?: unknown;
            })
          : {};

      // Zod validation fails for invalid action, returns 400 with error
      expect(result.status).toBe(400);
      expect(data).toHaveProperty("error");
    });

    it("should handle database errors", async () => {
      mockCreatePostExecute.mockRejectedValue(new Error("Database error"));

      const formData = createActionFormData("draft-text", {
        content: "Test post",
        queueType: "posts",
      });

      const request = new Request("http://localhost:3000/dashboard/newpost", {
        method: "POST",
        body: formData,
      });

      await expect(handleNewPostAction(TEST_USER_ID, request)).rejects.toThrow(
        "Database error"
      );
    });

    it("should handle Nostr publisher errors", async () => {
      // Mock PublishNowUseCase to throw an error
      mockPublishNowExecute.mockRejectedValue(
        new Error("Failed to post to nostr publisher")
      );

      const signedEvent = {
        id: "event-123",
        pubkey: "test-pubkey",
        created_at: 1234567890,
        kind: 1,
        tags: [],
        content: "test content",
        sig: "test-sig",
      };
      const nostrEvent = {
        id: "nostr-123",
        pubkey: "test-pubkey",
        created_at: 1234567890,
        kind: 1,
        content: "test content",
      };

      const formData = createActionFormData("post-text", {
        content: "Test post",
        signedEvent: JSON.stringify(signedEvent),
        nostrEvent: JSON.stringify(nostrEvent),
        queueType: "posts",
      });

      const request = new Request("http://localhost:3000/dashboard/newpost", {
        method: "POST",
        body: formData,
      });

      await expect(handleNewPostAction(TEST_USER_ID, request)).rejects.toThrow(
        "Failed to post to nostr publisher"
      );
    });
  });

  describe("Queue Type Handling", () => {
    it("should default to 'unassigned' queue type when not provided", async () => {
      const formData = createActionFormData("draft-text", {
        content: "Test post",
      });

      const request = new Request("http://localhost:3000/dashboard/newpost", {
        method: "POST",
        body: formData,
      });

      await handleNewPostAction(TEST_USER_ID, request);

      expect(mockCreatePostExecute).toHaveBeenCalledWith(
        expect.objectContaining({
          queueTypeId: null, // Resolved to null for "unassigned"
          queueType: "unassigned",
        })
      );
    });

    it("should handle recyclable posts", async () => {
      const formData = createActionFormData("draft-text", {
        content: "Recyclable post",
        isRecyclable: "on",
        queueType: "posts",
      });

      const request = new Request("http://localhost:3000/dashboard/newpost", {
        method: "POST",
        body: formData,
      });

      await handleNewPostAction(TEST_USER_ID, request);

      expect(mockCreatePostExecute).toHaveBeenCalledWith(
        expect.objectContaining({
          isRecyclable: true,
        })
      );
    });
  });
});
