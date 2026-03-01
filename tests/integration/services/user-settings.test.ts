/**
 * Integration tests for user settings
 * Tests app/features/user/services/user-settings.server.ts
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock Prisma
vi.mock("~/lib/prisma.server", () => ({
  prisma: {
    user: {
      update: vi.fn(),
      findUnique: vi.fn(),
    },
    subscription: {
      findUnique: vi.fn(),
    },
  },
}));

import { TEST_USER_ID } from "../../utils/test-helpers";

import {
  updateUserTimezone,
  getUserTimezone,
  updateUserRelays,
  getUserRelays,
  updateGiveawayBlacklist,
  getGiveawayBlacklist,
  updateScheduleInterval,
  getScheduleInterval,
  updateUserUploadProvider,
  updateUserUploadProviderSettings,
  getUserUploadProvider,
  getResolvedUploadProviderSettings,
  resolveUploadProviderWithTierDefaults,
  getUserEnableMirrorBlossom,
  updateUserEnableMirrorBlossom,
  getUserMirrorUploadUrls,
  updateUserMirrorUploadUrls,
  updateUserMutedList,
  getUserMutedList,
  updateUserFilterMuted,
  getUserFilterMuted,
  updateUserHidePostsFromLowTrustUsers,
  getUserHidePostsFromLowTrustUsers,
} from "~/features/user/services/user-settings.server";
import { prisma } from "~/lib/prisma.server";

describe("User Settings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Timezone", () => {
    it("should update user timezone", async () => {
      const mockUser = { id: TEST_USER_ID, timezone: "America/New_York" };
      (prisma.user.update as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockUser
      );

      const result = await updateUserTimezone(TEST_USER_ID, "America/New_York");

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: TEST_USER_ID },
        data: { timezone: "America/New_York" },
      });
      expect(result).toEqual(mockUser);
    });

    it("should get user timezone", async () => {
      (prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        timezone: "America/New_York",
      });

      const result = await getUserTimezone(TEST_USER_ID);

      expect(result).toBe("America/New_York");
    });

    it("should return null if timezone not set", async () => {
      (prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        timezone: null,
      });

      const result = await getUserTimezone(TEST_USER_ID);

      expect(result).toBeNull();
    });
  });

  describe("Relays", () => {
    it("should update user relays", async () => {
      const mockUser = { id: TEST_USER_ID, userRelays: ["wss://relay1.com"] };
      (prisma.user.update as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockUser
      );

      const result = await updateUserRelays(TEST_USER_ID, ["wss://relay1.com"]);

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: TEST_USER_ID },
        data: { userRelays: ["wss://relay1.com"] },
      });
      expect(result).toEqual(mockUser);
    });

    it("should get user relays without subscription", async () => {
      (prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        userRelays: ["wss://relay1.com"],
      });
      (
        prisma.subscription.findUnique as ReturnType<typeof vi.fn>
      ).mockResolvedValue(null);

      const result = await getUserRelays(TEST_USER_ID);

      expect(result).toEqual(["wss://relay1.com"]);
    });

    it("should not inject managed relays into persisted user relays", async () => {
      (prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        userRelays: ["wss://relay1.com"],
      });
      // Even if a subscription exists, managed relays are resolved elsewhere.
      (
        prisma.subscription.findUnique as ReturnType<typeof vi.fn>
      ).mockResolvedValue({
        status: "ACTIVE",
        Plan: { name: "Premium", enableRelayBlast: true },
      });

      const result = await getUserRelays(TEST_USER_ID);

      expect(result).toEqual(["wss://relay1.com"]);
    });
  });

  describe("Giveaway Blacklist", () => {
    it("should update giveaway blacklist", async () => {
      const mockUser = {
        id: TEST_USER_ID,
        giveawayBlackListed: ["npub1", "npub2"],
      };
      (prisma.user.update as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockUser
      );

      const result = await updateGiveawayBlacklist(TEST_USER_ID, [
        "npub1",
        "npub2",
      ]);

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: TEST_USER_ID },
        data: { giveawayBlackListed: ["npub1", "npub2"] },
      });
      expect(result).toEqual(mockUser);
    });

    it("should get giveaway blacklist", async () => {
      (prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        giveawayBlackListed: ["npub1", "npub2"],
      });

      const result = await getGiveawayBlacklist(TEST_USER_ID);

      expect(result).toEqual(["npub1", "npub2"]);
    });

    it("should return empty array if blacklist not set", async () => {
      (prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        giveawayBlacklist: null,
      });

      const result = await getGiveawayBlacklist(TEST_USER_ID);

      expect(result).toEqual([]);
    });
  });

  describe("Schedule Interval", () => {
    it("should update schedule interval", async () => {
      const mockUser = { id: TEST_USER_ID, scheduleInterval: ["4", "6", "8"] };
      (prisma.user.update as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockUser
      );

      const result = await updateScheduleInterval(TEST_USER_ID, [
        "4",
        "6",
        "8",
      ]);

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: TEST_USER_ID },
        data: { scheduleInterval: ["4", "6", "8"] },
      });
      expect(result).toEqual(mockUser);
    });

    it("should get schedule interval", async () => {
      (prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        scheduleInterval: ["4", "6", "8"],
      });

      const result = await getScheduleInterval(TEST_USER_ID);

      expect(result).toEqual(["4", "6", "8"]);
    });

    it("should return empty array if schedule interval not set", async () => {
      (prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        scheduleInterval: null,
      });

      const result = await getScheduleInterval(TEST_USER_ID);

      expect(result).toEqual([]);
    });
  });

  describe("Upload Provider", () => {
    it("should update upload provider", async () => {
      const mockUser = { id: TEST_USER_ID, uploadProvider: "BLOSSOM_PRIMAL" };
      (prisma.user.update as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockUser
      );

      const result = await updateUserUploadProvider(
        TEST_USER_ID,
        "BLOSSOM_PRIMAL"
      );

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: TEST_USER_ID },
        data: { uploadProvider: "BLOSSOM_PRIMAL" },
      });
      expect(result).toEqual(mockUser);
    });

    it("should resolve S3 to Primal for free users", async () => {
      (prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        uploadProvider: "S3",
        customBlossomUrl: null,
      });
      (
        prisma.subscription.findUnique as ReturnType<typeof vi.fn>
      ).mockResolvedValue(null);

      const result = await getUserUploadProvider(TEST_USER_ID);

      expect(result).toBe("BLOSSOM_PRIMAL");
    });

    it("should resolve S3 to SFS for active paid users", async () => {
      (prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        uploadProvider: "S3",
        customBlossomUrl: null,
      });
      (
        prisma.subscription.findUnique as ReturnType<typeof vi.fn>
      ).mockResolvedValue({
        planId: "premium",
        status: "ACTIVE",
        currentPeriodEnd: new Date(Date.now() + 60_000),
        Plan: { enableLifetimeAccess: false },
      });

      const result = await getUserUploadProvider(TEST_USER_ID);

      expect(result).toBe("BLOSSOM_SFS");
    });

    it("should preserve explicit custom provider when custom URL exists", async () => {
      (prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        uploadProvider: "BLOSSOM_CUSTOM",
        customBlossomUrl: "https://custom-blossom.example.com",
      });
      (
        prisma.subscription.findUnique as ReturnType<typeof vi.fn>
      ).mockResolvedValue(null);

      const result = await getResolvedUploadProviderSettings(TEST_USER_ID);

      expect(result).toEqual({
        provider: "BLOSSOM_CUSTOM",
        customBlossomUrl: "https://custom-blossom.example.com",
      });
    });

    it("should fallback when custom provider has missing URL", async () => {
      (prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        uploadProvider: "BLOSSOM_CUSTOM",
        customBlossomUrl: null,
      });
      (
        prisma.subscription.findUnique as ReturnType<typeof vi.fn>
      ).mockResolvedValue(null);

      const result = await getResolvedUploadProviderSettings(TEST_USER_ID);

      expect(result).toEqual({
        provider: "BLOSSOM_PRIMAL",
        customBlossomUrl: null,
      });
    });

    it("should persist provider + custom URL atomically", async () => {
      const mockUser = {
        id: TEST_USER_ID,
        uploadProvider: "BLOSSOM_CUSTOM",
        customBlossomUrl: "https://custom-blossom.example.com",
      };
      (prisma.user.update as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockUser
      );

      const result = await updateUserUploadProviderSettings(
        TEST_USER_ID,
        "BLOSSOM_CUSTOM",
        "https://custom-blossom.example.com"
      );

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: TEST_USER_ID },
        data: {
          uploadProvider: "BLOSSOM_CUSTOM",
          customBlossomUrl: "https://custom-blossom.example.com",
        },
      });
      expect(result).toEqual(mockUser);
    });

    it("should clear custom URL when provider is not custom", async () => {
      const mockUser = {
        id: TEST_USER_ID,
        uploadProvider: "BLOSSOM_PRIMAL",
        customBlossomUrl: null,
      };
      (prisma.user.update as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockUser
      );

      await updateUserUploadProviderSettings(
        TEST_USER_ID,
        "BLOSSOM_PRIMAL",
        "https://custom-blossom.example.com"
      );

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: TEST_USER_ID },
        data: {
          uploadProvider: "BLOSSOM_PRIMAL",
          customBlossomUrl: null,
        },
      });
    });

    it("should resolve provider by tier defaults helper", () => {
      expect(
        resolveUploadProviderWithTierDefaults({
          persistedProvider: "S3",
          isPaidActive: false,
        })
      ).toBe("BLOSSOM_PRIMAL");
      expect(
        resolveUploadProviderWithTierDefaults({
          persistedProvider: "S3",
          isPaidActive: true,
        })
      ).toBe("BLOSSOM_SFS");
    });
  });

  describe("Mirror Blossom", () => {
    it("should get mirror blossom enabled status", async () => {
      (prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        enableMirrorBlossom: true,
      });

      const result = await getUserEnableMirrorBlossom(TEST_USER_ID);

      expect(result).toBe(true);
    });

    it("should update mirror blossom enabled status", async () => {
      const mockUser = { id: TEST_USER_ID, enableMirrorBlossom: true };
      (prisma.user.update as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockUser
      );

      const result = await updateUserEnableMirrorBlossom(TEST_USER_ID, true);

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: TEST_USER_ID },
        data: { enableMirrorBlossom: true },
      });
      expect(result).toEqual(mockUser);
    });
  });

  describe("Mirror Upload URLs", () => {
    it("should get mirror upload URLs", async () => {
      (prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        mirrorUploadUrls: ["https://mirror1.com", "https://mirror2.com"],
      });

      const result = await getUserMirrorUploadUrls(TEST_USER_ID);

      expect(result).toEqual(["https://mirror1.com", "https://mirror2.com"]);
    });

    it("should update mirror upload URLs", async () => {
      const mockUser = {
        id: TEST_USER_ID,
        mirrorUploadUrls: ["https://mirror1.com"],
      };
      (prisma.user.update as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockUser
      );

      const result = await updateUserMirrorUploadUrls(TEST_USER_ID, [
        "https://mirror1.com",
      ]);

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: TEST_USER_ID },
        data: { mirrorUploadUrls: ["https://mirror1.com"] },
      });
      expect(result).toEqual(mockUser);
    });
  });

  describe("Muted List", () => {
    it("should get muted list", async () => {
      const mockMutedList = {
        npubs: ["npub1", "npub2"],
        lastSynced: "2024-01-01T00:00:00Z",
      };
      (prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        mutedList: mockMutedList,
      });

      const result = await getUserMutedList(TEST_USER_ID);

      expect(result?.npubs).toEqual(["npub1", "npub2"]);
      expect(result?.lastSynced).toBe("2024-01-01T00:00:00Z");
    });

    it("should update muted list", async () => {
      const mockMutedList = {
        npubs: ["npub1"],
        lastSynced: "2024-01-01T00:00:00Z",
      };
      const mockUser = { id: TEST_USER_ID, mutedList: mockMutedList };
      (prisma.user.update as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockUser
      );

      const result = await updateUserMutedList(TEST_USER_ID, mockMutedList);

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: TEST_USER_ID },
        data: { mutedList: mockMutedList },
      });
      expect(result).toEqual(mockUser);
    });
  });

  describe("Filter Muted", () => {
    it("should get filter muted setting", async () => {
      (prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        filterMuted: true,
      });

      const result = await getUserFilterMuted(TEST_USER_ID);

      expect(result).toBe(true);
    });

    it("should update filter muted setting", async () => {
      const mockUser = { id: TEST_USER_ID, filterMuted: true };
      (prisma.user.update as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockUser
      );

      const result = await updateUserFilterMuted(TEST_USER_ID, true);

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: TEST_USER_ID },
        data: { filterMuted: true },
      });
      expect(result).toEqual(mockUser);
    });
  });

  describe("Hide Posts From Low Trust Users", () => {
    it("should get hide posts from low trust users setting", async () => {
      (prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        hidePostsFromLowTrustUsers: true,
      });

      const result = await getUserHidePostsFromLowTrustUsers(TEST_USER_ID);

      expect(result).toBe(true);
    });

    it("should update hide posts from low trust users setting", async () => {
      const mockUser = { id: TEST_USER_ID, hidePostsFromLowTrustUsers: true };
      (prisma.user.update as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockUser
      );

      const result = await updateUserHidePostsFromLowTrustUsers(
        TEST_USER_ID,
        true
      );

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: TEST_USER_ID },
        data: { hidePostsFromLowTrustUsers: true },
      });
      expect(result).toEqual(mockUser);
    });
  });
});
