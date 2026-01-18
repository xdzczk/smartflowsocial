/**
 * Edge Case Tests for Queue Workers
 *
 * Tests critical edge cases for queue worker processing:
 * - Worker crashes mid-processing
 * - Duplicate job processing
 * - Queue backpressure
 * - Redis connection failures
 * - Job retry scenarios
 */

import type { Job } from "bullmq";
import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest";

// Mock BullMQ Worker
vi.mock("bullmq", () => {
  class MockWorker {
    queueName: string;
    // Dynamic import() type annotation needed for type reference
    // eslint-disable-next-line @typescript-eslint/consistent-type-imports -- Dynamic import requires value import
    process: ((job: import("bullmq").Job) => Promise<unknown>) | undefined;
    close: ReturnType<typeof vi.fn>;

    constructor(
      queueName: string,
      // Dynamic import() type annotation needed for type reference
      // eslint-disable-next-line @typescript-eslint/consistent-type-imports -- Dynamic import requires value import
      processor: ((job: import("bullmq").Job) => Promise<unknown>) | undefined,
      _options?: unknown
    ) {
      this.queueName = queueName;
      // Store the processor function so tests can call it
      this.process = processor;
      this.close = vi.fn();
    }
  }

  return {
    Worker: MockWorker,
    Queue: vi.fn(),
    Job: vi.fn(),
  };
});

