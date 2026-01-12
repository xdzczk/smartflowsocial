/**
 * Integration tests for publish action in new longform handler
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

import "./shared-setup";
import {
  TEST_USER_ID,
  createMockQueueType,
  createMockFormData,
} from "../../utils/test-helpers";

import {
  mockPrisma,
  mockCreateLongFormPostExecute,
  mockPublishLongFormNowExecute,
} from "./shared-setup";

import { handleNewLongFormAction } from "~/features/posts/services/newlongform-action.server";
import {
  getUserById,
  getQueueTypeByNameForUser,
  getQueueTypes,
} from "~/features/user";

describe("Publish Action", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env["NOSTR_PUBLISHER_URL"] =
      "https://api.nostr-publisher.com/publish";
    // Mock getUserById - required by handleNewLongFormAction
    (getUserById as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: TEST_USER_ID,
      userRelays: ["wss://relay1.com"],
      showHashTagsinPosts: false,
    });
    (getQueueTypeByNameForUser as ReturnType<typeof vi.fn>).mockResolvedValue(
      createMockQueueType({ id: "queue-1", name: "posts" })
    );
    // Mock getQueueTypes for when useHashtagPresets is "off"
    (getQueueTypes as ReturnType<typeof vi.fn>).mockResolvedValue([
      createMockQueueType({ id: "queue-1", name: "posts" }),
    ]);
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      status: 200,
    });
    mockCreateLongFormPostExecute.mockResolvedValue({
      post: {
        id: "longform-123",
        title: "Test Post",
        isPublished: false,
      },
      needsScheduling: false,
    });
    mockPublishLongFormNowExecute.mockResolvedValue(undefined);
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

    const request = new Request("http://localhost:3000/dashboard/newlongform", {
      method: "POST",
      body: formData,
    });

    const response = await handleNewLongFormAction(TEST_USER_ID, request);

    expect(mockCreateLongFormPostExecute).toHaveBeenCalledWith(
      // expect.objectContaining returns 'any' - acceptable for test mocks
      expect.objectContaining({
        userId: TEST_USER_ID,
        title: "Test Post",
        signedEvent: mockSignedEvent,
        nostrEvent: mockNostrEvent,
      })
    );
    expect(mockPublishLongFormNowExecute).toHaveBeenCalledWith(
      expect.objectContaining({
        postId: "longform-123",
        userId: TEST_USER_ID,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- expect.objectContaining returns any
        signedEvent: expect.objectContaining({
          id: "event-123",
        }),
      })
    );
    // Note: fetch is called by PublishLongFormNowUseCase internally, but since we're mocking the use case,
    // we don't verify fetch here. The publisher is tested separately.
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

    const request = new Request("http://localhost:3000/dashboard/newlongform", {
      method: "POST",
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

    const request = new Request("http://localhost:3000/dashboard/newlongform", {
      method: "POST",
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
    const error = typeof data.error === "string" ? data.error : "";

    expect(response.status).toBe(400);
    expect(error).toBe("Missing Nostr event data for publishing");
  });

  it("should add hashtags to content when enabled", async () => {
    // Mock getUserById with showHashTagsinPosts: true
    (getUserById as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: TEST_USER_ID,
      userRelays: ["wss://relay1.com"],
      showHashTagsinPosts: true, // Enable hashtags
    });
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

    const request = new Request("http://localhost:3000/dashboard/newlongform", {
      method: "POST",
      body: formData,
    });

    await handleNewLongFormAction(TEST_USER_ID, request);

    expect(mockCreateLongFormPostExecute).toHaveBeenCalledWith(
      // expect.objectContaining returns 'any' - acceptable for test mocks
      expect.objectContaining({
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- Jest expect matchers have complex types
        content: expect.stringContaining("#marketing #social"),
      })
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

    // Mock PublishLongFormNowUseCase to throw an error
    mockPublishLongFormNowExecute.mockRejectedValue(
      new Error("Publish failed")
    );

    // Handler catches errors and returns error response, doesn't throw
    const response = await handleNewLongFormAction(TEST_USER_ID, request);
    expect(response.status).toBeGreaterThanOrEqual(400);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- Response.json() returns any
    const data = await response.json();
    expect(data).toHaveProperty("error");
  });
});
