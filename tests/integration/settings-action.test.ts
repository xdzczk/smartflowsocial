/**
 * Integration tests for settings action handlers
 * 
 * Tests the action handler logic directly, without requiring a browser.
 * For UI interaction tests, see tests/e2e/settings/*.cy.ts
 * 
 * Note: This file tests the most critical settings actions.
 * The full settings-actions.server.ts has many actions - we test the key ones.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
// Mock all dependencies
vi.mock("~/models/user.server", () => ({
  updateUserTimezone: vi.fn(),
  updateUserRelays: vi.fn(),
  updateGiveawayBlacklist: vi.fn(),
  updateScheduleInterval: vi.fn(),
  updateQueueType: vi.fn(),
  deleteQueueType: vi.fn(),
  createHashTagPreset: vi.fn(),
  updateHashTagPreset: vi.fn(),
  deleteHashTagPreset: vi.fn(),
  hashTagPresetExistsForUser: vi.fn(),
  getUserSubscription: vi.fn(),
}));

vi.mock("~/models/payment.server", () => ({
  getUserSubscription: vi.fn(),
}));

import { handleSettingsAction } from "~/features/settings/settings-actions.server";
import { getUserSubscription } from "~/models/payment.server";
import {
  updateUserTimezone,
  updateUserRelays,
  updateGiveawayBlacklist,
  updateScheduleInterval,
  updateQueueType,
  deleteQueueType,
  createHashTagPreset,
  updateHashTagPreset,
  deleteHashTagPreset,
  hashTagPresetExistsForUser,
} from "~/models/user.server";

import { createFormData, TEST_USER_ID } from "../utils/test-helpers";

describe("Settings Action Handler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Default mocks
    (getUserSubscription as ReturnType<typeof vi.fn>).mockResolvedValue({
      Plan: { price: 1000 }, // Paid plan
    });
    (hashTagPresetExistsForUser as ReturnType<typeof vi.fn>).mockResolvedValue(true);
  });

  describe("General Settings Actions", () => {
    describe("Update Timezone", () => {
      it("should update user timezone", async () => {
        (updateUserTimezone as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

        const formData = createFormData({
          _action: "update_timezone",
          timezone: "America/New_York",
        });

        const result = await handleSettingsAction(TEST_USER_ID, formData);
        const dataRaw: unknown = await result.json();
        const data = dataRaw && typeof dataRaw === "object" && !Array.isArray(dataRaw) ? dataRaw as { success?: unknown; error?: unknown } : {};

        expect(updateUserTimezone).toHaveBeenCalledWith(
          TEST_USER_ID,
          "America/New_York",
        );
        expect(data).toEqual({ success: true });
      });
    });

    describe("Update Relays", () => {
      it("should update user relays", async () => {
        (updateUserRelays as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

        const formData = createFormData({
          _action: "update_relays",
          relays: "wss://relay1.com\nwss://relay2.com\nwss://relay3.com",
        });

        const result = await handleSettingsAction(TEST_USER_ID, formData);
        const dataRaw: unknown = await result.json();
        const data = dataRaw && typeof dataRaw === "object" && !Array.isArray(dataRaw) ? dataRaw as { success?: unknown; error?: unknown } : {};

        expect(updateUserRelays).toHaveBeenCalledWith(TEST_USER_ID, [
          "wss://relay1.com",
          "wss://relay2.com",
          "wss://relay3.com",
        ]);
        expect(data).toEqual({ success: true });
      });

      it("should filter out empty relay lines", async () => {
        (updateUserRelays as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

        const formData = createFormData({
          _action: "update_relays",
          relays: "wss://relay1.com\n\nwss://relay2.com\n  \nwss://relay3.com",
        });

        const result = await handleSettingsAction(TEST_USER_ID, formData);
        const dataRaw: unknown = await result.json();
        const data = dataRaw && typeof dataRaw === "object" && !Array.isArray(dataRaw) ? dataRaw as { success?: unknown; error?: unknown } : {};

        expect(updateUserRelays).toHaveBeenCalledWith(TEST_USER_ID, [
          "wss://relay1.com",
          "wss://relay2.com",
          "wss://relay3.com",
        ]);
        expect(data).toEqual({ success: true });
      });
    });

    describe("Update Giveaway Blacklist", () => {
      it("should update giveaway blacklist with valid npubs", async () => {
        (updateGiveawayBlacklist as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

        const formData = createFormData({
          _action: "update_blacklist",
          blacklist: "npub1abc123\nnpub1def456\nnpub1ghi789",
        });

        const result = await handleSettingsAction(TEST_USER_ID, formData);
        const dataRaw: unknown = await result.json();
        const data = dataRaw && typeof dataRaw === "object" && !Array.isArray(dataRaw) ? dataRaw as { success?: unknown; error?: unknown } : {};

        expect(updateGiveawayBlacklist).toHaveBeenCalledWith(TEST_USER_ID, [
          "npub1abc123",
          "npub1def456",
          "npub1ghi789",
        ]);
        expect(data).toEqual({ success: true });
      });

      it("should reject blacklist items that don't start with npub", async () => {
        const formData = createFormData({
          _action: "update_blacklist",
          blacklist: "npub1abc123\ninvalid-npub\nnpub1def456",
        });

        const result = await handleSettingsAction(TEST_USER_ID, formData);
        const dataRaw: unknown = await result.json();
        const data = dataRaw && typeof dataRaw === "object" && !Array.isArray(dataRaw) ? dataRaw as { success?: unknown; error?: unknown } : {};

        expect(updateGiveawayBlacklist).not.toHaveBeenCalled();
        expect(result.status).toBe(400);
        expect(data).toEqual({
          error: "All blacklist items must start with npub",
        });
      });
    });

    describe("Update Schedule Intervals", () => {
      it("should update schedule intervals with valid numbers", async () => {
        (updateScheduleInterval as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

        const formData = createFormData({
          _action: "update_schedule_intervals",
          scheduleIntervals: "2\n3\n4\n5",
        });

        const result = await handleSettingsAction(TEST_USER_ID, formData);
        const dataRaw: unknown = await result.json();
        const data = dataRaw && typeof dataRaw === "object" && !Array.isArray(dataRaw) ? dataRaw as { success?: unknown; error?: unknown } : {};

        expect(updateScheduleInterval).toHaveBeenCalledWith(TEST_USER_ID, [
          "2",
          "3",
          "4",
          "5",
        ]);
        expect(data).toEqual({ success: true });
      });

      it("should reject invalid schedule intervals", async () => {
        const formData = createFormData({
          _action: "update_schedule_intervals",
          scheduleIntervals: "09:00\ninvalid\n15:00",
        });

        const result = await handleSettingsAction(TEST_USER_ID, formData);
        const dataRaw: unknown = await result.json();
        const data = dataRaw && typeof dataRaw === "object" && !Array.isArray(dataRaw) ? dataRaw as { success?: unknown; error?: unknown } : {};

        expect(updateScheduleInterval).not.toHaveBeenCalled();
        expect(result.status).toBe(400);
        expect(data).toEqual({
          error: "All schedule intervals must be positive whole numbers",
        });
      });
    });
  });

  describe("Hashtag Preset Actions", () => {
    describe("Create Hashtag Preset", () => {
      it("should create a hashtag preset", async () => {
        (createHashTagPreset as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

        const formData = createFormData({
          _action: "create_hashtag_preset",
          name: "Marketing Tags",
          tags: "#marketing #social #growth",
          description: "Tags for marketing posts",
        });

        const result = await handleSettingsAction(TEST_USER_ID, formData);
        const dataRaw: unknown = await result.json();
        const data = dataRaw && typeof dataRaw === "object" && !Array.isArray(dataRaw) ? dataRaw as { success?: unknown; error?: unknown } : {};

        expect(createHashTagPreset).toHaveBeenCalledWith(
          TEST_USER_ID,
          "Marketing Tags",
          "#marketing #social #growth",
          "Tags for marketing posts",
        );
        expect(data).toEqual({ success: true });
      });

      it("should require name and tags", async () => {
        const formData = createFormData({
          _action: "create_hashtag_preset",
          name: "",
          tags: "#marketing",
        });

        const result = await handleSettingsAction(TEST_USER_ID, formData);
        const dataRaw: unknown = await result.json();
        const data = dataRaw && typeof dataRaw === "object" && !Array.isArray(dataRaw) ? dataRaw as { success?: unknown; error?: unknown } : {};

        expect(createHashTagPreset).not.toHaveBeenCalled();
        expect(result.status).toBe(400);
        expect(data).toEqual({
          error: "Name and tags are required",
        });
      });

      it("should allow description to be optional", async () => {
        (createHashTagPreset as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

        const formData = createFormData({
          _action: "create_hashtag_preset",
          name: "Marketing Tags",
          tags: "#marketing",
        });

        const result = await handleSettingsAction(TEST_USER_ID, formData);
        const dataRaw: unknown = await result.json();
        const data = dataRaw && typeof dataRaw === "object" && !Array.isArray(dataRaw) ? dataRaw as { success?: unknown; error?: unknown } : {};

        expect(createHashTagPreset).toHaveBeenCalledWith(
          TEST_USER_ID,
          "Marketing Tags",
          "#marketing",
          undefined,
        );
        expect(data).toEqual({ success: true });
      });
    });

    describe("Update Hashtag Preset", () => {
      it("should update a hashtag preset", async () => {
        (updateHashTagPreset as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

        const formData = createFormData({
          _action: "update_hashtag_preset",
          id: "preset-123",
          name: "Updated Marketing Tags",
          tags: "#marketing #updated",
          description: "Updated description",
        });

        const result = await handleSettingsAction(TEST_USER_ID, formData);
        const dataRaw: unknown = await result.json();
        const data = dataRaw && typeof dataRaw === "object" && !Array.isArray(dataRaw) ? dataRaw as { success?: unknown; error?: unknown } : {};

        expect(updateHashTagPreset).toHaveBeenCalledWith(
          TEST_USER_ID,
          "preset-123",
          "Updated Marketing Tags",
          "#marketing #updated",
          "Updated description",
        );
        expect(data).toEqual({ success: true });
      });

      it("should require id, name and tags", async () => {
        const formData = createFormData({
          _action: "update_hashtag_preset",
          id: "preset-123",
          name: "",
          tags: "#marketing",
        });

        const result = await handleSettingsAction(TEST_USER_ID, formData);
        const dataRaw: unknown = await result.json();
        const data = dataRaw && typeof dataRaw === "object" && !Array.isArray(dataRaw) ? dataRaw as { success?: unknown; error?: unknown } : {};

        expect(updateHashTagPreset).not.toHaveBeenCalled();
        expect(result.status).toBe(400);
        expect(data).toEqual({
          error: "ID, name and tags are required",
        });
      });
    });

    describe("Delete Hashtag Preset", () => {
      it("should delete a hashtag preset", async () => {
        (deleteHashTagPreset as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

        const formData = createFormData({
          _action: "delete_hashtag_preset",
          id: "preset-123",
        });

        const result = await handleSettingsAction(TEST_USER_ID, formData);
        const dataRaw: unknown = await result.json();
        const data = dataRaw && typeof dataRaw === "object" && !Array.isArray(dataRaw) ? dataRaw as { success?: unknown; error?: unknown } : {};

        expect(deleteHashTagPreset).toHaveBeenCalledWith(TEST_USER_ID, "preset-123");
        expect(data).toEqual({ success: true });
      });

      it("should require id for deletion", async () => {
        const formData = createFormData({
          _action: "delete_hashtag_preset",
        });

        const result = await handleSettingsAction(TEST_USER_ID, formData);
        const dataRaw: unknown = await result.json();
        const data = dataRaw && typeof dataRaw === "object" && !Array.isArray(dataRaw) ? dataRaw as { success?: unknown; error?: unknown } : {};

        expect(deleteHashTagPreset).not.toHaveBeenCalled();
        expect(result.status).toBe(400);
        expect(data).toEqual({
          error: "ID is required",
        });
      });
    });
  });

  describe("Queue Type Actions", () => {
    describe("Create Queue Type", () => {
      it("should create a queue type with INTERVAL schedule", async () => {
        (updateQueueType as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

        const formData = createFormData({
          _action: "create_queue_type",
          name: "Marketing Queue",
          scheduleType: "INTERVAL",
          intervalHours: "4",
          color: "#FF5733",
          description: "Marketing posts",
          hashTagPresetId: "preset-123",
        });

        const result = await handleSettingsAction(TEST_USER_ID, formData);
        const dataRaw: unknown = await result.json();
        const data = dataRaw && typeof dataRaw === "object" && !Array.isArray(dataRaw) ? dataRaw as { success?: unknown; error?: unknown } : {};

        expect(hashTagPresetExistsForUser).toHaveBeenCalledWith(
          TEST_USER_ID,
          "preset-123",
        );
        expect(updateQueueType).toHaveBeenCalledWith(TEST_USER_ID, {
          name: "Marketing Queue",
          scheduleType: "INTERVAL",
          scheduleConfig: { intervalHours: 4 },
          color: "#FF5733",
          description: "Marketing posts",
          hashTagPresetId: "preset-123",
        });
        expect(data).toEqual({ success: true });
      });

      it("should create a queue type with FIXED_SLOTS schedule", async () => {
        (updateQueueType as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

        const formData = createFormData({
          _action: "create_queue_type",
          name: "Daily Queue",
          scheduleType: "FIXED_SLOTS",
          slots: "09:00, 12:00, 15:00, 18:00",
          color: "#33FF57",
          description: "Daily posting schedule",
        });

        const result = await handleSettingsAction(TEST_USER_ID, formData);
        const dataRaw: unknown = await result.json();
        const data = dataRaw && typeof dataRaw === "object" && !Array.isArray(dataRaw) ? dataRaw as { success?: unknown; error?: unknown } : {};

        expect(updateQueueType).toHaveBeenCalledWith(TEST_USER_ID, {
          name: "Daily Queue",
          scheduleType: "FIXED_SLOTS",
          scheduleConfig: {
            slots: ["09:00", "12:00", "15:00", "18:00"],
          },
          color: "#33FF57",
          description: "Daily posting schedule",
          hashTagPresetId: null,
        });
        expect(data).toEqual({ success: true });
      });

      it("should reject queue type creation for free plan users", async () => {
        (getUserSubscription as ReturnType<typeof vi.fn>).mockResolvedValue({
          Plan: { price: 0 }, // Free plan
        });

        const formData = createFormData({
          _action: "create_queue_type",
          name: "Marketing Queue",
          scheduleType: "INTERVAL",
          intervalHours: "4",
          color: "#FF5733",
        });

        const result = await handleSettingsAction(TEST_USER_ID, formData);
        const dataRaw: unknown = await result.json();
        const data = dataRaw && typeof dataRaw === "object" && !Array.isArray(dataRaw) ? dataRaw as { success?: unknown; error?: unknown } : {};

        expect(updateQueueType).not.toHaveBeenCalled();
        expect(result.status).toBe(403);
        expect(data).toEqual({
          error:
            "Creating queue types is not available on the free plan. Please upgrade your subscription.",
        });
      });

      it("should reject invalid hashtag preset", async () => {
        (hashTagPresetExistsForUser as ReturnType<typeof vi.fn>).mockResolvedValue(false);

        const formData = createFormData({
          _action: "create_queue_type",
          name: "Marketing Queue",
          scheduleType: "INTERVAL",
          intervalHours: "4",
          color: "#FF5733",
          hashTagPresetId: "invalid-preset",
        });

        const result = await handleSettingsAction(TEST_USER_ID, formData);
        const dataRaw: unknown = await result.json();
        const data = dataRaw && typeof dataRaw === "object" && !Array.isArray(dataRaw) ? dataRaw as { success?: unknown; error?: unknown } : {};

        expect(updateQueueType).not.toHaveBeenCalled();
        expect(result.status).toBe(400);
        expect(data).toEqual({
          error: "Selected hashtag preset does not exist",
        });
      });
    });

    describe("Delete Queue Type", () => {
      it("should delete a queue type", async () => {
        (deleteQueueType as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

        const formData = createFormData({
          _action: "delete_queue_type",
          id: "queue-123",
        });

        const result = await handleSettingsAction(TEST_USER_ID, formData);
        const dataRaw: unknown = await result.json();
        const data = dataRaw && typeof dataRaw === "object" && !Array.isArray(dataRaw) ? dataRaw as { success?: unknown; error?: unknown } : {};

        expect(deleteQueueType).toHaveBeenCalledWith(TEST_USER_ID, "queue-123");
        expect(data).toEqual({ success: true });
      });
    });
  });

  describe("Error Handling", () => {
    it("should handle database errors", async () => {
      (updateUserTimezone as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error("Database error"),
      );

      const formData = createFormData({
        _action: "update_timezone",
        timezone: "America/New_York",
      });

      await expect(
        handleSettingsAction(TEST_USER_ID, formData),
      ).rejects.toThrow("Database error");
    });
  });
});

