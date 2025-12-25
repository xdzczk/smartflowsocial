/**
 * Integration tests for drafts action handlers
 * 
 * Tests the action handler logic directly, without requiring a browser.
 * For UI interaction tests, see cypress/e2e/posts/drafts.cy.ts
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock dependencies
vi.mock("~/models/post.server", () => ({
  deletePost: vi.fn(),
  updatePost: vi.fn(),
}));

vi.mock("~/models/longformpost.server", () => ({
  deleteLongFormPost: vi.fn(),
}));

import { deletePost, updatePost } from "~/models/post.server";
import { deleteLongFormPost } from "~/models/longformpost.server";
import { handleDraftsAction } from "~/features/posts/services/drafts-action.server";
import { createActionFormData, createFormData, TEST_USER_ID, TEST_POST_ID, TEST_LONGFORM_ID, createPostIds } from "../utils/test-helpers";

describe("Drafts Action Handler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Delete Post Action", () => {
    it("should delete a single draft post", async () => {
      (deletePost as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

      const formData = createActionFormData("delete", {
        postId: TEST_POST_ID,
      });

      const result = await handleDraftsAction(formData, TEST_USER_ID);

      expect(deletePost).toHaveBeenCalledWith({
        id: TEST_POST_ID,
        userId: TEST_USER_ID,
      });
      expect(result).toEqual({ success: true });
    });
  });

  describe("Delete Longform Post Action", () => {
    it("should delete a single draft longform post", async () => {
      (deleteLongFormPost as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

      const formData = createActionFormData("deleteLongForm", {
        postId: TEST_LONGFORM_ID,
      });

      const result = await handleDraftsAction(formData, TEST_USER_ID);

      expect(deleteLongFormPost).toHaveBeenCalledWith({
        id: TEST_LONGFORM_ID,
        userId: TEST_USER_ID,
      });
      expect(result).toEqual({ success: true });
    });
  });

  describe("Bulk Delete Posts Action", () => {
    it("should delete multiple draft posts", async () => {
      (deletePost as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

      const postIds = createPostIds(3);
      const formData = createActionFormData("bulkDelete", {
        postIds: JSON.stringify(postIds),
      });

      const result = await handleDraftsAction(formData, TEST_USER_ID);

      expect(deletePost).toHaveBeenCalledTimes(3);
      postIds.forEach((id) => {
        expect(deletePost).toHaveBeenCalledWith({
          id,
          userId: TEST_USER_ID,
        });
      });
      expect(result).toEqual({ success: true });
    });
  });

  describe("Bulk Sign and Resume Action", () => {
    it("should sign and resume multiple draft posts", async () => {
      (updatePost as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

      const postIds = ["post-1", "post-2"];
      const contents = ["Content 1", "Content 2"];
      const captions = ["Caption 1", "Caption 2"];
      const queueTypes = ["queue-1", "queue-2"];
      const scheduledFors = ["2024-01-01T10:00:00Z", "2024-01-01T11:00:00Z"];
      const signedEvents = [
        JSON.stringify({ id: "event-1", pubkey: "pk1" }),
        JSON.stringify({ id: "event-2", pubkey: "pk2" }),
      ];
      const nostrEvents = [
        JSON.stringify({ id: "nostr-1" }),
        JSON.stringify({ id: "nostr-2" }),
      ];

      const formData = createFormData({
        _action: "bulkSignAndResume",
        postIds,
        contents,
        captions,
        queueTypes,
        scheduledFors,
        signedEvents,
        nostrEvents,
      });

      const result = await handleDraftsAction(formData, TEST_USER_ID);

      expect(updatePost).toHaveBeenCalledTimes(2);
      expect(updatePost).toHaveBeenCalledWith({
        id: "post-1",
        userId: TEST_USER_ID,
        data: {
          content: "Content 1",
          caption: "Caption 1",
          queueType: "queue-1",
          scheduledFor: "2024-01-01T10:00:00Z",
          signedEvent: { id: "event-1", pubkey: "pk1" },
          nostrEvent: { id: "nostr-1" },
          draft: false,
          isScheduled: true,
          isPosted: false,
        },
      });
      expect(updatePost).toHaveBeenCalledWith({
        id: "post-2",
        userId: TEST_USER_ID,
        data: {
          content: "Content 2",
          caption: "Caption 2",
          queueType: "queue-2",
          scheduledFor: "2024-01-01T11:00:00Z",
          signedEvent: { id: "event-2", pubkey: "pk2" },
          nostrEvent: { id: "nostr-2" },
          draft: false,
          isScheduled: true,
          isPosted: false,
        },
      });
      expect(result).toEqual({ success: true });
    });

    it("should handle single post in bulk sign and resume", async () => {
      (updatePost as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

      const formData = createFormData({
        _action: "bulkSignAndResume",
        postIds: ["post-1"],
        contents: ["Content 1"],
        captions: ["Caption 1"],
        queueTypes: ["queue-1"],
        scheduledFors: ["2024-01-01T10:00:00Z"],
        signedEvents: [JSON.stringify({ id: "event-1" })],
        nostrEvents: [JSON.stringify({ id: "nostr-1" })],
      });

      const result = await handleDraftsAction(formData, TEST_USER_ID);

      expect(updatePost).toHaveBeenCalledTimes(1);
      expect(result).toEqual({ success: true });
    });

    it("should handle mismatched array lengths gracefully", async () => {
      (updatePost as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

      // Arrays with different lengths - should process what's available
      const formData = createFormData({
        _action: "bulkSignAndResume",
        postIds: ["post-1", "post-2"],
        contents: ["Content 1"], // Only one content
        captions: ["Caption 1", "Caption 2"],
        queueTypes: ["queue-1", "queue-2"],
        scheduledFors: ["2024-01-01T10:00:00Z", "2024-01-01T11:00:00Z"],
        signedEvents: [JSON.stringify({ id: "event-1" }), JSON.stringify({ id: "event-2" })],
        nostrEvents: [JSON.stringify({ id: "nostr-1" }), JSON.stringify({ id: "nostr-2" })],
      });

      const result = await handleDraftsAction(formData, TEST_USER_ID);

      // Should process based on postIds length
      expect(updatePost).toHaveBeenCalledTimes(2);
      expect(result).toEqual({ success: true });
    });

    it("should parse JSON strings for signedEvent and nostrEvent", async () => {
      (updatePost as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

      const signedEvent = { id: "event-1", pubkey: "pk1", kind: 1 };
      const nostrEvent = { id: "nostr-1", content: "test" };

      const formData = createFormData({
        _action: "bulkSignAndResume",
        postIds: ["post-1"],
        contents: ["Content 1"],
        captions: ["Caption 1"],
        queueTypes: ["queue-1"],
        scheduledFors: ["2024-01-01T10:00:00Z"],
        signedEvents: [JSON.stringify(signedEvent)],
        nostrEvents: [JSON.stringify(nostrEvent)],
      });

      await handleDraftsAction(formData, TEST_USER_ID);

      expect(updatePost).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            signedEvent,
            nostrEvent,
          }),
        }),
      );
    });
  });

  describe("Error Handling", () => {
    it("should return error for invalid action", async () => {
      const formData = createActionFormData("invalidAction", {});

      const result = await handleDraftsAction(formData, TEST_USER_ID);

      expect(result).toEqual({ error: "Invalid action" });
    });

    it("should handle database errors from deletePost", async () => {
      (deletePost as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error("Database error"),
      );

      const formData = createActionFormData("delete", {
        postId: TEST_POST_ID,
      });

      await expect(
        handleDraftsAction(formData, TEST_USER_ID),
      ).rejects.toThrow("Database error");
    });

    it("should handle database errors from updatePost", async () => {
      (updatePost as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error("Update failed"),
      );

      const formData = createFormData({
        _action: "bulkSignAndResume",
        postIds: ["post-1"],
        contents: ["Content 1"],
        captions: ["Caption 1"],
        queueTypes: ["queue-1"],
        scheduledFors: ["2024-01-01T10:00:00Z"],
        signedEvents: [JSON.stringify({ id: "event-1" })],
        nostrEvents: [JSON.stringify({ id: "nostr-1" })],
      });

      await expect(
        handleDraftsAction(formData, TEST_USER_ID),
      ).rejects.toThrow("Update failed");
    });

    it("should handle JSON parse errors in bulk sign and resume", async () => {
      const formData = createFormData({
        _action: "bulkSignAndResume",
        postIds: ["post-1"],
        contents: ["Content 1"],
        captions: ["Caption 1"],
        queueTypes: ["queue-1"],
        scheduledFors: ["2024-01-01T10:00:00Z"],
        signedEvents: ["invalid-json"],
        nostrEvents: [JSON.stringify({ id: "nostr-1" })],
      });

      await expect(
        handleDraftsAction(formData, TEST_USER_ID),
      ).rejects.toThrow();
    });
  });
});

