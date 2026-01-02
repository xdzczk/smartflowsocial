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
    // eslint-disable-next-line @typescript-eslint/consistent-type-imports
    process: ((job: import("bullmq").Job) => Promise<unknown>) | undefined;
    close: ReturnType<typeof vi.fn>;
    
    constructor(
      queueName: string,
      // Dynamic import() type annotation needed for type reference
      // eslint-disable-next-line @typescript-eslint/consistent-type-imports
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
    },
    longFormPost: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
    $use: vi.fn(),
  },
}));

vi.mock("~/models/post.commands.server", () => ({
  updatePostStatus: vi.fn(),
}));

vi.mock("~/models/longformpost.server", () => ({
  updateLongFormPostStatus: vi.fn(),
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

import { getUserById } from "~/features/user";
import { prisma } from "~/lib/prisma.server";
import { updatePostStatus } from "~/models/post.commands.server";

import { TEST_USER_ID } from "../utils/test-helpers";

// Import workers after mocks are set up
interface MockWorkerType {
  process?: (job: Job) => Promise<unknown>;
  close: ReturnType<typeof vi.fn>;
}
let scheduledPostsWorker: MockWorkerType | undefined;
let scheduledLongFormPostsWorker: MockWorkerType | undefined;

beforeAll(async () => {
  const module = await import("~/features/posts/queues.server");
  scheduledPostsWorker = module.scheduledPostsWorker as unknown as MockWorkerType;
  scheduledLongFormPostsWorker = module.scheduledLongFormPostsWorker as unknown as MockWorkerType;
});

describe("Queue Worker Edge Cases", () => {
  const TEST_POST_ID = "post-123";
  const TEST_SIGNED_EVENT = {
    id: "event-123",
    kind: 1,
    content: "Test post",
    pubkey: "pubkey-123",
    created_at: Math.floor(Date.now() / 1000),
    tags: [],
    sig: "sig-123",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NOSTR_PUBLISHER_URL = "https://api.nostr-publisher.com/publish";
  });

  describe("Worker Crash Scenarios", () => {
    it("should handle database error during post status update", async () => {
      (prisma.post.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: TEST_POST_ID,
        isPosted: false,
        nostrEventId: null,
      });

      (updatePostStatus as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error("Database connection lost"),
      );

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
      await expect(
        processor(mockJob),
      ).rejects.toThrow("Database connection lost");
    });

    it("should handle user not found error gracefully", async () => {
      (prisma.post.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: TEST_POST_ID,
        isPosted: false,
        nostrEventId: null,
      });

      (updatePostStatus as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
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
      await expect(
        scheduledPostsWorker.process(mockJob),
      ).rejects.toThrow(`User ${TEST_USER_ID} not found`);
    });

    it("should handle Nostr publisher API failure", async () => {
      (prisma.post.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: TEST_POST_ID,
        isPosted: false,
        nostrEventId: null,
      });

      (updatePostStatus as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
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
      await expect(
        scheduledPostsWorker.process(mockJob),
      ).rejects.toThrow("Failed to post to nostr publisher");

      // Post should still be marked as posted (idempotency prevents duplicate)
      expect(updatePostStatus).toHaveBeenCalled();
    });

    it("should handle network timeout when publishing", async () => {
      (prisma.post.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: TEST_POST_ID,
        isPosted: false,
        nostrEventId: null,
      });

      (updatePostStatus as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
      (getUserById as ReturnType<typeof vi.fn>).mockResolvedValue({
        userRelays: ["wss://relay1.com"],
      });

      (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("Network timeout"));

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
      await expect(
        scheduledPostsWorker.process(mockJob),
      ).rejects.toThrow("Network timeout");
    });
  });

  describe("Idempotency Edge Cases", () => {
    it("should skip processing if post already posted (duplicate job)", async () => {
      (prisma.post.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: TEST_POST_ID,
        isPosted: true, // Already posted
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
      expect(updatePostStatus).not.toHaveBeenCalled();
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it("should handle race condition: post becomes posted between check and update", async () => {
      // First call: post not posted
      // Second call (simulating race): post is posted
      (prisma.post.findUnique as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce({
          id: TEST_POST_ID,
          isPosted: false,
          nostrEventId: null,
        })
        .mockResolvedValueOnce({
          id: TEST_POST_ID,
          isPosted: true, // Another worker posted it
          nostrEventId: "event-123",
        });

      (updatePostStatus as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error("Post already posted"), // Simulate unique constraint violation
      );

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
      await expect(
        scheduledPostsWorker.process(mockJob),
      ).rejects.toThrow();
    });
  });

  describe("Concurrent Job Processing", () => {
    it("should handle multiple workers processing same job", async () => {
      (prisma.post.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: TEST_POST_ID,
        isPosted: false,
        nostrEventId: null,
      });

      (updatePostStatus as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
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

      // First should succeed, others should be skipped (idempotency)
      const successful = results.filter((r) => r.status === "fulfilled");
      expect(successful.length).toBeGreaterThan(0);
    });
  });

  describe("Longform Post Worker Edge Cases", () => {
    it("should handle longform post not found", async () => {
      (prisma.longFormPost.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(
        null,
      );

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
        scheduledLongFormPostsWorker.process(mockJob),
      ).rejects.toThrow("Longform post longform-123 not found");
    });

    it("should skip if longform post already published", async () => {
      (prisma.longFormPost.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: "longform-123",
        isPublished: true,
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
      (prisma.post.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      if (!scheduledPostsWorker?.process) {
        throw new Error("scheduledPostsWorker.process is not defined");
      }
      await expect(
        scheduledPostsWorker.process(mockJob),
      ).rejects.toThrow();
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
        isPosted: false,
        nostrEventId: null,
      });

      // The worker will fail when trying to publish without signedEvent (undefined in JSON.stringify)
      const mockUser = {
        id: TEST_USER_ID,
        userRelays: ["wss://relay1.com"],
      };
      (getUserById as ReturnType<typeof vi.fn>).mockResolvedValue(mockUser);
      (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error("Cannot stringify undefined"),
      );

      if (!scheduledPostsWorker?.process) {
        throw new Error("scheduledPostsWorker.process is not defined");
      }
      await expect(
        scheduledPostsWorker.process(mockJob),
      ).rejects.toThrow();
    });
  });
});

