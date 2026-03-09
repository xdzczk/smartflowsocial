/**
 * Integration tests for save draft action in new longform handler
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

import {
  TEST_USER_ID,
  createMockQueueType,
  createMockFormData,
} from "../../utils/test-helpers";

import "./shared-setup";
import { mockPrisma, mockCreateLongFormPostExecute } from "./shared-setup";

import { handleNewLongFormAction } from "~/features/posts/server";
import {
  getQueueTypeByNameForUser,
  getQueueTypes,
  getUserById,
} from "~/features/user";

describe("Save Draft Action", () => {
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
    mockCreateLongFormPostExecute.mockResolvedValue({
      post: {
        id: "longform-123",
        title: "Test Post",
        isPublished: false,
      },
      needsScheduling: false,
    });
  });

  it("should save draft with all required fields", async () => {
    (getQueueTypeByNameForUser as ReturnType<typeof vi.fn>).mockResolvedValue(
      createMockQueueType({ id: "queue-1", name: "posts" })
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
      })
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
    expect(response.status).toBe(400);
    expect(data).toHaveProperty("error");
    expect(String(data.error)).toBeTruthy();
  });

  it("should parse and combine tags", async () => {
    (getQueueTypeByNameForUser as ReturnType<typeof vi.fn>).mockResolvedValue(
      createMockQueueType({ id: "queue-1", name: "posts" })
    );

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

    expect(mockCreateLongFormPostExecute).toHaveBeenCalledWith(
      // expect.objectContaining returns 'any' - acceptable for test mocks
      expect.objectContaining({
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- Jest expect matchers have complex types
        tags: expect.arrayContaining(["tag1", "tag2", "tag3", "tag4"]),
      })
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

    expect(mockCreateLongFormPostExecute).toHaveBeenCalledWith(
      // expect.objectContaining returns 'any' - acceptable for test mocks
      expect.objectContaining({
        queueTypeId: null,
      })
    );
  });
});
