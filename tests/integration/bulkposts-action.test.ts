/**
 * Integration tests for bulk posts action handler
 *
 * Tests app/routes/dashboard.bulkposts.tsx action
 * Tests bulkPostsAction function
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
// Mock dependencies
vi.mock("~/features/auth/session.server", () => ({
  requireUserId: vi.fn(),
}));

vi.mock("~/models/post.commands.server", () => ({
  createPost: vi.fn(),
  createPostWithOutbox: vi.fn(),
  updatePost: vi.fn(),
}));

const { mockExecute } = vi.hoisted(() => {
  const mockExecute = vi.fn();
  return { mockExecute };
});

vi.mock("~/features/posts/use-cases/create-post.use-case.server", () => ({
  CreatePostUseCase: class {
    execute = mockExecute;
  },
}));

vi.mock("~/models/post.queries.server", () => ({
  getPostsByIds: vi.fn(),
}));

vi.mock("~/features/posts/services/queue-type-resolver.server", () => ({
  resolveQueueTypeId: vi.fn(),
}));

// Mock Prisma for PostStateMachine
const { mockPrisma } = vi.hoisted(() => {
  const mockPrisma = {
    post: {
      findUnique: vi.fn(),
      update: vi.fn(),
      findFirst: vi.fn(), // For idempotency check in CreatePostUseCase
      create: vi.fn(), // For post creation
    },
    postStateTransition: {
      create: vi.fn(),
    },
    $transaction: vi.fn(async (callback) => {
      const tx = {
        post: {
          update: vi.fn().mockResolvedValue({}),
          create: vi.fn().mockResolvedValue({}),
        },
        postStateTransition: {
          create: vi.fn().mockResolvedValue({}),
        },
      };
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call -- Test mock callback has complex types
      return await callback(tx);
    }),
  };
  return { mockPrisma };
});

vi.mock("~/lib/prisma.server", () => ({
  prisma: mockPrisma,
}));

import {
  TEST_USER_ID,
  createActionFormData,
  createMockPost,
} from "../utils/test-helpers";

import { requireUserId } from "~/features/auth/session.server";
import { bulkPostsAction } from "~/features/posts/bulkposts.action.server";
import { resolveQueueTypeId } from "~/features/posts/services/queue-type-resolver.server";
import { updatePost } from "~/models/post.commands.server";
import { getPostsByIds } from "~/models/post.queries.server";

describe("Bulk Posts Action Handler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockExecute.mockClear();
    (requireUserId as ReturnType<typeof vi.fn>).mockResolvedValue(TEST_USER_ID);
    // Setup default Prisma mocks for PostStateMachine
    (mockPrisma.post.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "test-post-id",
      userId: TEST_USER_ID,
      currentState: "DRAFT",
    });
    // Mock findFirst for idempotency check in CreatePostUseCase
    (mockPrisma.post.findFirst as ReturnType<typeof vi.fn>).mockImplementation(
      // eslint-disable-next-line @typescript-eslint/no-misused-promises -- Mock implementation needs to be async
      async (_args: { where: { creationIdempotencyKey?: string } }) => {
        // Return null to indicate no existing post with this idempotency key
        return null;
      }
    );
    (mockPrisma.post.update as ReturnType<typeof vi.fn>).mockResolvedValue({});
    (
      mockPrisma.postStateTransition.create as ReturnType<typeof vi.fn>
    ).mockResolvedValue({});
  });

  describe("Upload Images Preview Action", () => {
    it("should handle upload images preview", async () => {
      const uploadResults = [
        {
          success: true,
          file: {
            url: "https://example.com/image1.jpg",
            size: 1000,
            name: "image1.jpg",
            extension: "jpg",
            provider: "S3" as const,
          },
        },
        {
          success: true,
          file: {
            url: "https://example.com/image2.jpg",
            size: 2000,
            name: "image2.jpg",
            extension: "jpg",
            provider: "S3" as const,
          },
        },
      ];

      const scheduledDates = ["2024-01-15T10:00:00", "2024-01-15T14:00:00"];
      const queueTypes = ["posts", "all"];

      const formData = createActionFormData("_upload_images_preview", {
        uploadResults: JSON.stringify(uploadResults),
        scheduledDates,
        queueTypes,
      });

      const request = new Request("http://localhost/dashboard/bulkposts", {
        method: "POST",
        body: formData,
      });

      const result = await bulkPostsAction({ request });
      const dataRaw: unknown = await result.json();
      const data =
        dataRaw && typeof dataRaw === "object" && !Array.isArray(dataRaw)
          ? (dataRaw as Record<string, unknown>)
          : {};

      expect(data["success"]).toBe(true);
      const fileUrls = Array.isArray(data["fileUrls"]) ? data["fileUrls"] : [];
      expect(fileUrls).toHaveLength(2);
      expect(fileUrls[0]).toMatchObject({
        fileUrl: "https://example.com/image1.jpg",
        scheduledFor: "2024-01-15T10:00:00",
        queueType: "posts",
      });
    });

    it("should handle missing uploadResults", async () => {
      const formData = createActionFormData("_upload_images_preview", {});

      const request = new Request("http://localhost/dashboard/bulkposts", {
        method: "POST",
        body: formData,
      });

      const result = await bulkPostsAction({ request });

      expect(result.status).toBeGreaterThanOrEqual(400);
    });

    it("should handle invalid uploadResults JSON", async () => {
      const formData = createActionFormData("_upload_images_preview", {
        uploadResults: "invalid-json",
      });

      const request = new Request("http://localhost/dashboard/bulkposts", {
        method: "POST",
        body: formData,
      });

      const result = await bulkPostsAction({ request });

      expect(result.status).toBeGreaterThanOrEqual(400);
    });
  });

  describe("Sign and Schedule Action", () => {
    it("should sign and schedule multiple posts", async () => {
      // SignedEvent schema requires: id, pubkey, created_at, kind, content, tags, sig
      const signedEvents = [
        {
          id: "event-1",
          pubkey: "pk1",
          kind: 1,
          content: "Post 1",
          tags: [["t", "tag1"]],
          created_at: Math.floor(Date.now() / 1000),
          sig: "sig1",
        },
        {
          id: "event-2",
          pubkey: "pk2",
          kind: 1,
          content: "Post 2",
          tags: [["t", "tag2"]],
          created_at: Math.floor(Date.now() / 1000),
          sig: "sig2",
        },
      ];

      // NostrEvent schema requires: id, pubkey, created_at, kind, content, tags (no sig)
      const nostrEvents = signedEvents.map((e) => ({
        id: e.id,
        pubkey: e.pubkey,
        created_at: e.created_at,
        kind: e.kind,
        content: e.content,
        tags: e.tags,
      }));

      const mockPosts = signedEvents.map((event, index) =>
        createMockPost({
          id: `post-${index + 1}`,
          signedEvent: event,
        })
      );

      (resolveQueueTypeId as ReturnType<typeof vi.fn>).mockResolvedValue(
        "queue-1"
      );
      mockExecute
        .mockResolvedValueOnce({ post: mockPosts[0], needsScheduling: true })
        .mockResolvedValueOnce({ post: mockPosts[1], needsScheduling: true });

      const formData = new FormData();
      formData.append("_action", "sign_and_schedule");
      signedEvents.forEach((event) => {
        formData.append("signedEvents", JSON.stringify(event));
      });
      nostrEvents.forEach((event) => {
        formData.append("nostrEvent", JSON.stringify(event));
      });
      formData.append("caption", JSON.stringify("Caption 1"));
      formData.append("caption", JSON.stringify("Caption 2"));
      // fileUrl schema expects array of strings that get parsed and flattened
      // Each entry should be a JSON stringified array
      formData.append(
        "fileUrl",
        JSON.stringify(["https://example.com/image1.jpg"])
      );
      formData.append(
        "fileUrl",
        JSON.stringify(["https://example.com/image2.jpg"])
      );
      formData.append("queueType", "posts");
      formData.append("queueType", "all");
      formData.append("isRecyclable", "false");
      formData.append("isRecyclable", "false");
      if (signedEvents[0] && signedEvents[1]) {
        formData.append("scheduledFor", String(signedEvents[0].created_at));
        formData.append("scheduledFor", String(signedEvents[1].created_at));
      }
      formData.append("originalPostId", ""); // Required field
      formData.append("originalPostId", ""); // Required field

      const request = new Request("http://localhost/dashboard/bulkposts", {
        method: "POST",
        body: formData,
      });

      const result = await bulkPostsAction({ request });

      expect(result).toBeInstanceOf(Response);
      if (result.status !== 302) {
        // Log the error for debugging
        try {
          const errorData = (await result.json()) as unknown;
          console.error("Error response:", JSON.stringify(errorData, null, 2));
        } catch {
          const errorText = await result.text();
          console.error("Error response text:", errorText);
        }
      }
      expect(result.status).toBe(302); // Redirect
      expect(mockExecute).toHaveBeenCalledTimes(2);
    });

    it("should handle recycle mode and mark original posts as non-recyclable", async () => {
      // SignedEvent schema requires: id, pubkey, created_at, kind, content, tags, sig
      const signedEvent = {
        id: "event-1",
        pubkey: "pk1",
        kind: 1,
        content: "Recycled post",
        tags: [["t", "tag1"]],
        created_at: Math.floor(Date.now() / 1000),
        sig: "sig1",
      };

      const originalPostId = "original-post-123";
      (resolveQueueTypeId as ReturnType<typeof vi.fn>).mockResolvedValue(
        "queue-1"
      );
      mockExecute.mockResolvedValue({
        post: createMockPost({ id: "new-post-1" }),
        needsScheduling: false,
      });
      (getPostsByIds as ReturnType<typeof vi.fn>).mockResolvedValue([
        createMockPost({ id: originalPostId, isRecyclable: true }),
      ]);
      (updatePost as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

      // NostrEvent schema requires: id, pubkey, created_at, kind, content, tags (no sig)
      const nostrEvent = {
        id: signedEvent.id,
        pubkey: signedEvent.pubkey,
        created_at: signedEvent.created_at,
        kind: signedEvent.kind,
        content: signedEvent.content,
        tags: signedEvent.tags,
      };

      const formData = new FormData();
      formData.append("_action", "sign_and_schedule");
      // Schema expects arrays from FormData.getAll(), so append each item
      [JSON.stringify(signedEvent)].forEach((event) =>
        formData.append("signedEvents", event)
      );
      [JSON.stringify(nostrEvent)].forEach((event) =>
        formData.append("nostrEvent", event)
      );
      [JSON.stringify("Caption")].forEach((caption) =>
        formData.append("caption", caption)
      );
      [JSON.stringify(["https://example.com/image.jpg"])].forEach((url) =>
        formData.append("fileUrl", url)
      );
      ["posts"].forEach((queue) => formData.append("queueType", queue));
      ["false"].forEach((recyclable) =>
        formData.append("isRecyclable", recyclable)
      );
      [originalPostId].forEach((id) => formData.append("originalPostId", id));

      const request = new Request(
        "http://localhost/dashboard/bulkposts?mode=recycle",
        {
          method: "POST",
          body: formData,
        }
      );

      const result = await bulkPostsAction({ request });

      expect(result.status).toBe(302);
      expect(updatePost).toHaveBeenCalledWith(
        expect.objectContaining({
          id: originalPostId,
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- Jest expect matchers have complex types
          userId: expect.any(String),
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- Jest expect matchers have complex types
          data: expect.objectContaining({
            isRecyclable: false,
          }),
        })
      );
    });

    it("should handle invalid signedEvents JSON", async () => {
      const formData = new FormData();
      formData.append("_action", "sign_and_schedule");
      formData.append("signedEvents", "invalid-json");

      const request = new Request("http://localhost/dashboard/bulkposts", {
        method: "POST",
        body: formData,
      });

      const result = await bulkPostsAction({ request });

      expect(result.status).toBeGreaterThanOrEqual(400);
    });
  });

  describe("Save as Draft Action", () => {
    it("should save multiple posts as drafts", async () => {
      const fileUrls = [
        "https://example.com/image1.jpg",
        "https://example.com/image2.jpg",
      ];
      const captions = ["Caption 1", "Caption 2"];
      const queueTypes = ["posts", "all"];

      (requireUserId as ReturnType<typeof vi.fn>).mockResolvedValue(
        TEST_USER_ID
      );
      (resolveQueueTypeId as ReturnType<typeof vi.fn>).mockResolvedValue(
        "queue-1"
      );
      mockExecute
        .mockResolvedValueOnce({
          post: createMockPost({ id: "draft-1" }),
          needsScheduling: false,
        })
        .mockResolvedValueOnce({
          post: createMockPost({ id: "draft-2" }),
          needsScheduling: false,
        });

      const formData = new FormData();
      formData.append("_action", "save_as_draft");
      fileUrls.forEach((url) => {
        formData.append("fileUrl", JSON.stringify([url]));
      });
      captions.forEach((caption) => {
        formData.append("caption", JSON.stringify(caption));
      });
      queueTypes.forEach((queueType) => {
        formData.append("queueType", queueType);
      });
      // scheduledFor is required as an array in saveAsDraftSchema
      fileUrls.forEach(() => {
        formData.append("scheduledFor", "");
      });

      const request = new Request("http://localhost/dashboard/bulkposts", {
        method: "POST",
        body: formData,
      });

      const result = await bulkPostsAction({ request });

      expect(result).toBeInstanceOf(Response);
      expect(result.status).toBe(302); // Redirect
      expect(mockExecute).toHaveBeenCalledTimes(2);
      // Verify execute was called with draft parameters (no scheduledFor = DRAFT state)
      // Note: state is determined by scheduledFor - null/undefined = DRAFT
      // The caption comes from FormData which may have JSON stringified values
      expect(mockExecute).toHaveBeenCalledWith(
        expect.objectContaining({
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- Jest expect matchers have complex types
          fileUrl: expect.any(Array),
          // scheduledFor should be undefined/null/empty for drafts
        })
      );
      // Verify scheduledFor is not set (empty string from FormData becomes undefined)
      const calls = mockExecute.mock.calls;
      expect(calls.length).toBeGreaterThan(0);
      calls.forEach((call) => {
        const args = call[0] as { scheduledFor?: number | string | undefined };
        expect(args.scheduledFor).toBeUndefined();
      });
    });
  });

  describe("Authentication", () => {
    it("should require authentication", async () => {
      (requireUserId as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error("Not authenticated")
      );

      const formData = createActionFormData("_upload_images_preview", {});
      const request = new Request("http://localhost/dashboard/bulkposts", {
        method: "POST",
        body: formData,
      });

      const result = await bulkPostsAction({ request });

      expect(result.status).toBeGreaterThanOrEqual(400);
    });
  });

  describe("Invalid Action", () => {
    it("should return error for invalid action", async () => {
      const formData = createActionFormData("invalid_action", {});

      const request = new Request("http://localhost/dashboard/bulkposts", {
        method: "POST",
        body: formData,
      });

      const result = await bulkPostsAction({ request });

      expect(result.status).toBeGreaterThanOrEqual(400);
    });
  });
});
