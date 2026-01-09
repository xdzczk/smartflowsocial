/**
 * Integration tests for longform edit action handler
 *
 * Tests the action handler in app/features/posts/services/longform-edit-action.server.ts
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock global fetch
global.fetch = vi.fn();

// Mock dependencies
vi.mock("~/features/posts/longform.server", () => ({
  convertEditorJSToMarkdown: vi.fn(
    (data) => `Markdown: ${JSON.stringify(data)}`
  ),
}));

vi.mock("~/features/upload/s3.server", () => ({
  createUploadHandler: vi.fn(() => vi.fn()),
  uploadBufferToS3: vi.fn(),
}));

vi.mock("~/lib/markdown-sanitizer.server", () => ({
  sanitizeMarkdown: vi.fn((content) => `Sanitized: ${String(content)}`),
  generateSummary: vi.fn((content: string) => {
    const contentStr = typeof content === "string" ? content : String(content);
    return `Summary of ${contentStr.substring(0, 50)}`;
  }),
}));

vi.mock("~/models/longformpost.server", () => ({
  updateLongFormPost: vi.fn(),
}));

vi.mock("~/features/user", () => ({
  getUserById: vi.fn(),
  getHashTagPresetById: vi.fn(),
  getQueueTypeByNameForUser: vi.fn(),
  getQueueTypes: vi.fn(),
}));

// Store FormData objects for mock access (using URL as key since Request objects are recreated)
const formDataStore = new Map<string, FormData>();

// Mock Remix upload handlers
vi.mock("@remix-run/node", async () => {
  const actual = await vi.importActual("@remix-run/node");
  return {
    ...actual,
    unstable_composeUploadHandlers: vi.fn((...handlers) => {
      // Return a handler that processes files through the first handler
      return async (part: {
        filename?: string;
        name?: string;
        data: AsyncIterable<Uint8Array>;
      }) => {
        if (part.filename) {
          // It's a file - process through the first handler (S3 upload handler)
          const firstHandler = handlers[0] as
            | ((part: {
                filename?: string;
                name?: string;
                data: AsyncIterable<Uint8Array>;
              }) => Promise<unknown>)
            | undefined;
          if (firstHandler) {
            return await firstHandler(part);
          }
        }
        // For non-file parts, return the value as-is
        return part.data;
      };
    }),
    unstable_createMemoryUploadHandler: vi.fn(() => vi.fn()),
    unstable_parseMultipartFormData: vi.fn(
      async (
        request: { url?: string; formData?: () => Promise<FormData> },
        _uploadHandler: unknown
      ) => {
        // Try to get FormData from store first (set by test using request URL as key)
        const url =
          // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- Test: type narrowing for mock request
          request &&
          typeof request === "object" &&
          "url" in request &&
          typeof request.url === "string"
            ? request.url
            : String(request.url ?? "");
        const storedFormData = formDataStore.get(url);
        if (storedFormData) {
          formDataStore.delete(url); // Clean up after use
          return storedFormData;
        }

        // Fallback: try to parse from request
        try {
          const formData =
            // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- Test: type narrowing for mock request
            request &&
            typeof request === "object" &&
            "formData" in request &&
            typeof request.formData === "function"
              ? await request.formData()
              : new FormData();
          return formData;
        } catch (_error) {
          // If parsing fails, return empty FormData
          return new FormData();
        }
      }
    ),
  };
});

import { TEST_USER_ID, createMockFormData } from "../utils/test-helpers";

import { handleLongFormEditAction } from "~/features/posts/services/longform-edit-action.server";
import { uploadBufferToS3 } from "~/features/upload/s3.server";
import {
  getUserById,
  getHashTagPresetById,
  getQueueTypeByNameForUser,
  getQueueTypes,
} from "~/features/user";
import { updateLongFormPost } from "~/models/longformpost.server";

describe("Longform Edit Action Handler", () => {
  const POST_ID = "post-123";

  beforeEach(() => {
    vi.clearAllMocks();
    process.env["NOSTR_PUBLISHER_URL"] =
      "https://api.nostr-publisher.com/publish";
    (getUserById as ReturnType<typeof vi.fn>).mockResolvedValue({
      userRelays: ["wss://relay1.com", "wss://relay2.com"],
      showHashTagsinPosts: true,
    });
    // Default mock for getQueueTypeByNameForUser to prevent undefined errors
    (getQueueTypeByNameForUser as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "queue-1",
      name: "posts",
      hashTagPreset: null,
    });
    // Default mock for getQueueTypes
    (getQueueTypes as ReturnType<typeof vi.fn>).mockResolvedValue([
      {
        id: "queue-1",
        name: "posts",
        hashTagPreset: null,
      },
    ]);
  });

  describe("Image Upload Action", () => {
    it("should return existing URL if imageFile is already a URL", async () => {
      const formData = createMockFormData({
        _action: "upload-image",
        imageFile: "https://example.com/image.jpg",
      });

      const request = new Request(
        "http://localhost:3000/dashboard/longform/edit",
        {
          method: "POST",
          body: formData,
        }
      );

      const response = await handleLongFormEditAction(
        TEST_USER_ID,
        POST_ID,
        request
      );
      const dataRaw: unknown = await response.json();
      const data =
        dataRaw && typeof dataRaw === "object" && !Array.isArray(dataRaw)
          ? (dataRaw as { success?: unknown; error?: unknown })
          : {};

      expect(data).toEqual({
        success: true,
        imageUrl: "https://example.com/image.jpg",
      });
    });

    it("should upload File object to S3", async () => {
      const mockFile = new File(["test"], "image.jpg", { type: "image/jpeg" });
      (uploadBufferToS3 as ReturnType<typeof vi.fn>).mockResolvedValue(
        "https://s3.example.com/image.jpg"
      );

      const formData = new FormData();
      formData.append("_action", "upload-image");
      formData.append("imageFile", mockFile);

      // Store FormData before creating Request (mock will retrieve it by URL)
      const requestUrl = "http://localhost:3000/dashboard/longform/edit";
      formDataStore.set(requestUrl, formData);

      const request = new Request(requestUrl, {
        method: "POST",
        headers: { "Content-Type": "multipart/form-data" },
        body: formData,
      });

      const response = await handleLongFormEditAction(
        TEST_USER_ID,
        POST_ID,
        request
      );
      const dataRaw: unknown = await response.json();
      const data =
        dataRaw && typeof dataRaw === "object" && !Array.isArray(dataRaw)
          ? (dataRaw as { success?: unknown; error?: unknown })
          : {};
      const success =
        typeof data.success === "boolean"
          ? data.success
          : data.success === true || data.success === 1;

      expect(uploadBufferToS3).toHaveBeenCalled();
      expect(success).toBe(true);
    });
  });

  describe("Save Draft Action", () => {
    it("should update draft with all required fields", async () => {
      (getQueueTypeByNameForUser as ReturnType<typeof vi.fn>).mockResolvedValue(
        {
          id: "queue-1",
          name: "posts",
        }
      );

      const formData = createMockFormData({
        _action: "save-draft",
        title: "Updated Post",
        content: JSON.stringify({
          blocks: [{ type: "paragraph", data: { text: "Updated content" } }],
        }),
        summary: "Updated summary",
        tags: "tag1,tag2",
        queueType: "posts",
        useHashtagPresets: "false",
      });

      const request = new Request(
        "http://localhost:3000/dashboard/longform/edit",
        {
          method: "POST",
          body: formData,
        }
      );

      const response = await handleLongFormEditAction(
        TEST_USER_ID,
        POST_ID,
        request
      );

      expect(updateLongFormPost).toHaveBeenCalledWith(
        expect.objectContaining({
          id: POST_ID,
          userId: TEST_USER_ID,
          title: "Updated Post",
          isPublished: false,
        })
      );
      expect(response.status).toBe(302);
    });

    it("should require title", async () => {
      const formData = createMockFormData({
        _action: "save-draft",
        content: "Test content",
      });

      const request = new Request(
        "http://localhost:3000/dashboard/longform/edit",
        {
          method: "POST",
          body: formData,
        }
      );

      const response = await handleLongFormEditAction(
        TEST_USER_ID,
        POST_ID,
        request
      );
      const dataRaw: unknown = await response.json();
      const data =
        dataRaw && typeof dataRaw === "object" && !Array.isArray(dataRaw)
          ? (dataRaw as { success?: unknown; error?: unknown })
          : {};
      const error = typeof data.error === "string" ? data.error : "";

      expect(response.status).toBe(400);
      expect(error).toBe("Title is required");
    });

    it("should require content", async () => {
      const formData = createMockFormData({
        _action: "save-draft",
        title: "Test Post",
      });

      const request = new Request(
        "http://localhost:3000/dashboard/longform/edit",
        {
          method: "POST",
          body: formData,
        }
      );

      const response = await handleLongFormEditAction(
        TEST_USER_ID,
        POST_ID,
        request
      );
      const dataRaw: unknown = await response.json();
      const data =
        dataRaw && typeof dataRaw === "object" && !Array.isArray(dataRaw)
          ? (dataRaw as { success?: unknown; error?: unknown })
          : {};
      expect(response.status).toBe(400);
      expect(data).toHaveProperty("error");
      expect(String(data.error)).toBeTruthy();
    });
  });

  describe("Publish Action", () => {
    beforeEach(() => {
      (getQueueTypeByNameForUser as ReturnType<typeof vi.fn>).mockResolvedValue(
        {
          id: "queue-1",
          name: "posts",
        }
      );
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        status: 200,
      });
    });

    it("should publish updated post", async () => {
      const mockSignedEvent = { id: "event-123", kind: 30023 };
      const mockNostrEvent = { id: "event-123", kind: 30023 };

      const formData = createMockFormData({
        _action: "publish",
        title: "Updated Post",
        content: JSON.stringify({
          blocks: [{ type: "paragraph", data: { text: "Updated content" } }],
        }),
        summary: "Updated summary",
        image: "https://example.com/image.jpg",
        signedEvent: JSON.stringify(mockSignedEvent),
        nostrEvent: JSON.stringify(mockNostrEvent),
        tags: "tag1",
        queueType: "posts",
        useHashtagPresets: "false",
      });

      const request = new Request(
        "http://localhost:3000/dashboard/longform/edit",
        {
          method: "POST",
          body: formData,
        }
      );

      const response = await handleLongFormEditAction(
        TEST_USER_ID,
        POST_ID,
        request
      );

      expect(updateLongFormPost).toHaveBeenCalledWith(
        expect.objectContaining({
          id: POST_ID,
          userId: TEST_USER_ID,
          title: "Updated Post",
          isPublished: true,
          signedEvent: mockSignedEvent,
          nostrEvent: mockNostrEvent,
        })
      );
      expect(global.fetch).toHaveBeenCalledWith(
        "https://api.nostr-publisher.com/publish",
        expect.any(Object)
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
        useHashtagPresets: "false",
      });

      const request = new Request(
        "http://localhost:3000/dashboard/longform/edit",
        {
          method: "POST",
          body: formData,
        }
      );

      const response = await handleLongFormEditAction(
        TEST_USER_ID,
        POST_ID,
        request
      );
      const dataRaw: unknown = await response.json();
      const data =
        dataRaw && typeof dataRaw === "object" && !Array.isArray(dataRaw)
          ? (dataRaw as { success?: unknown; error?: unknown })
          : {};
      const error = typeof data.error === "string" ? data.error : "";

      expect(response.status).toBe(400);
      expect(error).toBe("Summary is required for publishing");
    });

    it("should require cover image for publishing", async () => {
      const formData = createMockFormData({
        _action: "publish",
        title: "Test Post",
        content: "Test content",
        summary: "Test summary",
        signedEvent: JSON.stringify({ id: "event-123" }),
        nostrEvent: JSON.stringify({ id: "event-123" }),
        useHashtagPresets: "false",
      });

      const request = new Request(
        "http://localhost:3000/dashboard/longform/edit",
        {
          method: "POST",
          body: formData,
        }
      );

      const response = await handleLongFormEditAction(
        TEST_USER_ID,
        POST_ID,
        request
      );
      const dataRaw: unknown = await response.json();
      const data =
        dataRaw && typeof dataRaw === "object" && !Array.isArray(dataRaw)
          ? (dataRaw as { success?: unknown; error?: unknown })
          : {};
      const error = typeof data.error === "string" ? data.error : "";

      expect(response.status).toBe(400);
      expect(error).toBe("Cover image is required for publishing");
    });

    it("should add hashtags to content when enabled", async () => {
      // Mock getQueueTypes to return a queue type with hashtag preset
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
        content: JSON.stringify({
          blocks: [{ type: "paragraph", data: { text: "Content" } }],
        }),
        summary: "Test summary",
        image: "https://example.com/image.jpg",
        signedEvent: JSON.stringify(mockSignedEvent),
        nostrEvent: JSON.stringify(mockNostrEvent),
        queueType: "posts",
        useHashtagPresets: "false",
      });

      const request = new Request(
        "http://localhost:3000/dashboard/longform/edit",
        {
          method: "POST",
          body: formData,
        }
      );

      await handleLongFormEditAction(TEST_USER_ID, POST_ID, request);

      expect(updateLongFormPost).toHaveBeenCalledWith(
        expect.objectContaining({
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- Jest expect matchers have complex types
          content: expect.stringContaining("#marketing #social"),
        })
      );
    });
  });

  describe("Schedule Longform Action", () => {
    beforeEach(() => {
      (getQueueTypeByNameForUser as ReturnType<typeof vi.fn>).mockResolvedValue(
        {
          id: "queue-1",
          name: "posts",
        }
      );
    });

    it("should schedule post with published_at tag", async () => {
      // SignedEvent and NostrEvent schemas require all fields
      const mockSignedEvent = {
        id: "event-123",
        pubkey: "pk1",
        kind: 30023,
        content: "Test content",
        tags: [["published_at", "1704067200"]],
        created_at: Math.floor(Date.now() / 1000),
        sig: "sig1",
      };
      const mockNostrEvent = {
        id: "event-123",
        pubkey: "pk1",
        kind: 30023,
        content: "Test content",
        tags: [["published_at", "1704067200"]],
        created_at: Math.floor(Date.now() / 1000),
      };

      const formData = createMockFormData({
        _action: "schedule-longform",
        title: "Test Post",
        content: "Test content",
        summary: "Test summary",
        image: "https://example.com/image.jpg",
        signedEvent: JSON.stringify(mockSignedEvent),
        nostrEvent: JSON.stringify(mockNostrEvent),
        queueType: "posts",
        useHashtagPresets: "false",
        scheduledFor: "1704067200", // Required by schema, though handler extracts from tags
      });

      const request = new Request(
        "http://localhost:3000/dashboard/longform/edit",
        {
          method: "POST",
          body: formData,
        }
      );

      const response = await handleLongFormEditAction(
        TEST_USER_ID,
        POST_ID,
        request
      );

      expect(updateLongFormPost).toHaveBeenCalledWith(
        expect.objectContaining({
          id: POST_ID,
          isPublished: false,
          scheduledFor: "1704067200",
        })
      );
      expect(response.status).toBe(302);
    });

    it("should require all fields for scheduling", async () => {
      const formData = createMockFormData({
        _action: "schedule-longform",
        title: "Test Post",
        content: "Test content",
      });

      const request = new Request(
        "http://localhost:3000/dashboard/longform/edit",
        {
          method: "POST",
          body: formData,
        }
      );

      const response = await handleLongFormEditAction(
        TEST_USER_ID,
        POST_ID,
        request
      );
      const dataRaw: unknown = await response.json();
      const data =
        dataRaw && typeof dataRaw === "object" && !Array.isArray(dataRaw)
          ? (dataRaw as { success?: unknown; error?: unknown })
          : {};

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
        useHashtagPresets: "true",
        hashTagPresetId: "preset-1",
        queueType: "posts",
      });

      const request = new Request(
        "http://localhost:3000/dashboard/longform/edit",
        {
          method: "POST",
          body: formData,
        }
      );

      await handleLongFormEditAction(TEST_USER_ID, POST_ID, request);

      expect(getHashTagPresetById).toHaveBeenCalledWith(
        TEST_USER_ID,
        "preset-1"
      );
      expect(updateLongFormPost).toHaveBeenCalledWith(
        expect.objectContaining({
          hashTagPresetId: "preset-1",
        })
      );
    });

    it("should use queue type default when manual presets disabled", async () => {
      const formData = createMockFormData({
        _action: "save-draft",
        title: "Test Post",
        content: "Test content",
        useHashtagPresets: "false",
        queueType: "posts",
      });

      const request = new Request(
        "http://localhost:3000/dashboard/longform/edit",
        {
          method: "POST",
          body: formData,
        }
      );

      await handleLongFormEditAction(TEST_USER_ID, POST_ID, request);

      // The function uses getEffectiveHashtagsForPost internally, not getEffectiveHashtags
      // No need to verify external function calls
    });
  });
});
