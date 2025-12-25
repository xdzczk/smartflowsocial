/**
 * Integration tests for new post action handlers
 * 
 * Tests the action handler logic directly, without requiring a browser.
 * For UI interaction tests, see cypress/e2e/posts/new-post.cy.ts
 * 
 * Note: This tests the core logic. File uploads are tested separately.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { redirect } from "@remix-run/node";

// Mock dependencies
vi.mock("~/models/user.server", () => ({
  getUserById: vi.fn(),
  getQueueTypes: vi.fn(),
  getHashTagPresetById: vi.fn(),
}));

vi.mock("~/models/post.server", () => ({
  createPost: vi.fn(),
}));

vi.mock("~/features/upload/s3.server", () => ({
  createUploadHandler: vi.fn(() => vi.fn()),
}));

// Mock global fetch for Nostr publisher
global.fetch = vi.fn();

import { getUserById, getQueueTypes, getHashTagPresetById } from "~/models/user.server";
import { createPost } from "~/models/post.server";
import { handleNewPostAction } from "~/features/posts/services/newpost-action.server";
import { createActionFormData, createFormData, TEST_USER_ID } from "../utils/test-helpers";

describe("New Post Action Handler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NOSTR_PUBLISHER_URL = "https://api.nostr-publisher.com/publish";
    
    // Default mocks
    (getUserById as ReturnType<typeof vi.fn>).mockResolvedValue({
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
    (createPost as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "post-123",
      signedEvent: { id: "event-123" },
    });
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

      expect(createPost).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: TEST_USER_ID,
          content: expect.stringContaining("This is a draft post"),
          caption: expect.stringContaining("This is a draft post"),
          fileUrl: [],
          isScheduled: false,
          isPosted: false,
          postType: "TEXT",
          draft: true,
          queueType: "posts",
          queueTypeId: "queue-1",
        }),
      );
      expect(result).toBeInstanceOf(Response);
      expect(result.status).toBe(302); // Redirect
    });

    it("should apply hashtag preset tags when showHashTagsinPosts is true", async () => {
      (getUserById as ReturnType<typeof vi.fn>).mockResolvedValue({
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

      expect(createPost).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.stringContaining("#custom #tags"),
        }),
      );
    });

    it("should not apply hashtag preset tags when showHashTagsinPosts is false", async () => {
      (getUserById as ReturnType<typeof vi.fn>).mockResolvedValue({
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

      expect(createPost).toHaveBeenCalledWith(
        expect.objectContaining({
          content: "Test post",
        }),
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
      expect(createPost).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.stringContaining("#default #tags"),
        }),
      );
    });
  });

  describe("Post Text Action", () => {
    it("should create and publish a text post immediately", async () => {
      const signedEvent = { id: "event-123", created_at: 1234567890 };
      const nostrEvent = { id: "nostr-123" };

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

      expect(createPost).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: TEST_USER_ID,
          content: expect.stringContaining("This is a published post"),
          isScheduled: false,
          isPosted: true,
          signedEvent,
          nostrEvent,
        }),
      );
      expect(global.fetch).toHaveBeenCalledWith(
        "https://api.nostr-publisher.com/publish",
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining("event-123"),
        }),
      );
      expect(result).toBeInstanceOf(Response);
      expect(result.status).toBe(302); // Redirect to /dashboard/posted
    });
  });

  describe("Schedule Text Action", () => {
    it("should schedule a text post", async () => {
      const signedEvent = { id: "event-123", created_at: 1234567890 };
      const nostrEvent = { id: "nostr-123" };

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

      expect(createPost).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: TEST_USER_ID,
          content: expect.stringContaining("This is a scheduled post"),
          isScheduled: true,
          isPosted: false,
          scheduledFor: expect.any(Number),
        }),
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
      const data = await result.json();

      // handleUploadPreview returns Response.json with success and fileUrls
      expect(result.status).toBe(200);
      expect(data).toEqual({
        success: true,
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
      const data = await result.json();

      expect(result.status).toBe(400);
      expect(data).toEqual({
        success: false,
        error: expect.any(String),
      });
    });
  });

  describe("Draft Images Action", () => {
    it("should create a draft image post", async () => {
      const fileUrl = JSON.stringify(["https://example.com/image.jpg"]);

      const formData = createActionFormData("draft-images", {
        fileUrl,
        caption: "Draft image caption",
        queueType: "posts",
      });

      const request = new Request("http://localhost:3000/dashboard/newpost", {
        method: "POST",
        body: formData,
      });

      const result = await handleNewPostAction(TEST_USER_ID, request);

      expect(createPost).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: TEST_USER_ID,
          fileUrl: expect.arrayContaining(["https://example.com/image.jpg"]),
          postType: "IMAGE",
          draft: true,
          isScheduled: false,
          isPosted: false,
        }),
      );
      expect(result).toBeInstanceOf(Response);
      expect(result.status).toBe(302); // Redirect to /dashboard/drafts
    });

    it("should detect video files and set postType to VIDEO", async () => {
      const fileUrl = JSON.stringify(["https://example.com/video.mp4"]);

      const formData = createActionFormData("draft-media", {
        fileUrl,
        caption: "Draft video caption",
        queueType: "posts",
      });

      const request = new Request("http://localhost:3000/dashboard/newpost", {
        method: "POST",
        body: formData,
      });

      await handleNewPostAction(TEST_USER_ID, request);

      expect(createPost).toHaveBeenCalledWith(
        expect.objectContaining({
          postType: "VIDEO",
        }),
      );
    });
  });

  describe("Post Images Action", () => {
    it("should create and publish an image post immediately", async () => {
      const fileUrl = JSON.stringify(["https://example.com/image.jpg"]);
      const signedEvent = { id: "event-123", created_at: 1234567890 };
      const nostrEvent = { id: "nostr-123" };

      const formData = createActionFormData("post-images", {
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

      expect(createPost).toHaveBeenCalledWith(
        expect.objectContaining({
          isPosted: true,
          isScheduled: false,
        }),
      );
      expect(global.fetch).toHaveBeenCalled(); // Should publish to Nostr
      expect(result).toBeInstanceOf(Response);
      expect(result.status).toBe(302);
    });
  });

  describe("Schedule Images Action", () => {
    it("should schedule an image post", async () => {
      const fileUrl = JSON.stringify(["https://example.com/image.jpg"]);
      const signedEvent = { id: "event-123", created_at: 1234567890 };
      const nostrEvent = { id: "nostr-123" };

      const formData = createActionFormData("schedule-images", {
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

      expect(createPost).toHaveBeenCalledWith(
        expect.objectContaining({
          isScheduled: true,
          isPosted: false,
        }),
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
      const data = await result.json();

      expect(result.status).toBe(200);
      expect(data).toEqual({ success: false });
    });

    it("should handle database errors", async () => {
      (createPost as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error("Database error"),
      );

      const formData = createActionFormData("draft-text", {
        content: "Test post",
        queueType: "posts",
      });

      const request = new Request("http://localhost:3000/dashboard/newpost", {
        method: "POST",
        body: formData,
      });

      await expect(
        handleNewPostAction(TEST_USER_ID, request),
      ).rejects.toThrow("Database error");
    });

    it("should handle Nostr publisher errors", async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: false,
        statusText: "Internal Server Error",
      });

      const signedEvent = { id: "event-123", created_at: 1234567890 };
      const nostrEvent = { id: "nostr-123" };

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

      await expect(
        handleNewPostAction(TEST_USER_ID, request),
      ).rejects.toThrow("Failed to post to nostr publisher");
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

      expect(createPost).toHaveBeenCalledWith(
        expect.objectContaining({
          queueType: "unassigned",
          queueTypeId: null,
        }),
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

      expect(createPost).toHaveBeenCalledWith(
        expect.objectContaining({
          isRecyclable: true,
        }),
      );
    });
  });
});

