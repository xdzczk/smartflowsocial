/**
 * Edge case tests for general settings action handlers
 * Tests app/features/settings/actions/general-settings-actions.server.ts
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock dependencies
vi.mock("~/models/user.server", () => ({
  updateUserTimezone: vi.fn(),
  updateUserRelays: vi.fn(),
  updateGiveawayBlacklist: vi.fn(),
  updateScheduleInterval: vi.fn(),
}));

import { handleGeneralSettingsAction } from "~/features/settings/actions/general-settings-actions.server";
import {
  updateUserRelays,
  updateGiveawayBlacklist,
  updateScheduleInterval,
} from "~/features/user";

import { createFormData, TEST_USER_ID } from "../../utils/test-helpers";

describe("General Settings Action Handler - Edge Cases", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("update_relays", () => {
    it("should filter out empty relay lines", async () => {
      (updateUserRelays as ReturnType<typeof vi.fn>).mockResolvedValue(
        undefined,
      );

      const formData = createFormData({
        _action: "update_relays",
        relays: "wss://relay1.com\n\nwss://relay2.com\n  \nwss://relay3.com",
      });

      const result = await handleGeneralSettingsAction(
        TEST_USER_ID,
        "update_relays",
        formData,
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

      expect(updateUserRelays).toHaveBeenCalledWith(TEST_USER_ID, [
        "wss://relay1.com",
        "wss://relay2.com",
        "wss://relay3.com",
      ]);
      expect(jsonResult).toEqual({ success: true });
    });

    it("should handle single relay", async () => {
      (updateUserRelays as ReturnType<typeof vi.fn>).mockResolvedValue(
        undefined,
      );

      const formData = createFormData({
        _action: "update_relays",
        relays: "wss://relay1.com",
      });

      const result = await handleGeneralSettingsAction(
        TEST_USER_ID,
        "update_relays",
        formData,
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

      expect(updateUserRelays).toHaveBeenCalledWith(TEST_USER_ID, [
        "wss://relay1.com",
      ]);
      expect(jsonResult).toEqual({ success: true });
    });

    it("should handle empty relays string", async () => {
      (updateUserRelays as ReturnType<typeof vi.fn>).mockResolvedValue(
        undefined,
      );

      const formData = createFormData({
        _action: "update_relays",
        relays: "",
      });

      const result = await handleGeneralSettingsAction(
        TEST_USER_ID,
        "update_relays",
        formData,
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

      expect(updateUserRelays).toHaveBeenCalledWith(TEST_USER_ID, []);
      expect(jsonResult).toEqual({ success: true });
    });
  });

  describe("update_blacklist", () => {
    it("should reject blacklist items that don't start with npub", async () => {
      const formData = createFormData({
        _action: "update_blacklist",
        blacklist: "npub1abc\ninvalid-npub\nnpub2def",
      });

      const result = await handleGeneralSettingsAction(
        TEST_USER_ID,
        "update_blacklist",
        formData,
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

      expect(updateGiveawayBlacklist).not.toHaveBeenCalled();
      expect(result instanceof Response ? result.status : 200).toBe(400);
      expect(jsonResult.error).toContain("All blacklist items must start with npub");
    });

    it("should accept valid npub entries", async () => {
      (updateGiveawayBlacklist as ReturnType<typeof vi.fn>).mockResolvedValue(
        undefined,
      );

      const formData = createFormData({
        _action: "update_blacklist",
        blacklist: "npub1abc\nnpub2def\nnpub3ghi",
      });

      const result = await handleGeneralSettingsAction(
        TEST_USER_ID,
        "update_blacklist",
        formData,
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

      expect(updateGiveawayBlacklist).toHaveBeenCalledWith(TEST_USER_ID, [
        "npub1abc",
        "npub2def",
        "npub3ghi",
      ]);
      expect(jsonResult).toEqual({ success: true });
    });

    it("should filter out empty lines", async () => {
      (updateGiveawayBlacklist as ReturnType<typeof vi.fn>).mockResolvedValue(
        undefined,
      );

      const formData = createFormData({
        _action: "update_blacklist",
        blacklist: "npub1abc\n\nnpub2def\n  \n",
      });

      const result = await handleGeneralSettingsAction(
        TEST_USER_ID,
        "update_blacklist",
        formData,
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

      expect(updateGiveawayBlacklist).toHaveBeenCalledWith(TEST_USER_ID, [
        "npub1abc",
        "npub2def",
      ]);
      expect(jsonResult).toEqual({ success: true });
    });

    it("should handle empty blacklist", async () => {
      (updateGiveawayBlacklist as ReturnType<typeof vi.fn>).mockResolvedValue(
        undefined,
      );

      const formData = createFormData({
        _action: "update_blacklist",
        blacklist: "",
      });

      const result = await handleGeneralSettingsAction(
        TEST_USER_ID,
        "update_blacklist",
        formData,
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

      expect(updateGiveawayBlacklist).toHaveBeenCalledWith(TEST_USER_ID, []);
      expect(jsonResult).toEqual({ success: true });
    });
  });

  describe("update_schedule_intervals", () => {
    it("should reject non-numeric intervals", async () => {
      const formData = createFormData({
        _action: "update_schedule_intervals",
        scheduleIntervals: "4\nabc\n6",
      });

      const result = await handleGeneralSettingsAction(
        TEST_USER_ID,
        "update_schedule_intervals",
        formData,
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

      expect(updateScheduleInterval).not.toHaveBeenCalled();
      expect(result instanceof Response ? result.status : 200).toBe(400);
      expect(jsonResult.error).toContain("Must be a positive whole number");
    });

    it("should reject zero or negative intervals", async () => {
      const formData = createFormData({
        _action: "update_schedule_intervals",
        scheduleIntervals: "4\n0\n-2",
      });

      const result = await handleGeneralSettingsAction(
        TEST_USER_ID,
        "update_schedule_intervals",
        formData,
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

      expect(updateScheduleInterval).not.toHaveBeenCalled();
      expect(result instanceof Response ? result.status : 200).toBe(400);
      expect(jsonResult.error).toContain("Must be a positive whole number");
    });

    it("should reject decimal intervals", async () => {
      const formData = createFormData({
        _action: "update_schedule_intervals",
        scheduleIntervals: "4\n4.5\n6",
      });

      const result = await handleGeneralSettingsAction(
        TEST_USER_ID,
        "update_schedule_intervals",
        formData,
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

      expect(updateScheduleInterval).not.toHaveBeenCalled();
      expect(result instanceof Response ? result.status : 200).toBe(400);
      expect(jsonResult.error).toContain("Must be a positive whole number");
    });

    it("should accept valid intervals", async () => {
      (updateScheduleInterval as ReturnType<typeof vi.fn>).mockResolvedValue(
        undefined,
      );

      const formData = createFormData({
        _action: "update_schedule_intervals",
        scheduleIntervals: "4\n6\n8",
      });

      const result = await handleGeneralSettingsAction(
        TEST_USER_ID,
        "update_schedule_intervals",
        formData,
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

      expect(updateScheduleInterval).toHaveBeenCalledWith(TEST_USER_ID, [
        "4",
        "6",
        "8",
      ]);
      expect(jsonResult).toEqual({ success: true });
    });

    it("should filter out empty lines", async () => {
      (updateScheduleInterval as ReturnType<typeof vi.fn>).mockResolvedValue(
        undefined,
      );

      const formData = createFormData({
        _action: "update_schedule_intervals",
        scheduleIntervals: "4\n\n6\n  \n",
      });

      const result = await handleGeneralSettingsAction(
        TEST_USER_ID,
        "update_schedule_intervals",
        formData,
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

      expect(updateScheduleInterval).toHaveBeenCalledWith(TEST_USER_ID, [
        "4",
        "6",
      ]);
      expect(jsonResult).toEqual({ success: true });
    });

    it("should handle single interval", async () => {
      (updateScheduleInterval as ReturnType<typeof vi.fn>).mockResolvedValue(
        undefined,
      );

      const formData = createFormData({
        _action: "update_schedule_intervals",
        scheduleIntervals: "4",
      });

      const result = await handleGeneralSettingsAction(
        TEST_USER_ID,
        "update_schedule_intervals",
        formData,
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

      expect(updateScheduleInterval).toHaveBeenCalledWith(TEST_USER_ID, ["4"]);
      expect(jsonResult).toEqual({ success: true });
    });
  });

  describe("Invalid actions", () => {
    it("should return null for unknown action", async () => {
      const formData = createFormData({
        _action: "unknown_action",
      });

      const result = await handleGeneralSettingsAction(
        TEST_USER_ID,
        "unknown_action",
        formData,
      );

      expect(result).toBeNull();
    });
  });
});
