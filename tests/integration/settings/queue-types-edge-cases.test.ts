/**
 * Edge case tests for queue types action handlers
 * Tests app/features/settings/actions/queue-types-actions.server.ts
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock dependencies
vi.mock("~/models/payment.server", () => ({
  getUserSubscription: vi.fn(),
}));

vi.mock("~/models/user.server", () => ({
  updateQueueType: vi.fn(),
  deleteQueueType: vi.fn(),
  hashTagPresetExistsForUser: vi.fn(),
}));

import { handleQueueTypeAction } from "~/features/settings/actions/queue-types-actions.server";
import { getUserSubscription } from "~/models/payment.server";
import { updateQueueType } from "~/models/user.server";

import { createFormData, TEST_USER_ID } from "../../utils/test-helpers";

describe("Queue Types Action Handler - Edge Cases", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (getUserSubscription as ReturnType<typeof vi.fn>).mockResolvedValue({
      Plan: { price: 10 }, // Paid plan
    });
  });

  describe("create_queue_type", () => {
    it("should handle 'none' as hashtag preset ID", async () => {
      (updateQueueType as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

      const formData = createFormData({
        _action: "create_queue_type",
        name: "Test Queue",
        scheduleType: "INTERVAL",
        intervalHours: "4",
        color: "#FF0000",
        hashTagPresetId: "none",
      });

      const result = await handleQueueTypeAction(TEST_USER_ID, "create_queue_type", formData);
      const responseObj = result instanceof Response ? result : new Response(JSON.stringify(result));
      const jsonResultRaw: unknown = await responseObj.json();
      const jsonResult = jsonResultRaw && typeof jsonResultRaw === "object" && !Array.isArray(jsonResultRaw) ? jsonResultRaw as { success?: boolean; error?: string } : {};

      expect(updateQueueType).toHaveBeenCalledWith(
        TEST_USER_ID,
        expect.objectContaining({
          hashTagPresetId: null,
        }),
      );
      expect(jsonResult).toEqual({ success: true });
    });

    it("should handle empty hashtag preset ID", async () => {
      (updateQueueType as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

      const formData = createFormData({
        _action: "create_queue_type",
        name: "Test Queue",
        scheduleType: "INTERVAL",
        intervalHours: "4",
        color: "#FF0000",
        hashTagPresetId: "",
      });

      const result = await handleQueueTypeAction(TEST_USER_ID, "create_queue_type", formData);
      const responseObj = result instanceof Response ? result : new Response(JSON.stringify(result));
      const jsonResultRaw: unknown = await responseObj.json();
      const jsonResult = jsonResultRaw && typeof jsonResultRaw === "object" && !Array.isArray(jsonResultRaw) ? jsonResultRaw as { success?: boolean; error?: string } : {};

      expect(updateQueueType).toHaveBeenCalledWith(
        TEST_USER_ID,
        expect.objectContaining({
          hashTagPresetId: null,
        }),
      );
      expect(jsonResult).toEqual({ success: true });
    });

    it("should handle useGlobalInterval flag for INTERVAL schedule", async () => {
      (updateQueueType as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

      const formData = createFormData({
        _action: "create_queue_type",
        name: "Test Queue",
        scheduleType: "INTERVAL",
        useGlobalInterval: "on",
        color: "#FF0000",
      });

      const result = await handleQueueTypeAction(TEST_USER_ID, "create_queue_type", formData);
      const responseObj = result instanceof Response ? result : new Response(JSON.stringify(result));
      const jsonResultRaw: unknown = await responseObj.json();
      const jsonResult = jsonResultRaw && typeof jsonResultRaw === "object" && !Array.isArray(jsonResultRaw) ? jsonResultRaw as { success?: boolean; error?: string } : {};

      expect(updateQueueType).toHaveBeenCalledWith(
        TEST_USER_ID,
        expect.objectContaining({
          scheduleConfig: { useGlobalInterval: true },
        }),
      );
      expect(jsonResult).toEqual({ success: true });
    });

    it("should handle FIXED_SLOTS with comma-separated slots", async () => {
      (updateQueueType as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

      const formData = createFormData({
        _action: "create_queue_type",
        name: "Test Queue",
        scheduleType: "FIXED_SLOTS",
        slots: "09:00, 12:00, 15:00, 18:00",
        color: "#FF0000",
      });

      const result = await handleQueueTypeAction(TEST_USER_ID, "create_queue_type", formData);
      const responseObj = result instanceof Response ? result : new Response(JSON.stringify(result));
      const jsonResultRaw: unknown = await responseObj.json();
      const jsonResult = jsonResultRaw && typeof jsonResultRaw === "object" && !Array.isArray(jsonResultRaw) ? jsonResultRaw as { success?: boolean; error?: string } : {};

      expect(updateQueueType).toHaveBeenCalledWith(
        TEST_USER_ID,
        expect.objectContaining({
          scheduleConfig: { slots: ["09:00", "12:00", "15:00", "18:00"] },
        }),
      );
      expect(jsonResult).toEqual({ success: true });
    });

    it("should filter out empty slots", async () => {
      (updateQueueType as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

      const formData = createFormData({
        _action: "create_queue_type",
        name: "Test Queue",
        scheduleType: "FIXED_SLOTS",
        slots: "09:00, , 12:00,  , 15:00",
        color: "#FF0000",
      });

      const result = await handleQueueTypeAction(TEST_USER_ID, "create_queue_type", formData);
      const responseObj = result instanceof Response ? result : new Response(JSON.stringify(result));
      const jsonResultRaw: unknown = await responseObj.json();
      const jsonResult = jsonResultRaw && typeof jsonResultRaw === "object" && !Array.isArray(jsonResultRaw) ? jsonResultRaw as { success?: boolean; error?: string } : {};

      expect(updateQueueType).toHaveBeenCalledWith(
        TEST_USER_ID,
        expect.objectContaining({
          scheduleConfig: { slots: ["09:00", "12:00", "15:00"] },
        }),
      );
      expect(jsonResult).toEqual({ success: true });
    });
  });

  describe("update_queue_type", () => {
    it("should handle isEnabled flag", async () => {
      (updateQueueType as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

      const formData = createFormData({
        _action: "update_queue_type",
        id: "queue-123",
        name: "Updated Queue",
        scheduleType: "INTERVAL",
        intervalHours: "6",
        color: "#00FF00",
        isEnabled: "on",
      });

      const result = await handleQueueTypeAction(TEST_USER_ID, "update_queue_type", formData);
      const responseObj = result instanceof Response ? result : new Response(JSON.stringify(result));
      const jsonResultRaw: unknown = await responseObj.json();
      const jsonResult = jsonResultRaw && typeof jsonResultRaw === "object" && !Array.isArray(jsonResultRaw) ? jsonResultRaw as { success?: boolean; error?: string } : {};

      expect(updateQueueType).toHaveBeenCalledWith(
        TEST_USER_ID,
        expect.objectContaining({
          id: "queue-123",
          isEnabled: true,
        }),
      );
      expect(jsonResult).toEqual({ success: true });
    });

    it("should handle isEnabled as false when not 'on'", async () => {
      (updateQueueType as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

      const formData = createFormData({
        _action: "update_queue_type",
        id: "queue-123",
        name: "Updated Queue",
        scheduleType: "INTERVAL",
        intervalHours: "6",
        color: "#00FF00",
        isEnabled: "off",
      });

      const result = await handleQueueTypeAction(TEST_USER_ID, "update_queue_type", formData);
      const responseObj = result instanceof Response ? result : new Response(JSON.stringify(result));
      const jsonResultRaw: unknown = await responseObj.json();
      const jsonResult = jsonResultRaw && typeof jsonResultRaw === "object" && !Array.isArray(jsonResultRaw) ? jsonResultRaw as { success?: boolean; error?: string } : {};

      expect(updateQueueType).toHaveBeenCalledWith(
        TEST_USER_ID,
        expect.objectContaining({
          isEnabled: false,
        }),
      );
      expect(jsonResult).toEqual({ success: true });
    });
  });

  describe("Invalid actions", () => {
    it("should return null for unknown action", async () => {
      const formData = createFormData({
        _action: "unknown_action",
      });

      const result = await handleQueueTypeAction(TEST_USER_ID, "unknown_action", formData);

      expect(result).toBeNull();
    });
  });
});

