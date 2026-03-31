/**
 * Edge case tests for hashtag presets action handlers
 * Tests app/features/settings/actions/hashtag-presets-actions.server.ts
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock dependencies
vi.mock("~/features/user", () => ({
  createHashTagPreset: vi.fn(),
  updateHashTagPreset: vi.fn(),
  deleteHashTagPreset: vi.fn(),
}));

vi.mock("~/features/user/services/user-cache.server", () => ({
  invalidateHashTagPresetsCache: vi.fn().mockResolvedValue(undefined),
  invalidateQueueTypesCache: vi.fn().mockResolvedValue(undefined),
}));

import { createFormData, TEST_USER_ID } from "../../utils/test-helpers";

import { handleHashtagPresetAction } from "~/features/settings/actions/hashtag-presets-actions.server";
import {
  createHashTagPreset,
  updateHashTagPreset,
  deleteHashTagPreset,
} from "~/features/user";

describe("Hashtag Presets Action Handler - Edge Cases", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("create_hashtag_preset", () => {
    it("should reject empty name", async () => {
      const formData = createFormData({
        _action: "create_hashtag_preset",
        name: "   ",
        tags: "#tag1 #tag2",
      });

      const result = await handleHashtagPresetAction(
        TEST_USER_ID,
        "create_hashtag_preset",
        formData
      );
      const responseObj =
        result instanceof Response
          ? result
          : new Response(JSON.stringify(result));
      const jsonResultRaw: unknown = await responseObj.json();
      const jsonResult =
        jsonResultRaw &&
        typeof jsonResultRaw === "object" &&
        !Array.isArray(jsonResultRaw)
          ? (jsonResultRaw as { success?: boolean; error?: string })
          : {};

      expect(createHashTagPreset).not.toHaveBeenCalled();
      expect(result instanceof Response ? result.status : 200).toBe(400);
      expect(jsonResult.error).toContain("required");
    });

    it("should reject empty tags", async () => {
      const formData = createFormData({
        _action: "create_hashtag_preset",
        name: "Test Preset",
        tags: "   ",
      });

      const result = await handleHashtagPresetAction(
        TEST_USER_ID,
        "create_hashtag_preset",
        formData
      );
      const responseObj =
        result instanceof Response
          ? result
          : new Response(JSON.stringify(result));
      const jsonResultRaw: unknown = await responseObj.json();
      const jsonResult =
        jsonResultRaw &&
        typeof jsonResultRaw === "object" &&
        !Array.isArray(jsonResultRaw)
          ? (jsonResultRaw as { success?: boolean; error?: string })
          : {};

      expect(createHashTagPreset).not.toHaveBeenCalled();
      expect(result instanceof Response ? result.status : 200).toBe(400);
      expect(jsonResult.error).toContain("required");
    });

    it("should handle optional description", async () => {
      (createHashTagPreset as ReturnType<typeof vi.fn>).mockResolvedValue(
        undefined
      );

      const formData = createFormData({
        _action: "create_hashtag_preset",
        name: "Test Preset",
        tags: "#tag1 #tag2",
        description: "Test description",
      });

      const result = await handleHashtagPresetAction(
        TEST_USER_ID,
        "create_hashtag_preset",
        formData
      );
      const responseObj =
        result instanceof Response
          ? result
          : new Response(JSON.stringify(result));
      const jsonResultRaw: unknown = await responseObj.json();
      const jsonResult =
        jsonResultRaw &&
        typeof jsonResultRaw === "object" &&
        !Array.isArray(jsonResultRaw)
          ? (jsonResultRaw as { success?: boolean; error?: string })
          : {};

      expect(createHashTagPreset).toHaveBeenCalledWith(
        TEST_USER_ID,
        "Test Preset",
        "#tag1 #tag2",
        "Test description"
      );
      expect(jsonResult).toEqual({ success: true });
    });

    it("should handle missing description", async () => {
      (createHashTagPreset as ReturnType<typeof vi.fn>).mockResolvedValue(
        undefined
      );

      const formData = createFormData({
        _action: "create_hashtag_preset",
        name: "Test Preset",
        tags: "#tag1 #tag2",
      });

      const result = await handleHashtagPresetAction(
        TEST_USER_ID,
        "create_hashtag_preset",
        formData
      );
      const responseObj =
        result instanceof Response
          ? result
          : new Response(JSON.stringify(result));
      const jsonResultRaw: unknown = await responseObj.json();
      const jsonResult =
        jsonResultRaw &&
        typeof jsonResultRaw === "object" &&
        !Array.isArray(jsonResultRaw)
          ? (jsonResultRaw as { success?: boolean; error?: string })
          : {};

      expect(createHashTagPreset).toHaveBeenCalledWith(
        TEST_USER_ID,
        "Test Preset",
        "#tag1 #tag2",
        undefined
      );
      expect(jsonResult).toEqual({ success: true });
    });
  });

  describe("update_hashtag_preset", () => {
    it("should reject missing ID", async () => {
      const formData = createFormData({
        _action: "update_hashtag_preset",
        name: "Updated Preset",
        tags: "#tag1 #tag2",
      });

      const result = await handleHashtagPresetAction(
        TEST_USER_ID,
        "update_hashtag_preset",
        formData
      );
      const responseObj =
        result instanceof Response
          ? result
          : new Response(JSON.stringify(result));
      const jsonResultRaw: unknown = await responseObj.json();
      const jsonResult =
        jsonResultRaw &&
        typeof jsonResultRaw === "object" &&
        !Array.isArray(jsonResultRaw)
          ? (jsonResultRaw as { success?: boolean; error?: string })
          : {};

      expect(updateHashTagPreset).not.toHaveBeenCalled();
      expect(result instanceof Response ? result.status : 200).toBe(400);
      expect(jsonResult.error).toContain("Invalid input");
    });

    it("should reject empty name", async () => {
      const formData = createFormData({
        _action: "update_hashtag_preset",
        id: "preset-123",
        name: "   ",
        tags: "#tag1 #tag2",
      });

      const result = await handleHashtagPresetAction(
        TEST_USER_ID,
        "update_hashtag_preset",
        formData
      );
      const responseObj =
        result instanceof Response
          ? result
          : new Response(JSON.stringify(result));
      const jsonResultRaw: unknown = await responseObj.json();
      const jsonResult =
        jsonResultRaw &&
        typeof jsonResultRaw === "object" &&
        !Array.isArray(jsonResultRaw)
          ? (jsonResultRaw as { success?: boolean; error?: string })
          : {};

      expect(updateHashTagPreset).not.toHaveBeenCalled();
      expect(result instanceof Response ? result.status : 200).toBe(400);
      expect(jsonResult.error).toContain("Name is required");
    });

    it("should reject empty tags", async () => {
      const formData = createFormData({
        _action: "update_hashtag_preset",
        id: "preset-123",
        name: "Updated Preset",
        tags: "   ",
      });

      const result = await handleHashtagPresetAction(
        TEST_USER_ID,
        "update_hashtag_preset",
        formData
      );
      const responseObj =
        result instanceof Response
          ? result
          : new Response(JSON.stringify(result));
      const jsonResultRaw: unknown = await responseObj.json();
      const jsonResult =
        jsonResultRaw &&
        typeof jsonResultRaw === "object" &&
        !Array.isArray(jsonResultRaw)
          ? (jsonResultRaw as { success?: boolean; error?: string })
          : {};

      expect(updateHashTagPreset).not.toHaveBeenCalled();
      expect(result instanceof Response ? result.status : 200).toBe(400);
      expect(jsonResult.error).toContain("Tags are required");
    });

    it("should handle optional description", async () => {
      (updateHashTagPreset as ReturnType<typeof vi.fn>).mockResolvedValue(
        undefined
      );

      const formData = createFormData({
        _action: "update_hashtag_preset",
        id: "preset-123",
        name: "Updated Preset",
        tags: "#tag1 #tag2",
        description: "Updated description",
      });

      const result = await handleHashtagPresetAction(
        TEST_USER_ID,
        "update_hashtag_preset",
        formData
      );
      const responseObj =
        result instanceof Response
          ? result
          : new Response(JSON.stringify(result));
      const jsonResultRaw: unknown = await responseObj.json();
      const jsonResult =
        jsonResultRaw &&
        typeof jsonResultRaw === "object" &&
        !Array.isArray(jsonResultRaw)
          ? (jsonResultRaw as { success?: boolean; error?: string })
          : {};

      expect(updateHashTagPreset).toHaveBeenCalledWith(
        TEST_USER_ID,
        "preset-123",
        "Updated Preset",
        "#tag1 #tag2",
        "Updated description"
      );
      expect(jsonResult).toEqual({ success: true });
    });
  });

  describe("delete_hashtag_preset", () => {
    it("should reject missing ID", async () => {
      const formData = createFormData({
        _action: "delete_hashtag_preset",
      });

      const result = await handleHashtagPresetAction(
        TEST_USER_ID,
        "delete_hashtag_preset",
        formData
      );
      const responseObj =
        result instanceof Response
          ? result
          : new Response(JSON.stringify(result));
      const jsonResultRaw: unknown = await responseObj.json();
      const jsonResult =
        jsonResultRaw &&
        typeof jsonResultRaw === "object" &&
        !Array.isArray(jsonResultRaw)
          ? (jsonResultRaw as { success?: boolean; error?: string })
          : {};

      expect(deleteHashTagPreset).not.toHaveBeenCalled();
      expect(result instanceof Response ? result.status : 200).toBe(400);
      expect(jsonResult.error).toContain("Invalid input");
    });

    it("should delete preset with valid ID", async () => {
      (deleteHashTagPreset as ReturnType<typeof vi.fn>).mockResolvedValue(
        undefined
      );

      const formData = createFormData({
        _action: "delete_hashtag_preset",
        id: "preset-123",
      });

      const result = await handleHashtagPresetAction(
        TEST_USER_ID,
        "delete_hashtag_preset",
        formData
      );
      const responseObj =
        result instanceof Response
          ? result
          : new Response(JSON.stringify(result));
      const jsonResultRaw: unknown = await responseObj.json();
      const jsonResult =
        jsonResultRaw &&
        typeof jsonResultRaw === "object" &&
        !Array.isArray(jsonResultRaw)
          ? (jsonResultRaw as { success?: boolean; error?: string })
          : {};

      expect(deleteHashTagPreset).toHaveBeenCalledWith(
        TEST_USER_ID,
        "preset-123"
      );
      expect(jsonResult).toEqual({ success: true });
    });
  });

  describe("Invalid actions", () => {
    it("should return null for unknown action", async () => {
      const formData = createFormData({
        _action: "unknown_action",
      });

      const result = await handleHashtagPresetAction(
        TEST_USER_ID,
        "unknown_action",
        formData
      );

      expect(result).toBeNull();
    });
  });
});
