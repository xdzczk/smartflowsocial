/**
 * Unit tests for giveaway preset CRUD.
 * Tests app/features/giveaway/giveaway-presets.server.ts
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const mockCreatePresetRow = vi.fn();
const mockUpdatePresetRow = vi.fn();
const mockDeletePresetRow = vi.fn();
const mockGetPresetByIdRow = vi.fn();
const mockGetPresetsByUserRow = vi.fn();
const mockFindQueueTypeByIdAndUser = vi.fn();
const mockGetUserSubscription = vi.fn();
const mockGetGiveawayPlanLimits = vi.fn();
const mockGetUserPlanType = vi.fn();

vi.mock("~/models/payment.server", () => ({
  getUserSubscription: (...args: unknown[]) => mockGetUserSubscription(...args),
}));

vi.mock("~/features/payments/types", () => ({
  getUserPlanType: (...args: unknown[]) => mockGetUserPlanType(...args),
  getGiveawayPlanLimits: (...args: unknown[]) =>
    mockGetGiveawayPlanLimits(...args),
}));

vi.mock(
  "~/features/giveaway/repositories/giveaway-presets-data.server",
  () => ({
    createGiveawayPreset: (...args: unknown[]) => mockCreatePresetRow(...args),
    updateGiveawayPreset: (...args: unknown[]) => mockUpdatePresetRow(...args),
    deleteGiveawayPreset: (...args: unknown[]) => mockDeletePresetRow(...args),
    getGiveawayPresetById: (...args: unknown[]) =>
      mockGetPresetByIdRow(...args),
    getGiveawayPresetsByUser: (...args: unknown[]) =>
      mockGetPresetsByUserRow(...args),
    findQueueTypeByIdAndUser: (...args: unknown[]) =>
      mockFindQueueTypeByIdAndUser(...args),
  })
);

import {
  createGiveawayPreset,
  updateGiveawayPreset,
  deleteGiveawayPreset,
  getGiveawayPresetsByUser,
  getGiveawayPresetById,
  resolvePresetQueue,
} from "~/features/giveaway/giveaway-presets.server";

describe("giveaway-presets", () => {
  const userId = "user-1";

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetGiveawayPlanLimits.mockReturnValue({
      canUsePresets: true,
      canUseQueueScope: true,
      maxWinnerCount: 10,
    });
    mockGetUserPlanType.mockReturnValue("PAID");
    mockGetUserSubscription.mockResolvedValue({});
  });

  describe("createGiveawayPreset", () => {
    it("throws when plan cannot use presets", async () => {
      mockGetGiveawayPlanLimits.mockReturnValue({
        canUsePresets: false,
        canUseQueueScope: true,
        maxWinnerCount: 10,
      });
      mockGetUserPlanType.mockReturnValue("FREE");

      await expect(
        createGiveawayPreset(userId, {
          name: "Preset",
          scopeType: "PERIOD",
          scopeReference: {},
          engagementTypes: ["REACTION"],
          winnerCount: 1,
        })
      ).rejects.toThrow("Presets are available on paid plans");
    });

    it("calls repo create with trimmed name and input", async () => {
      mockGetUserSubscription.mockResolvedValue({});
      const preset = {
        id: "preset-1",
        name: "My Preset",
        scopeType: "PERIOD",
        scopeReference: {},
        engagementTypes: ["REACTION"],
        winnerCount: 2,
        selectionMode: "UNIQUE_USER",
      };
      mockCreatePresetRow.mockResolvedValue(preset);

      const result = await createGiveawayPreset(userId, {
        name: "  My Preset  ",
        scopeType: "PERIOD",
        scopeReference: { days: 7 },
        engagementTypes: ["REACTION", "ZAP"],
        winnerCount: 2,
      });

      expect(result).toEqual(preset);
      expect(mockCreatePresetRow).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "My Preset",
          scopeType: "PERIOD",
          scopeReference: { days: 7 },
          winnerCount: 2,
        })
      );
    });
  });

  describe("getGiveawayPresetsByUser", () => {
    it("returns list from repo", async () => {
      const list = [{ id: "p1", name: "Preset 1" }];
      mockGetPresetsByUserRow.mockResolvedValue(list);
      const result = await getGiveawayPresetsByUser(userId);
      expect(result).toEqual(list);
      expect(mockGetPresetsByUserRow).toHaveBeenCalledWith(userId);
    });
  });

  describe("getGiveawayPresetById", () => {
    it("returns preset when found", async () => {
      const preset = { id: "p1", name: "Preset", userId };
      mockGetPresetByIdRow.mockResolvedValue(preset);
      const result = await getGiveawayPresetById(userId, "p1");
      expect(result).toEqual(preset);
    });

    it("returns null when not found", async () => {
      mockGetPresetByIdRow.mockResolvedValue(null);
      const result = await getGiveawayPresetById(userId, "missing");
      expect(result).toBeNull();
    });
  });

  describe("resolvePresetQueue", () => {
    it("returns null when scopeReference has no queueId", async () => {
      const result = await resolvePresetQueue(userId, {});
      expect(result).toBeNull();
      expect(mockFindQueueTypeByIdAndUser).not.toHaveBeenCalled();
    });

    it("returns queue id and name when queue found", async () => {
      mockFindQueueTypeByIdAndUser.mockResolvedValue({
        id: "queue-1",
        name: "Feed",
      });
      const result = await resolvePresetQueue(userId, {
        queueId: "queue-1",
      });
      expect(result).toEqual({ id: "queue-1", name: "Feed" });
    });
  });

  describe("updateGiveawayPreset", () => {
    it("calls repo update with partial data", async () => {
      const updated = {
        id: "p1",
        name: "Updated",
        scopeType: "PERIOD",
        scopeReference: {},
        engagementTypes: ["REACTION"],
        winnerCount: 3,
      };
      mockUpdatePresetRow.mockResolvedValue(updated);
      const result = await updateGiveawayPreset(userId, "p1", {
        name: "Updated",
        winnerCount: 3,
      });
      expect(result).toEqual(updated);
      expect(mockUpdatePresetRow).toHaveBeenCalledWith(
        "p1",
        userId,
        expect.objectContaining({ name: "Updated", winnerCount: 3 })
      );
    });
  });

  describe("deleteGiveawayPreset", () => {
    it("calls repo delete", async () => {
      mockDeletePresetRow.mockResolvedValue(undefined);
      await deleteGiveawayPreset(userId, "p1");
      expect(mockDeletePresetRow).toHaveBeenCalledWith("p1", userId);
    });
  });
});
