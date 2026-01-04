/**
 * Integration tests for queue types service
 * Tests app/features/user/services/queue-types.server.ts
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock Prisma
vi.mock("~/lib/prisma.server", () => ({
  prisma: {
    queueType: {
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      count: vi.fn(),
      createMany: vi.fn(),
    },
  },
}));

import {
  createDefaultQueueTypes,
  updateQueueType,
  deleteQueueType,
  getQueueTypes,
  getQueueTypeByIdForUser,
  getQueueTypeByNameForUser,
} from "~/features/user/services/queue-types.server";
import { prisma } from "~/lib/prisma.server";

import { TEST_USER_ID } from "../../utils/test-helpers";

describe("Queue Types Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("createDefaultQueueTypes", () => {
    it("should create default queue types for new user", async () => {
      (prisma.queueType.count as ReturnType<typeof vi.fn>).mockResolvedValue(0);
      (
        prisma.queueType.createMany as ReturnType<typeof vi.fn>
      ).mockResolvedValue({ count: 1 });

      await createDefaultQueueTypes(TEST_USER_ID);

      expect(prisma.queueType.count).toHaveBeenCalledWith({
        where: { userId: TEST_USER_ID },
      });
      expect(prisma.queueType.createMany).toHaveBeenCalledWith({
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        data: expect.arrayContaining([
          expect.objectContaining({
            userId: TEST_USER_ID,
            name: "Unassigned",
            scheduleType: "INTERVAL",
            isDefault: true,
          }),
        ]),
      });
    });

    it("should not create defaults if user already has queue types", async () => {
      (prisma.queueType.count as ReturnType<typeof vi.fn>).mockResolvedValue(1);

      await createDefaultQueueTypes(TEST_USER_ID);

      expect(prisma.queueType.createMany).not.toHaveBeenCalled();
    });
  });

  describe("updateQueueType", () => {
    it("should update existing queue type", async () => {
      const mockQueueType = {
        id: "queue-1",
        name: "Updated Queue",
        scheduleType: "INTERVAL",
      };
      (prisma.queueType.update as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockQueueType,
      );

      const result = await updateQueueType(TEST_USER_ID, {
        id: "queue-1",
        name: "Updated Queue",
        scheduleType: "INTERVAL",
        scheduleConfig: { useGlobalInterval: true },
      });

      expect(prisma.queueType.update).toHaveBeenCalledWith({
        where: { id: "queue-1", userId: TEST_USER_ID },
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        data: expect.objectContaining({
          name: "Updated Queue",
          scheduleType: "INTERVAL",
        }),
      });
      expect(result).toEqual(mockQueueType);
    });

    it("should create new queue type", async () => {
      const mockQueueType = {
        id: "queue-2",
        name: "New Queue",
        scheduleType: "FIXED_SLOTS",
      };
      (prisma.queueType.create as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockQueueType,
      );

      const result = await updateQueueType(TEST_USER_ID, {
        name: "New Queue",
        scheduleType: "FIXED_SLOTS",
        scheduleConfig: { slots: ["09:00", "12:00"] },
      });

      expect(prisma.queueType.create).toHaveBeenCalledWith({
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        data: expect.objectContaining({
          name: "New Queue",
          scheduleType: "FIXED_SLOTS",
        }),
      });
      expect(result).toEqual(mockQueueType);
    });

    it("should connect hashtag preset when provided", async () => {
      const mockQueueType = { id: "queue-1" };
      (prisma.queueType.update as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockQueueType,
      );

      await updateQueueType(TEST_USER_ID, {
        id: "queue-1",
        name: "Queue 1",
        scheduleType: "INTERVAL",
        scheduleConfig: {},
        hashTagPresetId: "preset-1",
      });

      const updateCall = (prisma.queueType.update as ReturnType<typeof vi.fn>)
        .mock.calls[0]?.[0] as
        | { data?: { hashTagPreset?: { connect?: { id?: string } } } }
        | undefined;
      expect(updateCall?.data?.hashTagPreset).toEqual({
        connect: { id: "preset-1" },
      });
    });

    it("should disconnect hashtag preset when null", async () => {
      const mockQueueType = { id: "queue-1" };
      (prisma.queueType.update as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockQueueType,
      );

      await updateQueueType(TEST_USER_ID, {
        id: "queue-1",
        name: "Queue 1",
        scheduleType: "INTERVAL",
        scheduleConfig: {},
        hashTagPresetId: null,
      });

      const updateCall = (prisma.queueType.update as ReturnType<typeof vi.fn>)
        .mock.calls[0]?.[0] as
        | { data?: { hashTagPreset?: { disconnect?: boolean } } }
        | undefined;
      expect(updateCall?.data?.hashTagPreset).toEqual({ disconnect: true });
    });

    it("should trim queue type name", async () => {
      (prisma.queueType.update as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: "queue-1",
      });

      await updateQueueType(TEST_USER_ID, {
        id: "queue-1",
        name: "  Queue 1  ",
        scheduleType: "INTERVAL",
        scheduleConfig: {},
      });

      const updateCall = (prisma.queueType.update as ReturnType<typeof vi.fn>)
        .mock.calls[0]?.[0] as { data?: { name?: string } } | undefined;
      expect(updateCall?.data?.name).toBe("Queue 1");
    });
  });

  describe("deleteQueueType", () => {
    it("should delete queue type", async () => {
      (prisma.queueType.delete as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: "queue-1",
      });

      await deleteQueueType(TEST_USER_ID, "queue-1");

      expect(prisma.queueType.delete).toHaveBeenCalledWith({
        where: { id: "queue-1", userId: TEST_USER_ID },
      });
    });
  });

  describe("getQueueTypes", () => {
    it("should get queue types and create defaults if needed", async () => {
      const mockQueueTypes = [
        { id: "queue-1", name: "Queue 1", isDefault: true },
      ];
      (prisma.queueType.count as ReturnType<typeof vi.fn>).mockResolvedValue(0);
      (
        prisma.queueType.createMany as ReturnType<typeof vi.fn>
      ).mockResolvedValue({ count: 1 });
      (prisma.queueType.findMany as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockQueueTypes,
      );

      const result = await getQueueTypes(TEST_USER_ID);

      expect(prisma.queueType.findMany).toHaveBeenCalledWith({
        where: { userId: TEST_USER_ID },
        include: { hashTagPreset: true },
        orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
      });
      expect(result).toEqual(mockQueueTypes);
    });
  });

  describe("getQueueType", () => {
    it("should get queue type names (deprecated)", async () => {
      const mockQueueTypes = [
        { id: "queue-1", name: "Queue 1" },
        { id: "queue-2", name: "Queue 2" },
      ];
      (prisma.queueType.count as ReturnType<typeof vi.fn>).mockResolvedValue(1);
      (prisma.queueType.findMany as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockQueueTypes,
      );

      const queueTypes = await getQueueTypes(TEST_USER_ID);
      const result = queueTypes.map((qt) => qt.name);

      expect(result).toEqual(["Queue 1", "Queue 2"]);
    });
  });

  describe("getQueueTypeByIdForUser", () => {
    it("should get queue type by ID", async () => {
      const mockQueueType = { id: "queue-1", name: "Queue 1" };
      (
        prisma.queueType.findFirst as ReturnType<typeof vi.fn>
      ).mockResolvedValue(mockQueueType);

      const result = await getQueueTypeByIdForUser(TEST_USER_ID, "queue-1");

      expect(prisma.queueType.findFirst).toHaveBeenCalledWith({
        where: { id: "queue-1", userId: TEST_USER_ID },
      });
      expect(result).toEqual(mockQueueType);
    });

    it("should return null if queue type not found", async () => {
      (
        prisma.queueType.findFirst as ReturnType<typeof vi.fn>
      ).mockResolvedValue(null);

      const result = await getQueueTypeByIdForUser(TEST_USER_ID, "nonexistent");

      expect(result).toBeNull();
    });
  });

  describe("getQueueTypeByNameForUser", () => {
    it("should get queue type ID by name", async () => {
      const mockQueueType = { id: "queue-1" };
      (
        prisma.queueType.findFirst as ReturnType<typeof vi.fn>
      ).mockResolvedValue(mockQueueType);

      const result = await getQueueTypeByNameForUser(TEST_USER_ID, "Queue 1");

      expect(prisma.queueType.findFirst).toHaveBeenCalledWith({
        where: { userId: TEST_USER_ID, name: "Queue 1" },
        select: { id: true },
      });
      expect(result).toEqual(mockQueueType);
    });

    it("should return null if queue type not found", async () => {
      (
        prisma.queueType.findFirst as ReturnType<typeof vi.fn>
      ).mockResolvedValue(null);

      const result = await getQueueTypeByNameForUser(
        TEST_USER_ID,
        "Nonexistent",
      );

      expect(result).toBeNull();
    });
  });
});
