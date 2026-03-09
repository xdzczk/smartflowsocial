/**
 * Unit tests for LongFormPostStateMachine
 * Tests app/features/posts/state-machine/longform-post-state-machine.server.ts
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock dependencies
const { mockPrisma } = vi.hoisted(() => {
  const mockPrisma = {
    longFormPost: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    $transaction: vi.fn(),
    longFormPostStateTransition: {
      create: vi.fn(),
      findMany: vi.fn(),
    },
  };
  return { mockPrisma };
});

vi.mock("~/lib/prisma.server", () => ({
  prisma: mockPrisma,
}));

import { TEST_USER_ID } from "../../utils/test-helpers";

import { LongFormPostStateMachine } from "~/features/posts/server";
import { prisma } from "~/lib/prisma.server";

describe("LongFormPostStateMachine", () => {
  let stateMachine: LongFormPostStateMachine;
  const TEST_LONGFORM_ID = "longform-1";

  beforeEach(() => {
    vi.clearAllMocks();
    stateMachine = new LongFormPostStateMachine();
  });

  describe("transition", () => {
    it("should transition a longform post successfully and record transition", async () => {
      (
        prisma.longFormPost.findUnique as ReturnType<typeof vi.fn>
      ).mockResolvedValue({
        id: TEST_LONGFORM_ID,
        currentState: "DRAFT",
      });

      (prisma.$transaction as ReturnType<typeof vi.fn>).mockImplementation(
        // eslint-disable-next-line @typescript-eslint/no-misused-promises -- test transaction callback
        async (callback) => {
          const tx = {
            longFormPost: {
              update: vi.fn().mockResolvedValue({ id: TEST_LONGFORM_ID }),
            },
            longFormPostStateTransition: {
              create: vi.fn().mockResolvedValue({
                id: "t-1",
                longFormPostId: TEST_LONGFORM_ID,
                fromState: "DRAFT",
                toState: "SCHEDULED",
                reason: "Scheduled",
              }),
            },
          };
          // eslint-disable-next-line @typescript-eslint/no-unsafe-call -- mock callback
          return callback(tx);
        }
      );

      await stateMachine.transition(
        TEST_LONGFORM_ID,
        TEST_USER_ID,
        "SCHEDULED",
        "Scheduled"
      );

      expect(prisma.longFormPost.findUnique).toHaveBeenCalledWith({
        where: { id: TEST_LONGFORM_ID, userId: TEST_USER_ID },
        select: { currentState: true },
      });
      expect(prisma.$transaction).toHaveBeenCalled();
    });

    it("should throw if longform post not found", async () => {
      (
        prisma.longFormPost.findUnique as ReturnType<typeof vi.fn>
      ).mockResolvedValue(null);

      await expect(
        stateMachine.transition(
          TEST_LONGFORM_ID,
          TEST_USER_ID,
          "SCHEDULED",
          "Scheduled"
        )
      ).rejects.toThrow(
        `LongFormPost ${TEST_LONGFORM_ID} not found for user ${TEST_USER_ID}`
      );
    });

    it("should throw for invalid transition", async () => {
      (
        prisma.longFormPost.findUnique as ReturnType<typeof vi.fn>
      ).mockResolvedValue({
        id: TEST_LONGFORM_ID,
        currentState: "SCHEDULED",
      });

      await expect(
        stateMachine.transition(
          TEST_LONGFORM_ID,
          TEST_USER_ID,
          "PUBLISHED",
          "Invalid"
        )
      ).rejects.toThrow(/Invalid state transition from SCHEDULED to PUBLISHED/);
    });
  });

  describe("getStateHistory", () => {
    it("should return transition history", async () => {
      (
        prisma.longFormPostStateTransition.findMany as ReturnType<typeof vi.fn>
      ).mockResolvedValue([
        {
          id: "t-1",
          longFormPostId: TEST_LONGFORM_ID,
          fromState: "DRAFT",
          toState: "SCHEDULED",
          reason: "Scheduled",
          createdAt: new Date("2024-01-01T00:00:00.000Z"),
        },
      ]);

      const history = await stateMachine.getStateHistory(TEST_LONGFORM_ID);
      expect(history).toHaveLength(1);
      expect(history[0]?.from).toBe("DRAFT");
      expect(history[0]?.to).toBe("SCHEDULED");
    });
  });
});
