/**
 * Integration tests for queue type resolver service
 * Tests app/features/posts/services/queue-type-resolver.server.ts
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock Prisma
vi.mock("~/lib/prisma.server", () => ({
  prisma: {
    queueType: {
      findFirst: vi.fn(),
    },
  },
}));

import { resolveQueueTypeId } from "~/features/posts/services/queue-type-resolver.server";
import { prisma } from "~/lib/prisma.server";

import { TEST_USER_ID } from "../../utils/test-helpers";

describe("Queue Type Resolver Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("resolveQueueTypeId", () => {
    it("should return queueTypeId directly if provided", async () => {
      const result = await resolveQueueTypeId(TEST_USER_ID, "queue-123", null);

      expect(result).toBe("queue-123");
      expect(prisma.queueType.findFirst).not.toHaveBeenCalled();
    });

    it("should return null if queueType is 'unassigned'", async () => {
      const result = await resolveQueueTypeId(TEST_USER_ID, null, "unassigned");

      expect(result).toBeNull();
      expect(prisma.queueType.findFirst).not.toHaveBeenCalled();
    });

    it("should return null if queueType is null", async () => {
      const result = await resolveQueueTypeId(TEST_USER_ID, null, null);

      expect(result).toBeNull();
      expect(prisma.queueType.findFirst).not.toHaveBeenCalled();
    });

    it("should return null if queueType is undefined", async () => {
      const result = await resolveQueueTypeId(TEST_USER_ID, null, undefined);

      expect(result).toBeNull();
      expect(prisma.queueType.findFirst).not.toHaveBeenCalled();
    });

    it("should lookup queue type by name and return ID", async () => {
      (
        prisma.queueType.findFirst as ReturnType<typeof vi.fn>
      ).mockResolvedValue({
        id: "queue-456",
      });

      const result = await resolveQueueTypeId(TEST_USER_ID, null, "Morning");

      expect(result).toBe("queue-456");
      expect(prisma.queueType.findFirst).toHaveBeenCalledWith({
        where: {
          userId: TEST_USER_ID,
          name: "Morning",
        },
        select: {
          id: true,
        },
      });
    });

    it("should return null if queue type not found by name", async () => {
      (
        prisma.queueType.findFirst as ReturnType<typeof vi.fn>
      ).mockResolvedValue(null);

      const result = await resolveQueueTypeId(
        TEST_USER_ID,
        null,
        "NonExistent",
      );

      expect(result).toBeNull();
      expect(prisma.queueType.findFirst).toHaveBeenCalledWith({
        where: {
          userId: TEST_USER_ID,
          name: "NonExistent",
        },
        select: {
          id: true,
        },
      });
    });

    it("should prioritize queueTypeId over queueType name", async () => {
      const result = await resolveQueueTypeId(
        TEST_USER_ID,
        "queue-789",
        "Morning",
      );

      expect(result).toBe("queue-789");
      expect(prisma.queueType.findFirst).not.toHaveBeenCalled();
    });

    it("should handle empty string queueType", async () => {
      // Empty string is falsy, so it returns null without database lookup
      const result = await resolveQueueTypeId(TEST_USER_ID, null, "");

      expect(result).toBeNull();
      expect(prisma.queueType.findFirst).not.toHaveBeenCalled();
    });
  });
});
