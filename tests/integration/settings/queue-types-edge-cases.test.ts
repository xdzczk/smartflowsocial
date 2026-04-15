/**
 * Edge case tests for queue types action handlers
 * Tests app/features/settings/actions/queue-types-actions.server.ts
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock dependencies
vi.mock("~/features/payments/data", () => ({
  getUserSubscription: vi.fn(),
}));

vi.mock("~/features/user", () => ({
  updateQueueType: vi.fn(),
  deleteQueueType: vi.fn(),
  getQueueTypeByIdForUser: vi.fn(),
  hashTagPresetExistsForUser: vi.fn(),
}));

vi.mock("~/features/user/services/user-cache.server", () => ({
  invalidateQueueTypesCache: vi.fn(),
}));

vi.mock("~/features/posts/server", () => ({
  getScheduledPosts: vi.fn().mockResolvedValue({
    posts: [],
    pagination: { total: 0, pages: 0, currentPage: 1, limit: 100 },
  }),
  getScheduledLongFormPosts: vi.fn().mockResolvedValue({
    posts: [],
    pagination: { total: 0, pages: 0, currentPage: 1, limit: 100 },
  }),
  deletePost: vi.fn().mockResolvedValue(null),
  deleteLongFormPost: vi.fn().mockResolvedValue(null),
}));

import { createFormData, TEST_USER_ID } from "../../utils/test-helpers";

import { getUserSubscription } from "~/features/payments/data";
import { handleQueueTypeAction } from "~/features/settings/actions/queue-types-actions.server";
import { updateQueueType } from "~/features/user";

/** Minimal queue type returned by updateQueueType/create so queueTypeToClient gets a valid value */
const MOCK_QUEUE_TYPE = {
  id: "queue-mock",
  name: "Test Queue",
  colorToken: null as string | null,
  description: null as string | null,
  scheduleType: "INTERVAL",
  scheduleConfig: {},
  isEnabled: true,
  userId: TEST_USER_ID,
  hashTagPreset: null,
};

