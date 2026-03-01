/**
 * Integration tests for scheduled posts action handlers
 *
 * Tests the action handler logic directly, without requiring a browser.
 * For UI interaction tests, see tests/e2e/posts/scheduled-posts.cy.ts
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
// Mock dependencies
vi.mock("~/models/post.commands.server", () => ({
  deletePost: vi.fn(),
}));

vi.mock("~/models/longformpost.server", () => ({
  deleteLongFormPost: vi.fn(),
}));

import {
  createActionFormData,
  TEST_USER_ID,
  TEST_POST_ID,
  TEST_LONGFORM_ID,
  createPostIds,
} from "../utils/test-helpers";

import { handleScheduledAction } from "~/features/posts/services/scheduled-action.server";
import { deleteLongFormPost } from "~/models/longformpost.server";
import { deletePost } from "~/models/post.commands.server";

describe("Scheduled Action Handler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Delete Post Action", () => {
    it("should delete a single scheduled post", async () => {
      (deletePost as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

      const formData = createActionFormData("delete", {
        postId: TEST_POST_ID,
      });

      const result = await handleScheduledAction(formData, TEST_USER_ID);

      expect(deletePost).toHaveBeenCalledWith({
        id: TEST_POST_ID,
        userId: TEST_USER_ID,
      });
      expect(result).toEqual({ success: true, deleted: true });
    });
  });

  describe("Delete Longform Post Action", () => {
    it("should delete a single scheduled longform post", async () => {
      (deleteLongFormPost as ReturnType<typeof vi.fn>).mockResolvedValue(
        undefined
      );

      const formData = createActionFormData("deleteLongForm", {
        postId: TEST_LONGFORM_ID,
      });

      const result = await handleScheduledAction(formData, TEST_USER_ID);

      expect(deleteLongFormPost).toHaveBeenCalledWith({
        id: TEST_LONGFORM_ID,
        userId: TEST_USER_ID,
      });
      expect(result).toEqual({ success: true, deleted: true });
    });
  });

  describe("Bulk Delete Posts Action", () => {
    it("should delete multiple scheduled posts", async () => {
      (deletePost as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

      const postIds = createPostIds(5);
      const formData = createActionFormData("bulkDelete", {
        postIds: JSON.stringify(postIds),
      });

      const result = await handleScheduledAction(formData, TEST_USER_ID);

      expect(deletePost).toHaveBeenCalledTimes(5);
      postIds.forEach((id) => {
        expect(deletePost).toHaveBeenCalledWith({
          id,
          userId: TEST_USER_ID,
        });
      });
      expect(result).toEqual({ success: true, deletedCount: 5 });
    });

    it("should return error for empty postIds array", async () => {
      (deletePost as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

      const formData = createActionFormData("bulkDelete", {
        postIds: JSON.stringify([]),
      });

      const result = await handleScheduledAction(formData, TEST_USER_ID);

      // Zod validation requires at least one post ID
      expect(result).toBeInstanceOf(Response);
      const data = (await (result as Response).json()) as { error?: string };
      expect(data).toHaveProperty("error");
      expect(data.error).toContain("postIds");
      expect(deletePost).not.toHaveBeenCalled();
    });
  });

  describe("Bulk Delete Longform Posts Action", () => {
    it("should delete multiple scheduled longform posts", async () => {
      (deleteLongFormPost as ReturnType<typeof vi.fn>).mockResolvedValue(
        undefined
      );

      const postIds = [TEST_LONGFORM_ID, "longform-2", "longform-3"];
      const formData = createActionFormData("bulkDeleteLongForm", {
        postIds: JSON.stringify(postIds),
      });

      const result = await handleScheduledAction(formData, TEST_USER_ID);

      expect(deleteLongFormPost).toHaveBeenCalledTimes(3);
      postIds.forEach((id) => {
        expect(deleteLongFormPost).toHaveBeenCalledWith({
          id,
          userId: TEST_USER_ID,
        });
      });
      expect(result).toEqual({ success: true, deletedCount: 3 });
    });
  });

  describe("Bulk Delete Mixed Content Action", () => {
    it("should delete mixed posts and longform posts", async () => {
      (deletePost as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
      (deleteLongFormPost as ReturnType<typeof vi.fn>).mockResolvedValue(
        undefined
      );

      const itemData = [
        { id: "post-1", type: "post" },
        { id: "longform-1", type: "longform" },
        { id: "post-2", type: "post" },
        { id: "longform-2", type: "longform" },
      ];

      const formData = createActionFormData("bulkDeleteMixed", {
        itemData: JSON.stringify(itemData),
      });

      const result = await handleScheduledAction(formData, TEST_USER_ID);

      expect(deletePost).toHaveBeenCalledTimes(2);
      expect(deletePost).toHaveBeenCalledWith({
        id: "post-1",
        userId: TEST_USER_ID,
      });
      expect(deletePost).toHaveBeenCalledWith({
        id: "post-2",
        userId: TEST_USER_ID,
      });

      expect(deleteLongFormPost).toHaveBeenCalledTimes(2);
      expect(deleteLongFormPost).toHaveBeenCalledWith({
        id: "longform-1",
        userId: TEST_USER_ID,
      });
      expect(deleteLongFormPost).toHaveBeenCalledWith({
        id: "longform-2",
        userId: TEST_USER_ID,
      });

      expect(result).toEqual({ success: true, deletedCount: 4 });
    });

    it("should handle only posts in mixed delete", async () => {
      (deletePost as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

      const itemData = [
        { id: "post-1", type: "post" },
        { id: "post-2", type: "post" },
      ];

      const formData = createActionFormData("bulkDeleteMixed", {
        itemData: JSON.stringify(itemData),
      });

      const result = await handleScheduledAction(formData, TEST_USER_ID);

      expect(deletePost).toHaveBeenCalledTimes(2);
      expect(deleteLongFormPost).not.toHaveBeenCalled();
      expect(result).toEqual({ success: true, deletedCount: 2 });
    });

    it("should handle only longform posts in mixed delete", async () => {
      (deleteLongFormPost as ReturnType<typeof vi.fn>).mockResolvedValue(
        undefined
      );

      const itemData = [
        { id: "longform-1", type: "longform" },
        { id: "longform-2", type: "longform" },
      ];

      const formData = createActionFormData("bulkDeleteMixed", {
        itemData: JSON.stringify(itemData),
      });

      const result = await handleScheduledAction(formData, TEST_USER_ID);

      expect(deleteLongFormPost).toHaveBeenCalledTimes(2);
      expect(deletePost).not.toHaveBeenCalled();
      expect(result).toEqual({ success: true, deletedCount: 2 });
    });

    it("should return error for empty itemData array", async () => {
      const formData = createActionFormData("bulkDeleteMixed", {
        itemData: JSON.stringify([]),
      });

      const result = await handleScheduledAction(formData, TEST_USER_ID);

      // Zod validation requires at least one item
      expect(result).toBeInstanceOf(Response);
      const data = (await (result as Response).json()) as { error?: string };
      expect(data).toHaveProperty("error");
      expect(data.error).toContain("itemData");
      expect(deletePost).not.toHaveBeenCalled();
      expect(deleteLongFormPost).not.toHaveBeenCalled();
    });
  });

  describe("Error Handling", () => {
    it("should return error for invalid action", async () => {
      const formData = createActionFormData("invalidAction", {});

      const result = await handleScheduledAction(formData, TEST_USER_ID);

      // Zod validation fails because "invalidAction" is not in the enum
      expect(result).toBeInstanceOf(Response);
      const data = (await (result as Response).json()) as { error?: string };
      expect(data).toHaveProperty("error");
    });

    it("should handle database errors from deletePost", async () => {
      (deletePost as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error("Database error")
      );

      const formData = createActionFormData("delete", {
        postId: TEST_POST_ID,
      });

      await expect(
        handleScheduledAction(formData, TEST_USER_ID)
      ).rejects.toThrow("Database error");
    });

    it("should handle database errors from deleteLongFormPost", async () => {
      (deleteLongFormPost as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error("Database error")
      );

      const formData = createActionFormData("deleteLongForm", {
        postId: TEST_LONGFORM_ID,
      });

      await expect(
        handleScheduledAction(formData, TEST_USER_ID)
      ).rejects.toThrow("Database error");
    });

    it("should handle errors in bulk delete", async () => {
      (deletePost as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error("Delete failed")
      );

      const formData = createActionFormData("bulkDelete", {
        postIds: JSON.stringify([TEST_POST_ID]),
      });

      await expect(
        handleScheduledAction(formData, TEST_USER_ID)
      ).rejects.toThrow("Delete failed");
    });

    it("should handle errors in bulk delete mixed", async () => {
      (deletePost as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error("Delete failed")
      );

      const itemData = [{ id: "post-1", type: "post" }];
      const formData = createActionFormData("bulkDeleteMixed", {
        itemData: JSON.stringify(itemData),
      });

      await expect(
        handleScheduledAction(formData, TEST_USER_ID)
      ).rejects.toThrow("Delete failed");
    });
  });
});
