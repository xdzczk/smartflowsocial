/**
 * Integration tests for user queries
 * Tests app/features/user/queries/user-queries.server.ts
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock Prisma
vi.mock("~/lib/prisma.server", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      update: vi.fn(),
    },
  },
}));

import {
  getUserBasicInfo,
  getUsersByNpubs,
  getUserByNpubWithProfile,
  getUserIdByNpub,
  countUsers,
  getEnabledUsersWithSubscriptions,
  disableUserAccount,
} from "~/features/user/queries/user-queries.server";
import { prisma } from "~/lib/prisma.server";

import { TEST_USER_ID } from "../../utils/test-helpers";

describe("User Queries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getUserBasicInfo", () => {
    it("should get user basic info", async () => {
      const mockUser = {
        npub: "npub123",
        isChild: false,
        parentNpub: null,
      };
      (prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockUser,
      );

      const result = await getUserBasicInfo(TEST_USER_ID);

      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: TEST_USER_ID },
        select: { npub: true, isChild: true, parentNpub: true },
      });
      expect(result).toEqual(mockUser);
    });

    it("should return null if user not found", async () => {
      (prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(
        null,
      );

      const result = await getUserBasicInfo("nonexistent");

      expect(result).toBeNull();
    });

    it("should handle child accounts", async () => {
      const mockUser = {
        npub: "npub123",
        isChild: true,
        parentNpub: "parent-npub",
      };
      (prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockUser,
      );

      const result = await getUserBasicInfo(TEST_USER_ID);

      expect(result?.isChild).toBe(true);
      expect(result?.parentNpub).toBe("parent-npub");
    });
  });

  describe("getUsersByNpubs", () => {
    it("should get users by npubs", async () => {
      const mockUsers = [
        { npub: "npub1", nostrProfile: { name: "User 1" } },
        { npub: "npub2", nostrProfile: { name: "User 2" } },
      ];
      (prisma.user.findMany as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockUsers,
      );

      const result = await getUsersByNpubs(["npub1", "npub2"]);

      expect(prisma.user.findMany).toHaveBeenCalledWith({
        where: { npub: { in: ["npub1", "npub2"] } },
        select: { npub: true, nostrProfile: true },
      });
      expect(result).toHaveLength(2);
      expect(result[0].npub).toBe("npub1");
    });

    it("should return empty array for empty input", async () => {
      const result = await getUsersByNpubs([]);

      expect(result).toEqual([]);
      expect(prisma.user.findMany).not.toHaveBeenCalled();
    });

    it("should handle null nostrProfile", async () => {
      const mockUsers = [{ npub: "npub1", nostrProfile: null }];
      (prisma.user.findMany as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockUsers,
      );

      const result = await getUsersByNpubs(["npub1"]);

      expect(result[0].nostrProfile).toBeNull();
    });
  });

  describe("getUserByNpubWithProfile", () => {
    it("should get user by npub with profile", async () => {
      const mockUser = {
        npub: "npub123",
        nostrProfile: {
          name: "Test User",
          picture: "https://example.com/pic.jpg",
        },
      };
      (prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockUser,
      );

      const result = await getUserByNpubWithProfile("npub123");

      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { npub: "npub123" },
        select: { npub: true, nostrProfile: true },
      });
      expect(result).toEqual(mockUser);
    });

    it("should return null if user not found", async () => {
      (prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(
        null,
      );

      const result = await getUserByNpubWithProfile("nonexistent");

      expect(result).toBeNull();
    });

    it("should handle invalid nostrProfile format", async () => {
      const mockUser = {
        npub: "npub123",
        nostrProfile: "invalid-format",
      };
      (prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockUser,
      );

      const result = await getUserByNpubWithProfile("npub123");

      expect(result?.nostrProfile).toBeNull();
    });
  });

  describe("getUserIdByNpub", () => {
    it("should get user ID by npub", async () => {
      const mockUser = { id: TEST_USER_ID };
      (prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockUser,
      );

      const result = await getUserIdByNpub("npub123");

      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { npub: "npub123" },
        select: { id: true },
      });
      expect(result).toBe(TEST_USER_ID);
    });

    it("should return null if user not found", async () => {
      (prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(
        null,
      );

      const result = await getUserIdByNpub("nonexistent");

      expect(result).toBeNull();
    });
  });

  describe("countUsers", () => {
    it("should count all users", async () => {
      (prisma.user.count as ReturnType<typeof vi.fn>).mockResolvedValue(100);

      const result = await countUsers();

      expect(prisma.user.count).toHaveBeenCalledWith();
      expect(result).toBe(100);
    });
  });

  describe("getEnabledUsersWithSubscriptions", () => {
    it("should get enabled users with subscriptions", async () => {
      const mockUsers = [
        {
          id: TEST_USER_ID,
          isEnabled: true,
          Subscription: {
            Plan: { id: "plan-1", name: "Pro" },
          },
        },
      ];
      (prisma.user.findMany as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockUsers,
      );

      const result = await getEnabledUsersWithSubscriptions();

      expect(prisma.user.findMany).toHaveBeenCalledWith({
        where: { isEnabled: true },
        include: {
          Subscription: {
            include: {
              Plan: true,
            },
          },
        },
      });
      expect(result).toEqual(mockUsers);
    });
  });

  describe("disableUserAccount", () => {
    it("should disable user account", async () => {
      const mockUser = { id: TEST_USER_ID, isEnabled: false };
      (prisma.user.update as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockUser,
      );

      const result = await disableUserAccount(TEST_USER_ID);

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: TEST_USER_ID },
        data: { isEnabled: false },
      });
      expect(result).toEqual(mockUser);
    });
  });
});
