/**
 * Integration tests for new longform action handler
 * 
 * Tests the action handler in app/features/posts/services/newlongform-action.server.ts
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { redirect } from "@remix-run/node";

// Mock global fetch
global.fetch = vi.fn();

// Mock dependencies
vi.mock("~/features/posts/longform.server", () => ({
  convertEditorJSToMarkdown: vi.fn((data) => `Markdown: ${JSON.stringify(data)}`),
}));

vi.mock("~/features/upload/s3.server", () => ({
  createUploadHandler: vi.fn(() => vi.fn()),
  uploadBufferToS3: vi.fn(),
}));

vi.mock("~/lib/markdown-sanitizer.server", () => ({
  sanitizeMarkdown: vi.fn((content) => `Sanitized: ${content}`),
  generateSummary: vi.fn((content) => `Summary of ${content.substring(0, 50)}`),
}));

vi.mock("~/models/longformpost.server", () => ({
  createLongFormPost: vi.fn(),
}));

vi.mock("~/models/user.server", () => ({
  getUserById: vi.fn(),
  getQueueTypes: vi.fn(),
  getHashTagPresetById: vi.fn(),
  getQueueTypeByNameForUser: vi.fn(),
}));

// Mock Remix upload handlers
vi.mock("@remix-run/node", async () => {
  const actual = await vi.importActual("@remix-run/node");
  return {
    ...actual,
    unstable_composeUploadHandlers: vi.fn((...handlers) => vi.fn()),
    unstable_createMemoryUploadHandler: vi.fn(() => vi.fn()),
    unstable_parseMultipartFormData: vi.fn(async (request, handler) => {
      return new FormData();
    }),
  };
});

import { handleNewLongFormAction } from "~/features/posts/services/newlongform-action.server";
import { createLongFormPost } from "~/models/longformpost.server";
import { getUserById, getQueueTypes, getHashTagPresetById, getQueueTypeByNameForUser } from "~/models/user.server";
import { uploadBufferToS3 } from "~/features/upload/s3.server";
import { TEST_USER_ID } from "../utils/test-helpers";
import { createMockFormData } from "../utils/test-helpers";

describe("New Longform Action Handler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NOSTR_PUBLISHER_URL = "https://api.nostr-publisher.com/publish";
    (getUserById as ReturnType<typeof vi.fn>).mockResolvedValue({
      userRelays: ["wss://relay1.com", "wss://relay2.com"],
      showHashTagsinPosts: true,
    });
  });

  describe("Image Upload Action", () => {
    it("should return existing URL if imageFile is already a URL", async () => {
      const formData = createMockFormData({
        _action: "upload-image",
        imageFile: "https://example.com/image.jpg",
      });

      const request = new Request("http://localhost:3000/dashboard/newlongform", {
        method: "POST",
        body: formData,
      });

      const response = await handleNewLongFormAction(TEST_USER_ID, request);
      const data = await response.json();

      expect(data).toEqual({
        success: true,
        imageUrl: "https://example.com/image.jpg",
      });
    });

    it("should upload File object to S3", async () => {
      const mockFile = new File(["test"], "image.jpg", { type: "image/jpeg" });
      (uploadBufferToS3 as ReturnType<typeof vi.fn>).mockResolvedValue("https://s3.example.com/image.jpg");

      const formData = new FormData();
      formData.append("_action", "upload-image");
      formData.append("imageFile", mockFile);

      const request = new Request("http://localhost:3000/dashboard/newlongform", {
        method: "POST",
        headers: { "Content-Type": "multipart/form-data" },
        body: formData,
      });

      const response = await handleNewLongFormAction(TEST_USER_ID, request);
      const data = await response.json();

      expect(uploadBufferToS3).toHaveBeenCalled();
      expect(data.success).toBe(true);
      expect(data.imageUrl).toBeDefined();
    });

    it("should handle S3 upload errors", async () => {
      const mockFile = new File(["test"], "image.jpg", { type: "image/jpeg" });
      (uploadBufferToS3 as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("Upload failed"));

      const formData = new FormData();
      formData.append("_action", "upload-image");
      formData.append("imageFile", mockFile);

      const request = new Request("http://localhost:3000/dashboard/newlongform", {
        method: "POST",
        headers: { "Content-Type": "multipart/form-data" },
        body: formData,
      });

      const response = await handleNewLongFormAction(TEST_USER_ID, request);
      const data = await response.json();

      expect(response.status).toBeGreaterThanOrEqual(400);
      expect(data.success).toBe(false);
    });
  });

  describe("Save Draft Action", () => {
    it("should save draft with all required fields", async () => {
      (getQueueTypeByNameForUser as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: "queue-1",
        name: "posts",
      });

      const formData = createMockFormData({
        _action: "save-draft",
        title: "Test Post",
        content: JSON.stringify({ blocks: [{ type: "paragraph", data: { text: "Content" } }] }),
        summary: "Test summary",
        tags: "tag1,tag2",
        queueType: "posts",
        useHashtagPresets: "off",
      });

      const request = new Request("http://localhost:3000/dashboard/newlongform", {
        method: "POST",
        body: formData,
      });

      const response = await handleNewLongFormAction(TEST_USER_ID, request);

      expect(createLongFormPost).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: TEST_USER_ID,
          title: "Test Post",
          isPublished: false,
        }),
      );
      expect(response.status).toBe(302); // Redirect
    });

    it("should require title", async () => {
      const formData = createMockFormData({
        _action: "save-draft",
        content: "Test content",
      });

      const request = new Request("http://localhost:3000/dashboard/newlongform", {
        method: "POST",
        body: formData,
      });

      const response = await handleNewLongFormAction(TEST_USER_ID, request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Title is required");
    });

    it("should require content", async () => {
      const formData = createMockFormData({
        _action: "save-draft",
        title: "Test Post",
      });

      const request = new Request("http://localhost:3000/dashboard/newlongform", {
        method: "POST",
        body: formData,
      });

      const response = await handleNewLongFormAction(TEST_USER_ID, request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Content is required");
    });

    it("should parse and combine tags", async () => {
      (getQueueTypeByNameForUser as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: "queue-1",
        name: "posts",
      });

      const formData = createMockFormData({
        _action: "save-draft",
        title: "Test Post",
        content: "Test content",
        tags: "tag1,tag2",
        customTags: "tag3,tag4",
      });

      const request = new Request("http://localhost:3000/dashboard/newlongform", {
        method: "POST",
        body: formData,
      });

      await handleNewLongFormAction(TEST_USER_ID, request);

      expect(createLongFormPost).toHaveBeenCalledWith(
        expect.objectContaining({
          tags: expect.arrayContaining(["tag1", "tag2", "tag3", "tag4"]),
        }),
      );
    });

    it("should handle unassigned queue type", async () => {
      const formData = createMockFormData({
        _action: "save-draft",
        title: "Test Post",
        content: "Test content",
        queueType: "Unassigned",
      });

      const request = new Request("http://localhost:3000/dashboard/newlongform", {
        method: "POST",
        body: formData,
      });

      await handleNewLongFormAction(TEST_USER_ID, request);

      expect(createLongFormPost).toHaveBeenCalledWith(
        expect.objectContaining({
          queueTypeId: null,
        }),
      );
    });
  });

  describe("Publish Action", () => {
    beforeEach(() => {
      (getQueueTypeByNameForUser as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: "queue-1",
        name: "posts",
      });
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        status: 200,
      });
    });

    it("should publish post with all required fields", async () => {
      const mockSignedEvent = { id: "event-123", kind: 30023 };
      const mockNostrEvent = { id: "event-123", kind: 30023 };

      const formData = createMockFormData({
        _action: "publish",
        title: "Test Post",
        content: JSON.stringify({ blocks: [{ type: "paragraph", data: { text: "Content" } }] }),
        summary: "Test summary",
        image: "https://example.com/image.jpg",
        signedEvent: JSON.stringify(mockSignedEvent),
        nostrEvent: JSON.stringify(mockNostrEvent),
        tags: "tag1",
        queueType: "posts",
        useHashtagPresets: "off",
      });

      const request = new Request("http://localhost:3000/dashboard/newlongform", {
        method: "POST",
        body: formData,
      });

      const response = await handleNewLongFormAction(TEST_USER_ID, request);

      expect(createLongFormPost).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: TEST_USER_ID,
          title: "Test Post",
          isPublished: true,
          signedEvent: mockSignedEvent,
          nostrEvent: mockNostrEvent,
        }),
      );
      expect(global.fetch).toHaveBeenCalledWith(
        "https://api.nostr-publisher.com/publish",
        expect.any(Object),
      );
      expect(response.status).toBe(302);
    });

    it("should require summary for publishing", async () => {
      const formData = createMockFormData({
        _action: "publish",
        title: "Test Post",
        content: "Test content",
        image: "https://example.com/image.jpg",
        signedEvent: JSON.stringify({ id: "event-123" }),
        nostrEvent: JSON.stringify({ id: "event-123" }),
      });

      const request = new Request("http://localhost:3000/dashboard/newlongform", {
        method: "POST",
        body: formData,
      });

      const response = await handleNewLongFormAction(TEST_USER_ID, request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Summary is required for publishing");
    });

    it("should require cover image for publishing", async () => {
      const formData = createMockFormData({
        _action: "publish",
        title: "Test Post",
        content: "Test content",
        summary: "Test summary",
        signedEvent: JSON.stringify({ id: "event-123" }),
        nostrEvent: JSON.stringify({ id: "event-123" }),
      });

      const request = new Request("http://localhost:3000/dashboard/newlongform", {
        method: "POST",
        body: formData,
      });

      const response = await handleNewLongFormAction(TEST_USER_ID, request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Cover image is required for publishing");
    });

    it("should require Nostr event data", async () => {
      const formData = createMockFormData({
        _action: "publish",
        title: "Test Post",
        content: "Test content",
        summary: "Test summary",
        image: "https://example.com/image.jpg",
      });

      const request = new Request("http://localhost:3000/dashboard/newlongform", {
        method: "POST",
        body: formData,
      });

      const response = await handleNewLongFormAction(TEST_USER_ID, request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Missing Nostr event data for publishing");
    });

    it("should add hashtags to content when enabled", async () => {
      (getQueueTypes as ReturnType<typeof vi.fn>).mockResolvedValue([
        {
          id: "queue-1",
          name: "posts",
          hashTagPreset: {
            id: "preset-1",
            tags: "#marketing #social",
          },
        },
      ]);

      const mockSignedEvent = { id: "event-123", kind: 30023 };
      const mockNostrEvent = { id: "event-123", kind: 30023 };

      const formData = createMockFormData({
        _action: "publish",
        title: "Test Post",
        content: JSON.stringify({ blocks: [{ type: "paragraph", data: { text: "Content" } }] }),
        summary: "Test summary",
        image: "https://example.com/image.jpg",
        signedEvent: JSON.stringify(mockSignedEvent),
        nostrEvent: JSON.stringify(mockNostrEvent),
        queueType: "posts",
        useHashtagPresets: "off",
      });

      const request = new Request("http://localhost:3000/dashboard/newlongform", {
        method: "POST",
        body: formData,
      });

      await handleNewLongFormAction(TEST_USER_ID, request);

      expect(createLongFormPost).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.stringContaining("#marketing #social"),
        }),
      );
    });

    it("should handle publish errors", async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
      });

      const mockSignedEvent = { id: "event-123", kind: 30023 };
      const mockNostrEvent = { id: "event-123", kind: 30023 };

      const formData = createMockFormData({
        _action: "publish",
        title: "Test Post",
        content: "Test content",
        summary: "Test summary",
        image: "https://example.com/image.jpg",
        signedEvent: JSON.stringify(mockSignedEvent),
        nostrEvent: JSON.stringify(mockNostrEvent),
      });

      const request = new Request("http://localhost:3000/dashboard/newlongform", {
        method: "POST",
        body: formData,
      });

      await expect(handleNewLongFormAction(TEST_USER_ID, request)).rejects.toThrow();
    });
  });

  describe("Schedule Longform Action", () => {
    beforeEach(() => {
      (getQueueTypeByNameForUser as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: "queue-1",
        name: "posts",
      });
    });

    it("should schedule post with published_at tag", async () => {
      const mockSignedEvent = {
        id: "event-123",
        kind: 30023,
        tags: [["published_at", "1704067200"]],
      };
      const mockNostrEvent = { id: "event-123", kind: 30023 };

      const formData = createMockFormData({
        _action: "schedule-longform",
        title: "Test Post",
        content: "Test content",
        summary: "Test summary",
        image: "https://example.com/image.jpg",
        signedEvent: JSON.stringify(mockSignedEvent),
        nostrEvent: JSON.stringify(mockNostrEvent),
        queueType: "posts",
        useHashtagPresets: "off",
      });

      const request = new Request("http://localhost:3000/dashboard/newlongform", {
        method: "POST",
        body: formData,
      });

      const response = await handleNewLongFormAction(TEST_USER_ID, request);

      expect(createLongFormPost).toHaveBeenCalledWith(
        expect.objectContaining({
          isPublished: false,
          scheduledFor: "1704067200",
        }),
      );
      expect(response.status).toBe(302);
    });

    it("should require all fields for scheduling", async () => {
      const formData = createMockFormData({
        _action: "schedule-longform",
        title: "Test Post",
        content: "Test content",
      });

      const request = new Request("http://localhost:3000/dashboard/newlongform", {
        method: "POST",
        body: formData,
      });

      const response = await handleNewLongFormAction(TEST_USER_ID, request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBeDefined();
    });
  });

  describe("Hashtag Preset Handling", () => {
    it("should use manual hashtag preset when enabled", async () => {
      (getHashTagPresetById as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: "preset-1",
        tags: "#custom #tags",
      });

      const formData = createMockFormData({
        _action: "save-draft",
        title: "Test Post",
        content: "Test content",
        useHashtagPresets: "on",
        hashTagPresetId: "preset-1",
        queueType: "posts",
      });

      const request = new Request("http://localhost:3000/dashboard/newlongform", {
        method: "POST",
        body: formData,
      });

      await handleNewLongFormAction(TEST_USER_ID, request);

      expect(getHashTagPresetById).toHaveBeenCalledWith(TEST_USER_ID, "preset-1");
      expect(createLongFormPost).toHaveBeenCalledWith(
        expect.objectContaining({
          hashTagPresetId: "preset-1",
        }),
      );
    });

    it("should use queue type default when manual presets disabled", async () => {
      (getQueueTypes as ReturnType<typeof vi.fn>).mockResolvedValue([
        {
          id: "queue-1",
          name: "posts",
          hashTagPreset: {
            id: "preset-1",
            tags: "#queue #tags",
          },
        },
      ]);

      const formData = createMockFormData({
        _action: "save-draft",
        title: "Test Post",
        content: "Test content",
        useHashtagPresets: "off",
        queueType: "posts",
      });

      const request = new Request("http://localhost:3000/dashboard/newlongform", {
        method: "POST",
        body: formData,
      });

      await handleNewLongFormAction(TEST_USER_ID, request);

      expect(getQueueTypes).toHaveBeenCalledWith(TEST_USER_ID);
      expect(createLongFormPost).toHaveBeenCalledWith(
        expect.objectContaining({
          hashTagPresetId: "preset-1",
        }),
      );
    });
  });
});

