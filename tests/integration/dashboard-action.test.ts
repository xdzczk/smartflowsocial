/**
 * Integration tests for dashboard action handlers
 *
 * Tests the action handler logic directly, without requiring a browser.
 * For UI interaction tests, see tests/e2e/dashboard.cy.ts
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
  createFormData,
  TEST_USER_ID,
  TEST_POST_ID,
  TEST_LONGFORM_ID,
  createPostIds,
} from "../utils/test-helpers";

import { handleDashboardAction } from "~/features/posts/services/dashboard-action.server";
import { deleteLongFormPost } from "~/models/longformpost.server";
import { deletePost } from "~/models/post.commands.server";

describe("Dashboard Action Handler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Delete Post Action", () => {
    it("should delete a single post", async () => {
      (deletePost as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

      const formData = createActionFormData("delete", {
        postId: TEST_POST_ID,
      });

      const result = await handleDashboardAction(formData, TEST_USER_ID);

      expect(deletePost).toHaveBeenCalledWith({
        id: TEST_POST_ID,
        userId: TEST_USER_ID,
      });
      expect(result).toEqual({ success: true });
    });

    it("should handle missing postId gracefully", async () => {
      const formData = createActionFormData("delete", {});

      const result = await handleDashboardAction(formData, TEST_USER_ID);

      // Zod validation returns a Response with error
      expect(result).toBeInstanceOf(Response);
      const data = (await (result as Response).json()) as { error?: string };
      expect(data).toHaveProperty("error");
      expect(data.error).toContain("postId");
      expect(deletePost).not.toHaveBeenCalled();
    });
  });

  describe("Delete Longform Post Action", () => {
    it("should delete a single longform post", async () => {
      (deleteLongFormPost as ReturnType<typeof vi.fn>).mockResolvedValue(
        undefined
      );

      const formData = createActionFormData("deleteLongForm", {
        postId: TEST_LONGFORM_ID,
      });

      const result = await handleDashboardAction(formData, TEST_USER_ID);

      expect(deleteLongFormPost).toHaveBeenCalledWith({
        id: TEST_LONGFORM_ID,
        userId: TEST_USER_ID,
      });
      expect(result).toEqual({ success: true });
    });
  });

  describe("Bulk Delete Posts Action", () => {
    it("should delete multiple posts", async () => {
      (deletePost as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

      const postIds = createPostIds(3);
      const formData = createActionFormData("bulkDelete", {
        postIds: JSON.stringify(postIds),
      });

      const result = await handleDashboardAction(formData, TEST_USER_ID);

      expect(deletePost).toHaveBeenCalledTimes(3);
      postIds.forEach((id) => {
        expect(deletePost).toHaveBeenCalledWith({
          id,
          userId: TEST_USER_ID,
        });
      });
      expect(result).toEqual({ success: true });
    });

    it("should return error for empty postIds array", async () => {
      (deletePost as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

      const formData = createActionFormData("bulkDelete", {
        postIds: JSON.stringify([]),
      });

      const result = await handleDashboardAction(formData, TEST_USER_ID);

      // Zod validation requires at least one post ID
      expect(result).toBeInstanceOf(Response);
      const data = (await (result as Response).json()) as { error?: string };
      expect(data).toHaveProperty("error");
      expect(data.error).toContain("postIds");
      expect(deletePost).not.toHaveBeenCalled();
    });

    it("should return error for invalid postIds format", async () => {
      const formData = createActionFormData("bulkDelete", {
        postIds: "invalid-json",
      });

      const result = await handleDashboardAction(formData, TEST_USER_ID);

      // Zod validation returns a Response with error for invalid JSON
      expect(result).toBeInstanceOf(Response);
      const data = (await (result as Response).json()) as { error?: string };
      expect(data).toHaveProperty("error");
      expect(deletePost).not.toHaveBeenCalled();
    });

    it("should handle single post in bulk delete", async () => {
      (deletePost as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

      const formData = createActionFormData("bulkDelete", {
        postIds: JSON.stringify([TEST_POST_ID]),
      });

      const result = await handleDashboardAction(formData, TEST_USER_ID);

      expect(deletePost).toHaveBeenCalledTimes(1);
      expect(deletePost).toHaveBeenCalledWith({
        id: TEST_POST_ID,
        userId: TEST_USER_ID,
      });
      expect(result).toEqual({ success: true });
    });
  });

  describe("Bulk Delete Longform Posts Action", () => {
    it("should delete multiple longform posts", async () => {
      (deleteLongFormPost as ReturnType<typeof vi.fn>).mockResolvedValue(
        undefined
      );

      const postIds = [TEST_LONGFORM_ID, "longform-2", "longform-3"];
      const formData = createActionFormData("bulkDeleteLongForm", {
        postIds: JSON.stringify(postIds),
      });

      const result = await handleDashboardAction(formData, TEST_USER_ID);

      expect(deleteLongFormPost).toHaveBeenCalledTimes(3);
      postIds.forEach((id) => {
        expect(deleteLongFormPost).toHaveBeenCalledWith({
          id,
          userId: TEST_USER_ID,
        });
      });
      expect(result).toEqual({ success: true });
    });

    it("should return error for invalid postIds format", async () => {
      const formData = createActionFormData("bulkDeleteLongForm", {
        postIds: "not-json",
      });

      const result = await handleDashboardAction(formData, TEST_USER_ID);

      // Zod validation returns a Response with error for invalid JSON
      expect(result).toBeInstanceOf(Response);
      const data = (await (result as Response).json()) as { error?: string };
      expect(data).toHaveProperty("error");
      expect(deleteLongFormPost).not.toHaveBeenCalled();
    });
  });

  describe("Error Handling", () => {
    it("should return error for invalid action", async () => {
      const formData = createActionFormData("invalidAction", {});

      const result = await handleDashboardAction(formData, TEST_USER_ID);

      // Zod validation fails because "invalidAction" is not in the enum
      expect(result).toBeInstanceOf(Response);
      const data = (await (result as Response).json()) as { error?: string };
      expect(data).toHaveProperty("error");
      expect(deletePost).not.toHaveBeenCalled();
      expect(deleteLongFormPost).not.toHaveBeenCalled();
    });

    it("should return error for missing action", async () => {
      const formData = createFormData({ postId: TEST_POST_ID });

      const result = await handleDashboardAction(formData, TEST_USER_ID);

      // Zod validation returns a Response with error when _action is missing
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
        handleDashboardAction(formData, TEST_USER_ID)
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
        handleDashboardAction(formData, TEST_USER_ID)
      ).rejects.toThrow("Database error");
    });

    it("should handle partial failures in bulk delete", async () => {
      (deletePost as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error("Delete failed"))
        .mockResolvedValueOnce(undefined);

      const postIds = createPostIds(3);
      const formData = createActionFormData("bulkDelete", {
        postIds: JSON.stringify(postIds),
      });

      // The function uses Promise.all which will throw the first error
      // But it catches parseError and throws ValidationError first
      // So we need to check for the actual error that gets thrown
      await expect(
        handleDashboardAction(formData, TEST_USER_ID)
      ).rejects.toThrow();
    });
  });

  describe("Concurrent Operations", () => {
    it("should handle multiple bulk deletes concurrently", async () => {
      (deletePost as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

      const postIds1 = createPostIds(2);
      const postIds2 = createPostIds(2);

      const formData1 = createActionFormData("bulkDelete", {
        postIds: JSON.stringify(postIds1),
      });
      const formData2 = createActionFormData("bulkDelete", {
        postIds: JSON.stringify(postIds2),
      });

      const [result1, result2] = await Promise.all([
        handleDashboardAction(formData1, TEST_USER_ID),
        handleDashboardAction(formData2, TEST_USER_ID),
      ]);

      expect(result1).toEqual({ success: true });
      expect(result2).toEqual({ success: true });
      expect(deletePost).toHaveBeenCalledTimes(4);
    });
  });
});