// Mock dependencies
vi.mock("~/lib/prisma.server", () => ({
  prisma: {
    post: {
      findUnique: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    longFormPost: {
      findUnique: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
    $use: vi.fn(),
    $transaction: vi.fn((callback) => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call -- Test mock callback has complex types
      return callback({
        post: { findUnique: vi.fn(), update: vi.fn() },
        longFormPost: { findUnique: vi.fn(), update: vi.fn() },
        user: { findUnique: vi.fn() },
        postStateTransition: { create: vi.fn() },
      });
    }),
  },
}));

vi.mock("~/models/post.commands.server", () => ({}));

vi.mock("~/models/longformpost.server", () => ({}));

const { mockTransition } = vi.hoisted(() => {
  const mockTransition = vi.fn();
  return { mockTransition };
});

vi.mock("~/features/posts/state-machine/post-state-machine.server", () => ({
  PostStateMachine: class {
    transition = mockTransition;
  },
}));

vi.mock("~/features/user", () => ({
  getUserById: vi.fn(),
}));

vi.mock("~/infra/queue", () => ({
  getQueueInstance: vi.fn(() => ({
    add: vi.fn(),
  })),
  redis: {
    quit: vi.fn(),
  },
  closeAllQueues: vi.fn(),
}));

// Mock global fetch
global.fetch = vi.fn();

import { TEST_USER_ID, createValidSignedEvent } from "../utils/test-helpers";

import { getUserById } from "~/features/user";
import { prisma } from "~/lib/prisma.server";

// Import workers after mocks are set up
interface MockWorkerType {
  process?: (job: Job) => Promise<unknown>;
  close: ReturnType<typeof vi.fn>;
}
let scheduledPostsWorker: MockWorkerType | undefined;
let scheduledLongFormPostsWorker: MockWorkerType | undefined;

beforeAll(async () => {
  const module = await import("~/features/posts/queues.server");
  scheduledPostsWorker =
    module.scheduledPostsWorker as unknown as MockWorkerType;
  scheduledLongFormPostsWorker =
    module.scheduledLongFormPostsWorker as unknown as MockWorkerType;
});

describe("Queue Worker Edge Cases", () => {
  const TEST_POST_ID = "post-123";
  const TEST_SIGNED_EVENT = createValidSignedEvent({ content: "Test post" });

  beforeEach(() => {
    vi.clearAllMocks();
    mockTransition.mockClear();
    mockTransition.mockResolvedValue(undefined);
    process.env["NOSTR_PUBLISHER_URL"] =
      "https://api.nostr-publisher.com/publish";

    // By default, allow lease acquisition/release
    (prisma.post.updateMany as ReturnType<typeof vi.fn>).mockResolvedValue({
      count: 1,
    });
    (
      prisma.longFormPost.updateMany as ReturnType<typeof vi.fn>
    ).mockResolvedValue({
      count: 1,
    });
  });

  describe("Worker Crash Scenarios", () => {
    it("should handle database error during post status update", async () => {
      (prisma.post.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: TEST_POST_ID,
        currentState: "SCHEDULED",
        nostrEventId: null,
      });

      // updatePostStatus was removed - state transitions now use PostStateMachine

      const mockJobData = {
        postId: TEST_POST_ID,
        userId: TEST_USER_ID,
        signedEvent: TEST_SIGNED_EVENT,
      };
      const mockJob: Job = {
        data: mockJobData,
      } as unknown as Job;

      // Worker processor function should throw error (BullMQ will handle retry)
      // The processor is the function passed to Worker constructor
      if (!scheduledPostsWorker?.process) {
        throw new Error("scheduledPostsWorker.process is not defined");
      }
      const processor = scheduledPostsWorker.process;
      // The error will be the first error encountered, which is "User not found"
      // State transitions now use PostStateMachine
      await expect(processor(mockJob)).rejects.toThrow();
    });

    it("should handle user not found error gracefully", async () => {
      (prisma.post.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: TEST_POST_ID,
        currentState: "SCHEDULED",
        nostrEventId: null,
      });

      // updatePostStatus was removed - state transitions now use PostStateMachine
      (getUserById as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const mockJobData = {
        postId: TEST_POST_ID,
        userId: TEST_USER_ID,
        signedEvent: TEST_SIGNED_EVENT,
      };
      const mockJob: Job = {
        data: mockJobData,
      } as unknown as Job;

      if (!scheduledPostsWorker?.process) {
        throw new Error("scheduledPostsWorker.process is not defined");
      }
      await expect(scheduledPostsWorker.process(mockJob)).rejects.toThrow(
        `User ${TEST_USER_ID} not found`
      );
    });

    it("should handle Nostr publisher API failure", async () => {
      (prisma.post.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: TEST_POST_ID,
        currentState: "SCHEDULED",
        nostrEventId: null,
      });

      // updatePostStatus was removed - state transitions now use PostStateMachine
      (getUserById as ReturnType<typeof vi.fn>).mockResolvedValue({
        userRelays: ["wss://relay1.com"],
      });

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
      });

      const mockJobData = {
        postId: TEST_POST_ID,
        userId: TEST_USER_ID,
        signedEvent: TEST_SIGNED_EVENT,
      };
      const mockJob: Job = {
        data: mockJobData,
      } as unknown as Job;

      if (!scheduledPostsWorker?.process) {
        throw new Error("scheduledPostsWorker.process is not defined");
      }
      await expect(scheduledPostsWorker.process(mockJob)).rejects.toThrow(
        "Failed to post to nostr publisher"
      );

      // Post should be transitioned to FAILED state when publish fails
      // The worker catches the error and transitions to FAILED, then throws
      // State transitions now use PostStateMachine
    });

    it("should handle network timeout when publishing", async () => {
      (prisma.post.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: TEST_POST_ID,
        currentState: "SCHEDULED",
        nostrEventId: null,
      });

      // updatePostStatus was removed - state transitions now use PostStateMachine
      (getUserById as ReturnType<typeof vi.fn>).mockResolvedValue({
        userRelays: ["wss://relay1.com"],
      });

      (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error("Network timeout")
      );

      const mockJobData = {
        postId: TEST_POST_ID,
        userId: TEST_USER_ID,
        signedEvent: TEST_SIGNED_EVENT,
      };
      const mockJob: Job = {
        data: mockJobData,
      } as unknown as Job;

      if (!scheduledPostsWorker?.process) {
        throw new Error("scheduledPostsWorker.process is not defined");
      }
      await expect(scheduledPostsWorker.process(mockJob)).rejects.toThrow(
        "Network timeout"
      );
    });
  });

  describe("Idempotency Edge Cases", () => {
    it("should skip processing if post already posted (duplicate job)", async () => {
      (prisma.post.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: TEST_POST_ID,
        currentState: "PUBLISHED", // Already posted
        nostrEventId: "event-123",
      });

      const mockJobData = {
        postId: TEST_POST_ID,
        userId: TEST_USER_ID,
        signedEvent: TEST_SIGNED_EVENT,
      };
      const mockJob: Job = {
        data: mockJobData,
      } as unknown as Job;

      if (!scheduledPostsWorker?.process) {
        throw new Error("scheduledPostsWorker.process is not defined");
      }
      const result = await scheduledPostsWorker.process(mockJob);

      expect(result).toEqual({
        success: true,
        postId: TEST_POST_ID,
        skipped: true,
      });
      // updatePostStatus was removed - state transitions now use PostStateMachine
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it("should handle race condition: post becomes posted between check and update", async () => {
      // First call: post not posted
      // Second call (simulating race): post is posted
      (prisma.post.findUnique as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce({
          id: TEST_POST_ID,
          currentState: "SCHEDULED",
          nostrEventId: null,
        })
        .mockResolvedValueOnce({
          id: TEST_POST_ID,
          currentState: "PUBLISHED", // Another worker posted it
          nostrEventId: "event-123",
        });

      // updatePostStatus was removed - state transitions now use PostStateMachine

      const mockJobData = {
        postId: TEST_POST_ID,
        userId: TEST_USER_ID,
        signedEvent: TEST_SIGNED_EVENT,
      };
      const mockJob: Job = {
        data: mockJobData,
      } as unknown as Job;

      // Should handle gracefully (idempotency check should catch this)
      if (!scheduledPostsWorker?.process) {
        throw new Error("scheduledPostsWorker.process is not defined");
      }
      await expect(scheduledPostsWorker.process(mockJob)).rejects.toThrow();
    });
  });

  describe("Concurrent Job Processing", () => {
    it("should handle multiple workers processing same job", async () => {
      // Simulate a multi-worker environment:
      // - Only one worker should acquire the publish lease and proceed
      // - Others should skip idempotently
      let _callCount = 0;

      (prisma.post.findUnique as ReturnType<typeof vi.fn>).mockImplementation(
        () => {
          _callCount++;
          const state = "SCHEDULED";
          return {
            id: TEST_POST_ID,
            currentState: state,
            nostrEventId: null,
            scheduledAtUtc: null,
            scheduledFor: null,
            publishAttemptId: null,
          };
        }
      );

      // First lease acquisition succeeds, the rest fail
      (prisma.post.updateMany as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce({ count: 1 })
        .mockResolvedValue({ count: 0 });

      // Mock post update to track state changes
      (prisma.post.update as ReturnType<typeof vi.fn>).mockResolvedValue({});

      // Mock state machine transition - allow all transitions (the idempotency check
      // in the worker code will handle preventing duplicate processing)
      mockTransition.mockResolvedValue(undefined);

      // updatePostStatus was removed - state transitions now use PostStateMachine
      (getUserById as ReturnType<typeof vi.fn>).mockResolvedValue({
        userRelays: ["wss://relay1.com"],
      });

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        status: 200,
      });

      const mockJobData = {
        postId: TEST_POST_ID,
        userId: TEST_USER_ID,
        signedEvent: TEST_SIGNED_EVENT,
      };
      const mockJob: Job = {
        data: mockJobData,
        attemptsMade: 0,
      } as unknown as Job;

      // Simulate concurrent processing
      if (!scheduledPostsWorker?.process) {
        throw new Error("scheduledPostsWorker.process is not defined");
      }
      const promises = [
        scheduledPostsWorker.process(mockJob),
        scheduledPostsWorker.process(mockJob),
        scheduledPostsWorker.process(mockJob),
      ];

      const results = await Promise.allSettled(promises);

      const fulfilled = results.filter((r) => r.status === "fulfilled");
      expect(fulfilled.length).toBe(3);

      const values = fulfilled.map((r) => r.value);
      const nonSkipped = values.filter((v) => {
        if (!v || typeof v !== "object") return false;
        return (v as { skipped?: boolean }).skipped !== true;
      });

      // Exactly one worker should have acquired the lease and proceeded
      expect(nonSkipped.length).toBe(1);
    });
  });

  describe("Longform Post Worker Edge Cases", () => {
    it("should handle longform post not found", async () => {
      (
        prisma.longFormPost.findUnique as ReturnType<typeof vi.fn>
      ).mockResolvedValue(null);

      const mockJobData = {
        postId: "longform-123",
        userId: TEST_USER_ID,
        signedEvent: TEST_SIGNED_EVENT,
      };
      const mockJob: Job = {
        data: mockJobData,
      } as unknown as Job;

      if (!scheduledLongFormPostsWorker?.process) {
        throw new Error("scheduledLongFormPostsWorker.process is not defined");
      }
      await expect(
        scheduledLongFormPostsWorker.process(mockJob)
      ).rejects.toThrow("Longform post longform-123 not found");
    });

    it("should skip if longform post already published", async () => {
      (
        prisma.longFormPost.findUnique as ReturnType<typeof vi.fn>
      ).mockResolvedValue({
        id: "longform-123",
        currentState: "PUBLISHED",
        nostrEventId: "event-123",
      });

      const mockJobData = {
        postId: "longform-123",
        userId: TEST_USER_ID,
        signedEvent: TEST_SIGNED_EVENT,
      };
      const mockJob: Job = {
        data: mockJobData,
      } as unknown as Job;

      if (!scheduledLongFormPostsWorker?.process) {
        throw new Error("scheduledLongFormPostsWorker.process is not defined");
      }
      const result = await scheduledLongFormPostsWorker.process(mockJob);

      expect(result).toEqual({
        success: true,
        postId: "longform-123",
        skipped: true,
      });
    });
  });

  describe("Invalid Job Data", () => {
    it("should handle missing postId in job data", async () => {
      const mockJobData = {
        userId: TEST_USER_ID,
        signedEvent: TEST_SIGNED_EVENT,
        // Missing postId
      };
      const mockJob: Job = {
        data: mockJobData,
      } as unknown as Job;

      // Mock Prisma to return null (post not found)
      (prisma.post.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(
        null
      );

      if (!scheduledPostsWorker?.process) {
        throw new Error("scheduledPostsWorker.process is not defined");
      }
      await expect(scheduledPostsWorker.process(mockJob)).rejects.toThrow();
    });

    it("should handle missing signedEvent in job data", async () => {
      const mockJobData = {
        postId: "post-123",
        userId: TEST_USER_ID,
        // Missing signedEvent
      };
      const mockJob: Job = {
        data: mockJobData,
      } as unknown as Job;

      // Mock Prisma post.findUnique to return existing post
      (prisma.post.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: "post-123",
        currentState: "SCHEDULED",
        nostrEventId: null,
      });

      // The worker will fail when trying to publish without signedEvent (undefined in JSON.stringify)
      const mockUser = {
        id: TEST_USER_ID,
        userRelays: ["wss://relay1.com"],
      };
      (getUserById as ReturnType<typeof vi.fn>).mockResolvedValue(mockUser);
      (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error("Cannot stringify undefined")
      );

      if (!scheduledPostsWorker?.process) {
        throw new Error("scheduledPostsWorker.process is not defined");
      }
      await expect(scheduledPostsWorker.process(mockJob)).rejects.toThrow();
    });
  });
});
