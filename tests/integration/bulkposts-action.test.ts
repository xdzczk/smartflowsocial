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
  updatePost: vi.fn(),
}));

vi.mock("~/models/post.queries.server", () => ({
  getPostsByIds: vi.fn(),
}));

vi.mock("~/features/posts/services/queue-type-resolver.server", () => ({
  resolveQueueTypeId: vi.fn(),
}));

import { requireUserId } from "~/features/auth/session.server";
import { bulkPostsAction } from "~/features/posts/bulkposts.action.server";
import { resolveQueueTypeId } from "~/features/posts/services/queue-type-resolver.server";
import { createPost, updatePost } from "~/models/post.commands.server";
import { getPostsByIds } from "~/models/post.queries.server";

import {
  TEST_USER_ID,
  createActionFormData,
  createMockPost,
} from "../utils/test-helpers";

describe("Bulk Posts Action Handler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (requireUserId as ReturnType<typeof vi.fn>).mockResolvedValue(TEST_USER_ID);
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

      expect(data.success).toBe(true);
      const fileUrls = Array.isArray(data.fileUrls) ? data.fileUrls : [];
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
      const signedEvents = [
        {
          id: "event-1",
          kind: 1,
          content: "Post 1",
          tags: [["t", "tag1"]],
          created_at: Math.floor(Date.now() / 1000),
        },
        {
          id: "event-2",
          kind: 1,
          content: "Post 2",
          tags: [["t", "tag2"]],
          created_at: Math.floor(Date.now() / 1000),
        },
      ];

      const nostrEvents = signedEvents.map((e) => ({ ...e }));

      const mockPosts = signedEvents.map((event, index) =>
        createMockPost({
          id: `post-${index + 1}`,
          signedEvent: event,
        }),
      );

      (resolveQueueTypeId as ReturnType<typeof vi.fn>).mockResolvedValue(
        "queue-1",
      );
      (createPost as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce(mockPosts[0])
        .mockResolvedValueOnce(mockPosts[1]);

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
      formData.append(
        "fileUrl",
        JSON.stringify("https://example.com/image1.jpg"),
      );
      formData.append(
        "fileUrl",
        JSON.stringify("https://example.com/image2.jpg"),
      );
      formData.append("queueType", "posts");
      formData.append("queueType", "all");
      formData.append("isRecyclable", "false");
      formData.append("isRecyclable", "false");

      const request = new Request("http://localhost/dashboard/bulkposts", {
        method: "POST",
        body: formData,
      });

      const result = await bulkPostsAction({ request });

      expect(result).toBeInstanceOf(Response);
      expect(result.status).toBe(302); // Redirect
      expect(createPost).toHaveBeenCalledTimes(2);
    });

    it("should handle recycle mode and mark original posts as non-recyclable", async () => {
      const signedEvent = {
        id: "event-1",
        kind: 1,
        content: "Recycled post",
        tags: [["t", "tag1"]],
        created_at: Math.floor(Date.now() / 1000),
      };

      const originalPostId = "original-post-123";
      (resolveQueueTypeId as ReturnType<typeof vi.fn>).mockResolvedValue(
        "queue-1",
      );
      (createPost as ReturnType<typeof vi.fn>).mockResolvedValue(
        createMockPost({ id: "new-post-1" }),
      );
      (getPostsByIds as ReturnType<typeof vi.fn>).mockResolvedValue([
        createMockPost({ id: originalPostId, isRecyclable: true }),
      ]);
      (updatePost as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

      const formData = new FormData();
      formData.append("_action", "sign_and_schedule");
      formData.append("signedEvents", JSON.stringify(signedEvent));
      formData.append("nostrEvent", JSON.stringify(signedEvent));
      formData.append("caption", JSON.stringify("Caption"));
      formData.append(
        "fileUrl",
        JSON.stringify("https://example.com/image.jpg"),
      );
      formData.append("queueType", "posts");
      formData.append("isRecyclable", "false");
      formData.append("originalPostId", originalPostId);

      const request = new Request(
        "http://localhost/dashboard/bulkposts?mode=recycle",
        {
          method: "POST",
          body: formData,
        },
      );

      const result = await bulkPostsAction({ request });

      expect(result.status).toBe(302);
      expect(updatePost).toHaveBeenCalledWith(
        expect.objectContaining({
          id: originalPostId,
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          userId: expect.any(String),
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          data: expect.objectContaining({
            isRecyclable: false,
          }),
        }),
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
        TEST_USER_ID,
      );
      (resolveQueueTypeId as ReturnType<typeof vi.fn>).mockResolvedValue(
        "queue-1",
      );
      (createPost as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce(createMockPost({ id: "draft-1" }))
        .mockResolvedValueOnce(createMockPost({ id: "draft-2" }));

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
      formData.append("isRecyclable", "false");
      formData.append("isRecyclable", "false");

      const request = new Request("http://localhost/dashboard/bulkposts", {
        method: "POST",
        body: formData,
      });

      const result = await bulkPostsAction({ request });

      expect(result).toBeInstanceOf(Response);
      expect(result.status).toBe(302); // Redirect
      expect(createPost).toHaveBeenCalledTimes(2);
      expect(createPost).toHaveBeenCalledWith(
        expect.objectContaining({
          draft: true,
          isScheduled: false,
        }),
      );
    });
  });

  describe("Authentication", () => {
    it("should require authentication", async () => {
      (requireUserId as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error("Not authenticated"),
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
