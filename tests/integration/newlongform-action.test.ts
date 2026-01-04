/**
 * Integration tests for new longform action handler
 *
 * Tests the action handler in app/features/posts/services/newlongform-action.server.ts
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock global fetch
global.fetch = vi.fn();

// Mock Prisma to prevent $use errors and provide necessary methods
const { mockPrisma } = vi.hoisted(() => {
  const mockPrisma = {
    $use: vi.fn(),
    queueType: {
      findFirst: vi.fn(),
    },
  };
  return { mockPrisma };
});

vi.mock("~/lib/prisma.server", () => ({
  prisma: mockPrisma,
}));

// Mock dependencies
vi.mock("~/features/posts/longform.server", () => ({
  convertEditorJSToMarkdown: vi.fn(
    (data) => `Markdown: ${JSON.stringify(data)}`,
  ),
}));

vi.mock("~/features/upload/s3.server", () => ({
  createUploadHandler: vi.fn(() => vi.fn()),
  uploadBufferToS3: vi.fn(),
}));

vi.mock("~/lib/markdown-sanitizer.server", () => ({
  sanitizeMarkdown: vi.fn((content: string) => `Sanitized: ${content}`),
  generateSummary: vi.fn((content: string) => {
    const contentStr = typeof content === "string" ? content : String(content);
    return `Summary of ${contentStr.substring(0, 50)}`;
  }),
}));

vi.mock("~/models/longformpost.server", () => ({
  createLongFormPost: vi.fn(),
}));

vi.mock("~/features/user", () => ({
  getUserById: vi.fn(),
  getQueueTypes: vi.fn(),
  getHashTagPresetById: vi.fn(),
  getQueueTypeByNameForUser: vi.fn(),
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
        _uploadHandler: unknown,
      ) => {
        // Try to get FormData from store first (set by test using request URL as key)
        const url =
          request &&
          typeof request === "object" &&
          "url" in request &&
          typeof request.url === "string"
            ? request.url
            : String(request?.url ?? "");
        const storedFormData = formDataStore.get(url);
        if (storedFormData) {
          formDataStore.delete(url); // Clean up after use
          return storedFormData;
        }

        // Fallback: try to parse from request
        try {
          const formData =
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
      },
    ),
  };
});

import { handleNewLongFormAction } from "~/features/posts/services/newlongform-action.server";
import { uploadBufferToS3 } from "~/features/upload/s3.server";
import {
  getUserById,
  getQueueTypes,
  getHashTagPresetById,
  getQueueTypeByNameForUser,
} from "~/features/user";
import { createLongFormPost } from "~/models/longformpost.server";

import {
  TEST_USER_ID,
  createMockUser,
  createMockQueueType,
  createMockFormData,
} from "../utils/test-helpers";

describe("New Longform Action Handler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NOSTR_PUBLISHER_URL = "https://api.nostr-publisher.com/publish";
    (getUserById as ReturnType<typeof vi.fn>).mockResolvedValue(
      createMockUser({ userRelays: ["wss://relay1.com", "wss://relay2.com"] }),
    );
    // Default mock for getQueueTypes to prevent undefined errors
    (getQueueTypes as ReturnType<typeof vi.fn>).mockResolvedValue([
      createMockQueueType({ id: "queue-1", name: "posts" }),
      createMockQueueType({ id: "unassigned", name: "Unassigned" }),
    ]);
    (getQueueTypeByNameForUser as ReturnType<typeof vi.fn>).mockResolvedValue(
      createMockQueueType({ id: "queue-1", name: "posts" }),
    );
  });

  describe("Image Upload Action", () => {
    it("should return existing URL if imageFile is already a URL", async () => {
      const formData = createMockFormData({
        _action: "upload-image",
        imageFile: "https://example.com/image.jpg",
      });

      const request = new Request(
        "http://localhost:3000/dashboard/newlongform",
        {
          method: "POST",
          body: formData,
        },
      );

      const response = await handleNewLongFormAction(TEST_USER_ID, request);
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
        "https://s3.example.com/image.jpg",
      );

      const formData = new FormData();
      formData.append("_action", "upload-image");
      formData.append("imageFile", mockFile);

      // Store FormData before creating Request (mock will retrieve it by URL)
      const requestUrl = "http://localhost:3000/dashboard/newlongform";
      formDataStore.set(requestUrl, formData);

      const request = new Request(requestUrl, {
        method: "POST",
        headers: { "Content-Type": "multipart/form-data" },
        body: formData,
      });

      const response = await handleNewLongFormAction(TEST_USER_ID, request);
      const dataRaw: unknown = await response.json();
      const data =
        dataRaw && typeof dataRaw === "object" && !Array.isArray(dataRaw)
          ? (dataRaw as {
              success?: unknown;
              imageUrl?: unknown;
              error?: unknown;
            })
          : {};
      const success =
        typeof data.success === "boolean"
          ? data.success
          : data.success === true || data.success === 1;

      expect(uploadBufferToS3).toHaveBeenCalled();
      expect(success).toBe(true);
      expect(data.imageUrl).toBeDefined();
    });

    it("should handle S3 upload errors", async () => {
      const mockFile = new File(["test"], "image.jpg", { type: "image/jpeg" });
      (uploadBufferToS3 as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error("Upload failed"),
      );

      const formData = new FormData();
      formData.append("_action", "upload-image");
      formData.append("imageFile", mockFile);

      // Store FormData before creating Request (mock will retrieve it by URL)
      const requestUrl = "http://localhost:3000/dashboard/newlongform";
      formDataStore.set(requestUrl, formData);

      const request = new Request(requestUrl, {
        method: "POST",
        headers: { "Content-Type": "multipart/form-data" },
        body: formData,
      });

      const response = await handleNewLongFormAction(TEST_USER_ID, request);
      const dataRaw: unknown = await response.json();
      const data =
        dataRaw && typeof dataRaw === "object" && !Array.isArray(dataRaw)
          ? (dataRaw as {
              success?: unknown;
              imageUrl?: unknown;
              error?: unknown;
            })
          : {};
      const success =
        typeof data.success === "boolean"
          ? data.success
          : data.success === 0 || data.success === false;

      expect(response.status).toBeGreaterThanOrEqual(400);
      expect(success).toBe(false);
    });
  });

  describe("Save Draft Action", () => {
    it("should save draft with all required fields", async () => {
      (getQueueTypeByNameForUser as ReturnType<typeof vi.fn>).mockResolvedValue(
        createMockQueueType({ id: "queue-1", name: "posts" }),
      );
      (
        mockPrisma.queueType.findFirst as ReturnType<typeof vi.fn>
      ).mockResolvedValue({
        id: "queue-1",
      });
      // Mock getQueueTypes for when useHashtagPresets is "off"
      (getQueueTypes as ReturnType<typeof vi.fn>).mockResolvedValue([
        {
          id: "queue-1",
          name: "posts",
          hashTagPreset: null,
        },
      ]);

      const formData = createMockFormData({
        _action: "save-draft",
        title: "Test Post",
        content: JSON.stringify({
          blocks: [{ type: "paragraph", data: { text: "Content" } }],
        }),
        summary: "Test summary",
        tags: "tag1,tag2",
        queueType: "posts",
        useHashtagPresets: "off",
      });

      const request = new Request(
        "http://localhost:3000/dashboard/newlongform",
        {
          method: "POST",
          body: formData,
        },
      );

      const response = await handleNewLongFormAction(TEST_USER_ID, request);

      expect(createLongFormPost).toHaveBeenCalledWith(
        // expect.objectContaining returns 'any' - acceptable for test mocks
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

      const request = new Request(
        "http://localhost:3000/dashboard/newlongform",
        {
          method: "POST",
          body: formData,
        },
      );

      const response = await handleNewLongFormAction(TEST_USER_ID, request);
      const dataRaw: unknown = await response.json();
      const data =
        dataRaw && typeof dataRaw === "object" && !Array.isArray(dataRaw)
          ? (dataRaw as {
              success?: unknown;
              imageUrl?: unknown;
              error?: unknown;
            })
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
        "http://localhost:3000/dashboard/newlongform",
        {
          method: "POST",
          body: formData,
        },
      );

      const response = await handleNewLongFormAction(TEST_USER_ID, request);
      const dataRaw: unknown = await response.json();
      const data =
        dataRaw && typeof dataRaw === "object" && !Array.isArray(dataRaw)
          ? (dataRaw as {
              success?: unknown;
              imageUrl?: unknown;
              error?: unknown;
            })
          : {};
      expect(response.status).toBe(400);
      expect(data).toHaveProperty("error");
      expect(String(data.error)).toBeTruthy();
    });

    it("should parse and combine tags", async () => {
      (getQueueTypeByNameForUser as ReturnType<typeof vi.fn>).mockResolvedValue(
        createMockQueueType({ id: "queue-1", name: "posts" }),
      );

      const formData = createMockFormData({
        _action: "save-draft",
        title: "Test Post",
        content: "Test content",
        tags: "tag1,tag2",
        customTags: "tag3,tag4",
      });

      const request = new Request(
        "http://localhost:3000/dashboard/newlongform",
        {
          method: "POST",
          body: formData,
        },
      );

      await handleNewLongFormAction(TEST_USER_ID, request);

      expect(createLongFormPost).toHaveBeenCalledWith(
        // expect.objectContaining returns 'any' - acceptable for test mocks
        expect.objectContaining({
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
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

      const request = new Request(
        "http://localhost:3000/dashboard/newlongform",
        {
          method: "POST",
          body: formData,
        },
      );

      await handleNewLongFormAction(TEST_USER_ID, request);

      expect(createLongFormPost).toHaveBeenCalledWith(
        // expect.objectContaining returns 'any' - acceptable for test mocks
        expect.objectContaining({
          queueTypeId: null,
        }),
      );
    });
  });

  describe("Publish Action", () => {
    beforeEach(() => {
      (getQueueTypeByNameForUser as ReturnType<typeof vi.fn>).mockResolvedValue(
        createMockQueueType({ id: "queue-1", name: "posts" }),
      );
      // Mock getQueueTypes for when useHashtagPresets is "off"
      (getQueueTypes as ReturnType<typeof vi.fn>).mockResolvedValue([
        createMockQueueType({ id: "queue-1", name: "posts" }),
      ]);
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        status: 200,
      });
    });

    it("should publish post with all required fields", async () => {
      (
        mockPrisma.queueType.findFirst as ReturnType<typeof vi.fn>
      ).mockResolvedValue({
        id: "queue-1",
      });
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
        tags: "tag1",
        queueType: "posts",
        useHashtagPresets: "off",
      });

      const request = new Request(
        "http://localhost:3000/dashboard/newlongform",
        {
          method: "POST",
          body: formData,
        },
      );

      const response = await handleNewLongFormAction(TEST_USER_ID, request);

      expect(createLongFormPost).toHaveBeenCalledWith(
        // expect.objectContaining returns 'any' - acceptable for test mocks
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

      const request = new Request(
        "http://localhost:3000/dashboard/newlongform",
        {
          method: "POST",
          body: formData,
        },
      );

      const response = await handleNewLongFormAction(TEST_USER_ID, request);
      const dataRaw: unknown = await response.json();
      const data =
        dataRaw && typeof dataRaw === "object" && !Array.isArray(dataRaw)
          ? (dataRaw as {
              success?: unknown;
              imageUrl?: unknown;
              error?: unknown;
            })
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
      });

      const request = new Request(
        "http://localhost:3000/dashboard/newlongform",
        {
          method: "POST",
          body: formData,
        },
      );

      const response = await handleNewLongFormAction(TEST_USER_ID, request);
      const dataRaw: unknown = await response.json();
      const data =
        dataRaw && typeof dataRaw === "object" && !Array.isArray(dataRaw)
          ? (dataRaw as {
              success?: unknown;
              imageUrl?: unknown;
              error?: unknown;
            })
          : {};
      const error = typeof data.error === "string" ? data.error : "";

      expect(response.status).toBe(400);
      expect(error).toBe("Cover image is required for publishing");
    });

    it("should require Nostr event data", async () => {
      const formData = createMockFormData({
        _action: "publish",
        title: "Test Post",
        content: "Test content",
        summary: "Test summary",
        image: "https://example.com/image.jpg",
      });

      const request = new Request(
        "http://localhost:3000/dashboard/newlongform",
        {
          method: "POST",
          body: formData,
        },
      );

      const response = await handleNewLongFormAction(TEST_USER_ID, request);
      const dataRaw: unknown = await response.json();
      const data =
        dataRaw && typeof dataRaw === "object" && !Array.isArray(dataRaw)
          ? (dataRaw as {
              success?: unknown;
              imageUrl?: unknown;
              error?: unknown;
            })
          : {};
      const error = typeof data.error === "string" ? data.error : "";

      expect(response.status).toBe(400);
      expect(error).toBe("Missing Nostr event data for publishing");
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
        content: JSON.stringify({
          blocks: [{ type: "paragraph", data: { text: "Content" } }],
        }),
        summary: "Test summary",
        image: "https://example.com/image.jpg",
        signedEvent: JSON.stringify(mockSignedEvent),
        nostrEvent: JSON.stringify(mockNostrEvent),
        queueType: "posts",
        useHashtagPresets: "off",
      });

      const request = new Request(
        "http://localhost:3000/dashboard/newlongform",
        {
          method: "POST",
          body: formData,
        },
      );

      await handleNewLongFormAction(TEST_USER_ID, request);

      expect(createLongFormPost).toHaveBeenCalledWith(
        // expect.objectContaining returns 'any' - acceptable for test mocks
        expect.objectContaining({
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
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

      const request = new Request(
        "http://localhost:3000/dashboard/newlongform",
        {
          method: "POST",
          body: formData,
        },
      );

      await expect(
        handleNewLongFormAction(TEST_USER_ID, request),
      ).rejects.toThrow();
    });
  });

  describe("Schedule Longform Action", () => {
    beforeEach(() => {
      (getQueueTypeByNameForUser as ReturnType<typeof vi.fn>).mockResolvedValue(
        createMockQueueType({ id: "queue-1", name: "posts" }),
      );
    });

    it("should schedule post with published_at tag", async () => {
      (
        mockPrisma.queueType.findFirst as ReturnType<typeof vi.fn>
      ).mockResolvedValue({
        id: "queue-1",
      });
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
        scheduledFor: "1704067200", // Required by schema, though handler extracts from tags
      });

      const request = new Request(
        "http://localhost:3000/dashboard/newlongform",
        {
          method: "POST",
          body: formData,
        },
      );

      const response = await handleNewLongFormAction(TEST_USER_ID, request);

      expect(createLongFormPost).toHaveBeenCalledWith(
        // expect.objectContaining returns 'any' - acceptable for test mocks
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

      const request = new Request(
        "http://localhost:3000/dashboard/newlongform",
        {
          method: "POST",
          body: formData,
        },
      );

      const response = await handleNewLongFormAction(TEST_USER_ID, request);
      const dataRaw: unknown = await response.json();
      const data =
        dataRaw && typeof dataRaw === "object" && !Array.isArray(dataRaw)
          ? (dataRaw as {
              success?: unknown;
              imageUrl?: unknown;
              error?: unknown;
            })
          : {};

      expect(response.status).toBe(400);
      expect(data.error).toBeDefined();
    });
  });

  describe("Hashtag Preset Handling", () => {
    it("should use manual hashtag preset when enabled", async () => {
      (
        mockPrisma.queueType.findFirst as ReturnType<typeof vi.fn>
      ).mockResolvedValue({
        id: "queue-1",
      });
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

      const request = new Request(
        "http://localhost:3000/dashboard/newlongform",
        {
          method: "POST",
          body: formData,
        },
      );

      await handleNewLongFormAction(TEST_USER_ID, request);

      expect(getHashTagPresetById).toHaveBeenCalledWith(
        TEST_USER_ID,
        "preset-1",
      );
      expect(createLongFormPost).toHaveBeenCalledWith(
        // expect.objectContaining returns 'any' - acceptable for test mocks
        expect.objectContaining({
          hashTagPresetId: "preset-1",
        }),
      );
    });

    it("should use queue type default when manual presets disabled", async () => {
      (
        mockPrisma.queueType.findFirst as ReturnType<typeof vi.fn>
      ).mockResolvedValue({
        id: "queue-1",
      });
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

      const request = new Request(
        "http://localhost:3000/dashboard/newlongform",
        {
          method: "POST",
          body: formData,
        },
      );

      await handleNewLongFormAction(TEST_USER_ID, request);

      expect(getQueueTypes).toHaveBeenCalledWith(TEST_USER_ID);
      expect(createLongFormPost).toHaveBeenCalledWith(
        // expect.objectContaining returns 'any' - acceptable for test mocks
        expect.objectContaining({
          hashTagPresetId: "preset-1",
        }),
      );
    });
  });
});
