/**
 * Unit tests for PostStateMachine
 * Tests app/features/posts/state-machine/post-state-machine.server.ts
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock dependencies
const { mockPrisma } = vi.hoisted(() => {
  const mockPrisma = {
    post: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    $transaction: vi.fn(),
    postStateTransition: {
      create: vi.fn(),
      findMany: vi.fn(),
    },
  };
  return { mockPrisma };
});

vi.mock("~/lib/prisma.server", () => ({
  prisma: mockPrisma,
}));

vi.mock("~/lib/metrics/business-metrics.server", () => ({
  recordPostStateTransition: vi.fn(),
}));

import { TEST_USER_ID, TEST_POST_ID } from "../../utils/test-helpers";

import { PostStateMachine } from "~/features/posts/state-machine/post-state-machine.server";
// recordPostStateTransition is commented out in implementation
// import { recordPostStateTransition } from "~/lib/metrics/business-metrics.server";
import { prisma } from "~/lib/prisma.server";

describe("PostStateMachine", () => {
  let stateMachine: PostStateMachine;

  beforeEach(() => {
    vi.clearAllMocks();
    stateMachine = new PostStateMachine();
  });

  describe("transition", () => {
    it("should transition a post successfully", async () => {
      const mockPost = {
        id: TEST_POST_ID,
        currentState: "DRAFT",
      };

      (prisma.post.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockPost
      );
      (prisma.$transaction as ReturnType<typeof vi.fn>).mockImplementation(
        // eslint-disable-next-line @typescript-eslint/no-misused-promises -- Mock transaction callback
        async (callback) => {
          const tx = {
            post: {
              update: vi.fn().mockResolvedValue(mockPost),
            },
            postStateTransition: {
              create: vi.fn().mockResolvedValue({
                id: "transition-1",
                postId: TEST_POST_ID,
                fromState: "DRAFT",
                toState: "SCHEDULED",
                reason: "Post scheduled",
              }),
            },
          };
          // eslint-disable-next-line @typescript-eslint/no-unsafe-call -- Mock transaction callback
          return callback(tx);
        }
      );

      await stateMachine.transition(
        TEST_POST_ID,
        TEST_USER_ID,
        "SCHEDULED",
        "Post scheduled"
      );

      expect(prisma.post.findUnique).toHaveBeenCalledWith({
        where: { id: TEST_POST_ID, userId: TEST_USER_ID },
        select: { currentState: true },
      });
      expect(prisma.$transaction).toHaveBeenCalled();
      // recordPostStateTransition is currently commented out in implementation
      // expect(recordPostStateTransition).toHaveBeenCalledWith("DRAFT", "SCHEDULED");
    });

    it("should throw error if post not found", async () => {
      (prisma.post.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(
        null
      );

      await expect(
        stateMachine.transition(
          TEST_POST_ID,
          TEST_USER_ID,
          "SCHEDULED",
          "Post scheduled"
        )
      ).rejects.toThrow(
        `Post ${TEST_POST_ID} not found for user ${TEST_USER_ID}`
      );
    });

    it("should throw error for invalid transition", async () => {
      const mockPost = {
        id: TEST_POST_ID,
        currentState: "DRAFT",
      };

      (prisma.post.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockPost
      );

      await expect(
        stateMachine.transition(
          TEST_POST_ID,
          TEST_USER_ID,
          "PUBLISHING",
          "Invalid transition"
        )
      ).rejects.toThrow("Invalid transition from DRAFT to PUBLISHING");
    });

    it("should use DRAFT as default state if currentState is null", async () => {
      const mockPost = {
        id: TEST_POST_ID,
        currentState: null,
      };

      (prisma.post.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockPost
      );
      (prisma.$transaction as ReturnType<typeof vi.fn>).mockImplementation(
        // eslint-disable-next-line @typescript-eslint/no-misused-promises -- Mock transaction callback
        async (callback) => {
          const tx = {
            post: {
              update: vi.fn().mockResolvedValue(mockPost),
            },
            postStateTransition: {
              create: vi.fn().mockResolvedValue({
                id: "transition-1",
                postId: TEST_POST_ID,
                fromState: "DRAFT",
                toState: "SCHEDULED",
                reason: "Post scheduled",
              }),
            },
          };
          // eslint-disable-next-line @typescript-eslint/no-unsafe-call -- Mock transaction callback
          return callback(tx);
        }
      );

      await stateMachine.transition(
        TEST_POST_ID,
        TEST_USER_ID,
        "SCHEDULED",
        "Post scheduled"
      );

      // recordPostStateTransition is currently commented out in implementation
      // expect(recordPostStateTransition).toHaveBeenCalledWith("DRAFT", "SCHEDULED");
    });

    it("should record transition in database", async () => {
      const mockPost = {
        id: TEST_POST_ID,
        currentState: "SCHEDULED",
      };

      let transitionCreated = false;

      (prisma.post.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockPost
      );
      (prisma.$transaction as ReturnType<typeof vi.fn>).mockImplementation(
        // eslint-disable-next-line @typescript-eslint/no-misused-promises -- Mock transaction callback
        async (callback) => {
          const tx = {
            post: {
              update: vi.fn().mockResolvedValue(mockPost),
            },
            postStateTransition: {
              create: vi.fn().mockImplementation(async (data) => {
                transitionCreated = true;
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access -- Test mock data access
                expect(data.data.postId).toBe(TEST_POST_ID);
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access -- Test mock data access
                expect(data.data.fromState).toBe("SCHEDULED");
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access -- Test mock data access
                expect(data.data.toState).toBe("PUBLISHING");
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access -- Test mock data access
                expect(data.data.reason).toBe("Starting publish");
                return {
                  id: "transition-1",
                  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access -- Test mock data access
                  ...data.data,
                };
              }),
            },
          };
          // eslint-disable-next-line @typescript-eslint/no-unsafe-call -- Mock transaction callback
          return callback(tx);
        }
      );

      await stateMachine.transition(
        TEST_POST_ID,
        TEST_USER_ID,
        "PUBLISHING",
        "Starting publish"
      );

      expect(transitionCreated).toBe(true);
    });
  });

  describe("getStateHistory", () => {
    it("should return state transition history", async () => {
      const mockTransitions = [
        {
          id: "transition-1",
          postId: TEST_POST_ID,
          fromState: "DRAFT",
          toState: "SCHEDULED",
          reason: "Post scheduled",
          createdAt: new Date("2024-01-01T10:00:00Z"),
        },
        {
          id: "transition-2",
          postId: TEST_POST_ID,
          fromState: "SCHEDULED",
          toState: "PUBLISHING",
          reason: "Starting publish",
          createdAt: new Date("2024-01-01T11:00:00Z"),
        },
      ];

      (
        prisma.postStateTransition.findMany as ReturnType<typeof vi.fn>
      ).mockResolvedValue(mockTransitions);

      const history = await stateMachine.getStateHistory(TEST_POST_ID);

      expect(history).toHaveLength(2);
      expect(history[0]).toEqual({
        from: "DRAFT",
        to: "SCHEDULED",
        reason: "Post scheduled",
        timestamp: mockTransitions[0]?.createdAt,
      });
      expect(history[1]).toEqual({
        from: "SCHEDULED",
        to: "PUBLISHING",
        reason: "Starting publish",
        timestamp: mockTransitions[1]?.createdAt,
      });
      expect(prisma.postStateTransition.findMany).toHaveBeenCalledWith({
        where: { postId: TEST_POST_ID },
        orderBy: { createdAt: "desc" },
      });
    });

    it("should return empty array if no transitions exist", async () => {
      (
        prisma.postStateTransition.findMany as ReturnType<typeof vi.fn>
      ).mockResolvedValue([]);

      const history = await stateMachine.getStateHistory(TEST_POST_ID);

      expect(history).toEqual([]);
    });
  });

  describe("getCurrentState", () => {
    it("should return current state of post", async () => {
      const mockPost = {
        id: TEST_POST_ID,
        currentState: "SCHEDULED",
      };

      (prisma.post.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockPost
      );

      const state = await stateMachine.getCurrentState(TEST_POST_ID);

      expect(state).toBe("SCHEDULED");
      expect(prisma.post.findUnique).toHaveBeenCalledWith({
        where: { id: TEST_POST_ID },
        select: { currentState: true },
      });
    });

    it("should return DRAFT as default if currentState is null", async () => {
      const mockPost = {
        id: TEST_POST_ID,
        currentState: null,
      };

      (prisma.post.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockPost
      );

      const state = await stateMachine.getCurrentState(TEST_POST_ID);

      expect(state).toBe("DRAFT");
    });

    it("should return DRAFT if post not found", async () => {
      (prisma.post.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(
        null
      );

      const state = await stateMachine.getCurrentState(TEST_POST_ID);

      expect(state).toBe("DRAFT");
    });
  });
});
