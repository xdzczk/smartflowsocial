/**
 * Integration tests for schedule action in new longform handler
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
  mockScheduleLongFormPostExecute,
} from "./shared-setup";

import { handleNewLongFormAction } from "~/features/posts/server/longform";
import {
  getUserById,
  getQueueTypeByNameForUser,
  getQueueTypes,
} from "~/features/user";

describe("Schedule Longform Action", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env["NOSTR_PUBLISHER_URL"] =
      "https://api.nostr-publisher.com/publish";
    // Mock getUserById - required by handleNewLongFormAction
    (getUserById as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: TEST_USER_ID,
      npub: "test-pubkey",
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
    mockCreateLongFormPostExecute.mockResolvedValue({
      post: {
        id: "longform-123",
        title: "Test Post",
        isPublished: false,
      },
      needsScheduling: false,
    });
    mockScheduleLongFormPostExecute.mockResolvedValue(undefined);
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
      pubkey: "test-pubkey",
      tags: [["published_at", "1704067200"]],
    };
    const mockNostrEvent = {
      id: "event-123",
      kind: 30023,
      pubkey: "test-pubkey",
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
      useHashtagPresets: "off",
      scheduledFor: "1704067200", // Required by schema, though handler extracts from tags
    });

    const request = new Request("http://localhost:3000/dashboard/newlongform", {
      method: "POST",
      body: formData,
    });

    const response = await handleNewLongFormAction(TEST_USER_ID, request);

    expect(mockCreateLongFormPostExecute).toHaveBeenCalledWith(
      expect.objectContaining({
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- Jest expect matchers have complex types
        scheduledFor: expect.any(Number),
      })
    );
    // Note: CreateLongFormPostUseCase handles scheduling via outbox pattern,
    // so ScheduleLongFormPostUseCase is not called for new posts
    expect(mockScheduleLongFormPostExecute).not.toHaveBeenCalled();
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
