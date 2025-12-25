/**
 * Integration tests for User model functions
 * 
 * Tests the database operations in app/features/user
 * Uses mocked Prisma to test business logic without requiring a real database.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  getUserById,
  getQueueTypes,
  getUserHashTagPresets,
  getScheduleInterval,
  updateUserTimezone,
} from "~/features/user";

// Mock Prisma
const mockPrisma = {
  user: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  queueType: {
    findMany: vi.fn(),
  },
  hashTagPreset: {
    findMany: vi.fn(),
  },
};

vi.mock("~/lib/prisma.server", () => ({
  prisma: mockPrisma,
}));

describe("User Model Functions", () => {
  const TEST_USER_ID = "user-123";
  const TEST_NPUB = "npub123";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getUserById", () => {
    it("should get user by id with all fields", async () => {
      const mockUser = {
        id: TEST_USER_ID,
        npub: TEST_NPUB,
        timezone: "America/New_York",
        userRelays: ["wss://relay1.com"],
        scheduleInterval: ["09:00", "12:00"],
        showHashTagsinPosts: true,
        hashTagPresets: [],
      };

      mockPrisma.user.findUnique.mockResolvedValue(mockUser);

      const result = await getUserById(TEST_USER_ID);

      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: TEST_USER_ID },
        include: {
          hashTagPresets: true,
        },
      });
      expect(result).toEqual(mockUser);
    });

    it("should return null for non-existent user", async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      const result = await getUserById("invalid-user");

      expect(result).toBeNull();
    });
  });

  describe("getQueueTypes", () => {
    it("should get all queue types for a user", async () => {
      const mockQueueTypes = [
        {
          id: "queue-1",
          name: "posts",
          userId: TEST_USER_ID,
          isEnabled: true,
          scheduleType: "INTERVAL",
          scheduleConfig: { intervalHours: 4 },
        },
        {
          id: "queue-2",
          name: "marketing",
          userId: TEST_USER_ID,
          isEnabled: true,
          scheduleType: "FIXED_SLOTS",
          scheduleConfig: { slots: ["09:00", "12:00"] },
        },
      ];

      mockPrisma.queueType.findMany.mockResolvedValue(mockQueueTypes);

      const result = await getQueueTypes(TEST_USER_ID);

      expect(mockPrisma.queueType.findMany).toHaveBeenCalledWith({
        where: { userId: TEST_USER_ID },
        orderBy: { createdAt: "asc" },
      });
      expect(result).toEqual(mockQueueTypes);
    });

    it("should return empty array when user has no queue types", async () => {
      mockPrisma.queueType.findMany.mockResolvedValue([]);

      const result = await getQueueTypes(TEST_USER_ID);

      expect(result).toEqual([]);
    });
  });

  describe("getUserHashTagPresets", () => {
    it("should get all hashtag presets for a user", async () => {
      const mockPresets = [
        {
          id: "preset-1",
          userId: TEST_USER_ID,
          name: "Marketing Tags",
          tags: "#marketing #social",
        },
        {
          id: "preset-2",
          userId: TEST_USER_ID,
          name: "Tech Tags",
          tags: "#tech #coding",
        },
      ];

      mockPrisma.hashTagPreset.findMany.mockResolvedValue(mockPresets);

      const result = await getUserHashTagPresets(TEST_USER_ID);

      expect(mockPrisma.hashTagPreset.findMany).toHaveBeenCalledWith({
        where: { userId: TEST_USER_ID },
        orderBy: { createdAt: "desc" },
      });
      expect(result).toEqual(mockPresets);
    });
  });

  describe("getScheduleInterval", () => {
    it("should get schedule intervals for a user", async () => {
      const mockUser = {
        id: TEST_USER_ID,
        scheduleInterval: ["09:00", "12:00", "15:00"],
      };

      mockPrisma.user.findUnique.mockResolvedValue(mockUser);

      const result = await getScheduleInterval(TEST_USER_ID);

      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: TEST_USER_ID },
        select: {
          scheduleInterval: true,
        },
      });
      expect(result).toEqual(["09:00", "12:00", "15:00"]);
    });

    it("should return empty array when user has no schedule intervals", async () => {
      const mockUser = {
        id: TEST_USER_ID,
        scheduleInterval: null,
      };

      mockPrisma.user.findUnique.mockResolvedValue(mockUser);

      const result = await getScheduleInterval(TEST_USER_ID);

      expect(result).toEqual([]);
    });
  });

  describe("updateUserTimezone", () => {
    it("should update user timezone", async () => {
      const mockUpdatedUser = {
        id: TEST_USER_ID,
        timezone: "America/Los_Angeles",
      };

      mockPrisma.user.update.mockResolvedValue(mockUpdatedUser);

      const result = await updateUserTimezone(
        TEST_USER_ID,
        "America/Los_Angeles",
      );

      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: TEST_USER_ID },
        data: { timezone: "America/Los_Angeles" },
      });
      expect(result).toEqual(mockUpdatedUser);
    });
  });
});