describe("Queue Types Action Handler - Edge Cases", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (getUserSubscription as ReturnType<typeof vi.fn>).mockResolvedValue({
      Plan: { price: 10 }, // Paid plan
    });
  });

  describe("create_queue_type", () => {
    it("should handle 'none' as hashtag preset ID", async () => {
      (updateQueueType as ReturnType<typeof vi.fn>).mockResolvedValue(
        MOCK_QUEUE_TYPE
      );

      const formData = createFormData({
        _action: "create_queue_type",
        name: "Test Queue",
        scheduleType: "INTERVAL",
        intervalHours: "4",
        color: "#FF0000",
        hashTagPresetId: "none",
      });

      const result = await handleQueueTypeAction(
        TEST_USER_ID,
        "create_queue_type",
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

      expect(updateQueueType).toHaveBeenCalledWith(
        TEST_USER_ID,
        expect.objectContaining({
          hashTagPresetId: null,
        })
      );
      expect(jsonResult).toMatchObject({ success: true });
    });

    it("should handle empty hashtag preset ID", async () => {
      (updateQueueType as ReturnType<typeof vi.fn>).mockResolvedValue(
        MOCK_QUEUE_TYPE
      );

      const formData = createFormData({
        _action: "create_queue_type",
        name: "Test Queue",
        scheduleType: "INTERVAL",
        intervalHours: "4",
        color: "#FF0000",
        hashTagPresetId: "",
      });

      const result = await handleQueueTypeAction(
        TEST_USER_ID,
        "create_queue_type",
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

      expect(updateQueueType).toHaveBeenCalledWith(
        TEST_USER_ID,
        expect.objectContaining({
          hashTagPresetId: null,
        })
      );
      expect(jsonResult).toMatchObject({ success: true });
    });

    it("should handle useGlobalInterval flag for INTERVAL schedule", async () => {
      (updateQueueType as ReturnType<typeof vi.fn>).mockResolvedValue(
        MOCK_QUEUE_TYPE
      );

      const formData = createFormData({
        _action: "create_queue_type",
        name: "Test Queue",
        scheduleType: "INTERVAL",
        useGlobalInterval: "on",
        color: "#FF0000",
        hashTagPresetId: "none", // Optional, but schema expects it to be present or "none"
      });

      const result = await handleQueueTypeAction(
        TEST_USER_ID,
        "create_queue_type",
        formData
      );

      // Check if validation failed
      if (result instanceof Response && result.status === 400) {
        const data = (await result.json()) as { error?: unknown };
        throw new Error(`Validation failed: ${JSON.stringify(data)}`);
      }

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

      expect(updateQueueType).toHaveBeenCalledWith(
        TEST_USER_ID,
        expect.objectContaining({
          scheduleConfig: { useGlobalInterval: true },
        })
      );
      expect(jsonResult).toMatchObject({ success: true });
    });

    it("should handle FIXED_SLOTS with comma-separated slots", async () => {
      (updateQueueType as ReturnType<typeof vi.fn>).mockResolvedValue(
        MOCK_QUEUE_TYPE
      );

      const formData = createFormData({
        _action: "create_queue_type",
        name: "Test Queue",
        scheduleType: "FIXED_SLOTS",
        slots: "09:00, 12:00, 15:00, 18:00",
        color: "#FF0000",
        hashTagPresetId: "none",
      });

      const result = await handleQueueTypeAction(
        TEST_USER_ID,
        "create_queue_type",
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

      expect(updateQueueType).toHaveBeenCalledWith(
        TEST_USER_ID,
        expect.objectContaining({
          scheduleConfig: { slots: ["09:00", "12:00", "15:00", "18:00"] },
        })
      );
      expect(jsonResult).toMatchObject({ success: true });
    });

    it("should filter out empty slots", async () => {
      (updateQueueType as ReturnType<typeof vi.fn>).mockResolvedValue(
        MOCK_QUEUE_TYPE
      );

      const formData = createFormData({
        _action: "create_queue_type",
        name: "Test Queue",
        scheduleType: "FIXED_SLOTS",
        slots: "09:00, , 12:00,  , 15:00",
        color: "#FF0000",
        hashTagPresetId: "none",
      });

      const result = await handleQueueTypeAction(
        TEST_USER_ID,
        "create_queue_type",
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

      expect(updateQueueType).toHaveBeenCalledWith(
        TEST_USER_ID,
        expect.objectContaining({
          scheduleConfig: { slots: ["09:00", "12:00", "15:00"] },
        })
      );
      expect(jsonResult).toMatchObject({ success: true });
    });

    it("should normalize and dedupe weekly slots before saving", async () => {
      (updateQueueType as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: "queue-weekly",
        name: "Weekly Queue",
        colorToken: "slate",
        description: null,
        scheduleType: "WEEKLY_SLOTS",
        scheduleConfig: {
          weeklySlots: [
            { dayOfWeek: 1, time: "09:00" },
            { dayOfWeek: 4, time: "19:45" },
          ],
        },
        isEnabled: true,
        userId: TEST_USER_ID,
        hashTagPreset: null,
      });

      const formData = createFormData({
        _action: "create_queue_type",
        name: "Weekly Queue",
        scheduleType: "WEEKLY_SLOTS",
        weeklySlots: JSON.stringify([
          { dayOfWeek: 4, time: "19:45" },
          { dayOfWeek: 4, time: "19:45" }, // duplicate
          { dayOfWeek: 1, time: "9:00" }, // non-normalized hour
        ]),
        colorToken: "slate",
        hashTagPresetId: "none",
      });

      await handleQueueTypeAction(TEST_USER_ID, "create_queue_type", formData);

      expect(updateQueueType).toHaveBeenCalledWith(
        TEST_USER_ID,
        expect.objectContaining({
          scheduleType: "WEEKLY_SLOTS",
          scheduleConfig: {
            weeklySlots: [
              { dayOfWeek: 1, time: "09:00" },
              { dayOfWeek: 4, time: "19:45" },
            ],
          },
        })
      );
    });
  });

  describe("update_queue_type", () => {
    it("should handle isEnabled flag", async () => {
      (updateQueueType as ReturnType<typeof vi.fn>).mockResolvedValue(
        MOCK_QUEUE_TYPE
      );

      const formData = createFormData({
        _action: "update_queue_type",
        id: "queue-123",
        name: "Updated Queue",
        scheduleType: "INTERVAL",
        intervalHours: "6",
        colorToken: "green",
        isEnabled: "on",
      });

      const result = await handleQueueTypeAction(
        TEST_USER_ID,
        "update_queue_type",
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

      expect(updateQueueType).toHaveBeenCalledWith(
        TEST_USER_ID,
        expect.objectContaining({
          id: "queue-123",
          isEnabled: true,
        })
      );
      expect(jsonResult).toMatchObject({ success: true });
    });

    it("should handle isEnabled as false when not 'on'", async () => {
      (updateQueueType as ReturnType<typeof vi.fn>).mockResolvedValue(
        MOCK_QUEUE_TYPE
      );

      const formData = createFormData({
        _action: "update_queue_type",
        id: "queue-123",
        name: "Updated Queue",
        scheduleType: "INTERVAL",
        intervalHours: "6",
        colorToken: "green",
        isEnabled: "off",
        hashTagPresetId: "none",
      });

      const result = await handleQueueTypeAction(
        TEST_USER_ID,
        "update_queue_type",
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

      expect(updateQueueType).toHaveBeenCalledWith(
        TEST_USER_ID,
        expect.objectContaining({
          isEnabled: false,
        })
      );
      expect(jsonResult).toMatchObject({ success: true });
    });
  });

  describe("Invalid actions", () => {
    it("should return null for unknown action", async () => {
      const formData = createFormData({
        _action: "unknown_action",
      });

      const result = await handleQueueTypeAction(
        TEST_USER_ID,
        "unknown_action",
        formData
      );

      expect(result).toBeNull();
    });
  });
});
