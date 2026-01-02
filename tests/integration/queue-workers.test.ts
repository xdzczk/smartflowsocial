/**
 * Integration tests for queue workers
 * 
 * Tests the workers in app/features/posts/queues.server.ts
 */

import type { Job } from "bullmq";
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock global fetch
global.fetch = vi.fn();

// Mock BullMQ Worker - needs to be a class constructor
vi.mock("bullmq", () => {
  class MockWorker {
    queueName: string;
    process: ((job: Job) => Promise<unknown>) | undefined;
    close: ReturnType<typeof vi.fn>;
    
    constructor(queueName: string, processor: (job: Job) => Promise<unknown>, _options?: unknown) {
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
vi.mock("~/models/post.commands.server", () => ({
  updatePostStatus: vi.fn(),
}));

vi.mock("~/models/post.queries.server", () => ({
  getCronDueScheduledPosts: vi.fn(),
}));

vi.mock("~/models/longformpost.server", () => ({
  updateLongFormPostStatus: vi.fn(),
  getCronDueScheduledLongFormPosts: vi.fn(),
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
  enqueuePostJob: vi.fn(),
  enqueueLongFormPostJob: vi.fn(),
}));

const { mockPrisma } = vi.hoisted(() => {
  const mockPrisma = {
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
  };
  return { mockPrisma };
});

vi.mock("~/lib/prisma.server", () => ({
  prisma: mockPrisma,
}));

import { getUserById } from "~/features/user";
import { enqueuePostJob } from "~/infra/queue";
import { prisma } from "~/lib/prisma.server";
// updateLongFormPostStatus is used via mock (see lines 373, 384, 435)
import { updateLongFormPostStatus, getCronDueScheduledLongFormPosts } from "~/models/longformpost.server";
import { updatePostStatus } from "~/models/post.commands.server";
import { getCronDueScheduledPosts } from "~/models/post.queries.server";

import { TEST_USER_ID } from "../utils/test-helpers";

// Import workers after mocks are set up
interface MockWorkerType {
  process?: (job: Job) => Promise<unknown>;
  close: ReturnType<typeof vi.fn>;
}
let scheduledPostsWorker: MockWorkerType | undefined;
let scheduledLongFormPostsWorker: MockWorkerType | undefined;
let postCheckerWorker: MockWorkerType | undefined;

describe("Queue Workers", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    process.env.NOSTR_PUBLISHER_URL = "https://api.nostr-publisher.com/publish";
    
    // Dynamically import workers after mocks
    const module = await import("~/features/posts/queues.server");
    scheduledPostsWorker = module.scheduledPostsWorker as unknown as MockWorkerType;
    scheduledLongFormPostsWorker = module.scheduledLongFormPostsWorker as unknown as MockWorkerType;
    postCheckerWorker = module.postCheckerWorker as unknown as MockWorkerType;
  });

  describe("Scheduled Posts Worker", () => {
    it("should process scheduled post successfully", async () => {
      const mockJobData = {
        postId: "post-123",
        userId: TEST_USER_ID,
        signedEvent: {
          id: "event-123",
          kind: 1,
          content: "Test post",
        },
      };
      const mockJob: Job = {
        data: mockJobData,
      } as unknown as Job;

      const mockUser = {
        id: TEST_USER_ID,
        userRelays: ["wss://relay1.com", "wss://relay2.com"],
      };

      // Mock Prisma post.findUnique to return existing post
      (prisma.post.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: "post-123",
        isPosted: false,
        nostrEventId: null,
      });

      (getUserById as ReturnType<typeof vi.fn>).mockResolvedValue(mockUser);
      (updatePostStatus as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        status: 200,
      });

      if (!scheduledPostsWorker?.process) {
        throw new Error("scheduledPostsWorker.process is not defined");
      }
      const result = await scheduledPostsWorker.process(mockJob);

      expect(updatePostStatus).toHaveBeenCalledWith({
        id: "post-123",
        userId: TEST_USER_ID,
        isPosted: true,
      });
      expect(getUserById).toHaveBeenCalledWith(TEST_USER_ID);
      expect(global.fetch).toHaveBeenCalledWith(
        "https://api.nostr-publisher.com/publish",
        expect.objectContaining({
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            relays: ["wss://relay1.com", "wss://relay2.com"],
            event: mockJobData.signedEvent,
          }),
        }),
      );
      expect(result).toEqual({ success: true, postId: "post-123" });
    });

    it("should sanitize user relays", async () => {
      const mockJobData = {
        postId: "post-123",
        userId: TEST_USER_ID,
        signedEvent: { id: "event-123" },
      };
      const mockJob: Job = {
        data: mockJobData,
      } as unknown as Job;

      const mockUser = {
        id: TEST_USER_ID,
        userRelays: ["  wss://relay1.com  ", "  wss://relay2.com  "],
      };

      (getUserById as ReturnType<typeof vi.fn>).mockResolvedValue(mockUser);
      (updatePostStatus as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        status: 200,
      });

      if (!scheduledPostsWorker?.process) {
        throw new Error("scheduledPostsWorker.process is not defined");
      }
      await scheduledPostsWorker.process(mockJob);

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: JSON.stringify({
            relays: ["wss://relay1.com", "wss://relay2.com"],
            event: mockJobData.signedEvent,
          }),
        }),
      );
    });

    it("should handle missing user", async () => {
      const mockJobData = {
        postId: "post-123",
        userId: TEST_USER_ID,
        signedEvent: { id: "event-123" },
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

      (getUserById as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      if (!scheduledPostsWorker?.process) {
        throw new Error("scheduledPostsWorker.process is not defined");
      }
      await expect(scheduledPostsWorker.process(mockJob)).rejects.toThrow(
        `User ${TEST_USER_ID} not found`,
      );
    });

    it("should handle empty user relays", async () => {
      const mockJobData = {
        postId: "post-123",
        userId: TEST_USER_ID,
        signedEvent: { id: "event-123" },
      };
      const mockJob: Job = {
        data: mockJobData,
      } as unknown as Job;

      const mockUser = {
        id: TEST_USER_ID,
        userRelays: [],
      };

      (getUserById as ReturnType<typeof vi.fn>).mockResolvedValue(mockUser);
      (updatePostStatus as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        status: 200,
      });

      if (!scheduledPostsWorker?.process) {
        throw new Error("scheduledPostsWorker.process is not defined");
      }
      await scheduledPostsWorker.process(mockJob);

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: JSON.stringify({
            relays: [],
            event: mockJobData.signedEvent,
          }),
        }),
      );
    });

    it("should handle publisher API errors", async () => {
      const mockJobData = {
        postId: "post-123",
        userId: TEST_USER_ID,
        signedEvent: { id: "event-123" },
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

      const mockUser = {
        id: TEST_USER_ID,
        userRelays: ["wss://relay1.com"],
      };

      (getUserById as ReturnType<typeof vi.fn>).mockResolvedValue(mockUser);
      (updatePostStatus as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
      });

      if (!scheduledPostsWorker?.process) {
        throw new Error("scheduledPostsWorker.process is not defined");
      }
      await expect(scheduledPostsWorker.process(mockJob)).rejects.toThrow(
        "Failed to post to nostr publisher",
      );
    });

    it("should handle fetch errors", async () => {
      const mockJobData = {
        postId: "post-123",
        userId: TEST_USER_ID,
        signedEvent: { id: "event-123" },
      };
      const mockJob: Job = {
        data: mockJobData,
      } as unknown as Job;

      const mockUser = {
        id: TEST_USER_ID,
        userRelays: ["wss://relay1.com"],
      };

      (getUserById as ReturnType<typeof vi.fn>).mockResolvedValue(mockUser);
      (updatePostStatus as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
      (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error("Network error"),
      );

      if (!scheduledPostsWorker?.process) {
        throw new Error("scheduledPostsWorker.process is not defined");
      }
      await expect(scheduledPostsWorker.process(mockJob)).rejects.toThrow("Network error");
    });
  });

  describe("Scheduled Longform Posts Worker", () => {
    it("should process scheduled longform post successfully", async () => {
      const mockJobData = {
        postId: "longform-123",
        userId: TEST_USER_ID,
        signedEvent: {
          id: "event-123",
          kind: 30023,
          content: "Longform post",
        },
      };
      const mockJob: Job = {
        data: mockJobData,
      } as unknown as Job;

      // Mock Prisma longFormPost.findUnique to return existing post
      (prisma.longFormPost.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: "longform-123",
        isPublished: false,
        nostrEventId: null,
      });

      const mockUser = {
        id: TEST_USER_ID,
        userRelays: ["wss://relay1.com"],
      };

      (getUserById as ReturnType<typeof vi.fn>).mockResolvedValue(mockUser);
      (updateLongFormPostStatus as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        status: 200,
      });

      if (!scheduledLongFormPostsWorker?.process) {
        throw new Error("scheduledLongFormPostsWorker.process is not defined");
      }
      const result = await scheduledLongFormPostsWorker.process(mockJob);

      expect(updateLongFormPostStatus).toHaveBeenCalledWith({
        id: "longform-123",
        userId: TEST_USER_ID,
        isPublished: true,
      });
      expect(result).toEqual({ success: true, postId: "longform-123" });
    });

    it("should handle missing user", async () => {
      const mockJobData = {
        postId: "longform-123",
        userId: TEST_USER_ID,
        signedEvent: { id: "event-123" },
      };
      const mockJob: Job = {
        data: mockJobData,
      } as unknown as Job;

      (getUserById as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      if (!scheduledLongFormPostsWorker?.process) {
        throw new Error("scheduledLongFormPostsWorker.process is not defined");
      }
      await expect(scheduledLongFormPostsWorker.process(mockJob)).rejects.toThrow(
        `User ${TEST_USER_ID} not found`,
      );
    });

    it("should handle publisher API errors", async () => {
      const mockJobData = {
        postId: "longform-123",
        userId: TEST_USER_ID,
        signedEvent: { id: "event-123" },
      };
      const mockJob: Job = {
        data: mockJobData,
      } as unknown as Job;

      // Mock Prisma longFormPost.findUnique to return existing post
      (prisma.longFormPost.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: "longform-123",
        isPublished: false,
        nostrEventId: null,
      });

      const mockUser = {
        id: TEST_USER_ID,
        userRelays: ["wss://relay1.com"],
      };

      (getUserById as ReturnType<typeof vi.fn>).mockResolvedValue(mockUser);
      (updateLongFormPostStatus as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
      });

      if (!scheduledLongFormPostsWorker?.process) {
        throw new Error("scheduledLongFormPostsWorker.process is not defined");
      }
      await expect(scheduledLongFormPostsWorker.process(mockJob)).rejects.toThrow(
        "Failed to post longform to nostr publisher",
      );
    });
  });

  describe("Post Checker Worker", () => {
    it("should check for due posts and schedule them", async () => {
      const now = Math.floor(Date.now() / 1000);
      const dueTime = now - 10; // 10 seconds ago

      const mockPosts = [
        {
          id: "post-1",
          userId: TEST_USER_ID,
          signedEvent: { id: "event-1" },
          scheduledFor: dueTime.toString(),
        },
        {
          id: "post-2",
          userId: TEST_USER_ID,
          signedEvent: { id: "event-2" },
          scheduledFor: (now + 100).toString(), // Future post
        },
      ];

      // Dynamic import() type annotation needed for type reference
      // eslint-disable-next-line @typescript-eslint/consistent-type-imports
      const mockLongformPosts: import("~/features/posts/types").LongFormPostData[] = [];

      (getCronDueScheduledPosts as ReturnType<typeof vi.fn>).mockResolvedValue(mockPosts);
      (getCronDueScheduledLongFormPosts as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockLongformPosts,
      );
      (enqueuePostJob as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

      if (!postCheckerWorker?.process) {
        throw new Error("postCheckerWorker.process is not defined");
      }
      const result = await postCheckerWorker.process({} as unknown as Job) as { processed: number };

      expect(getCronDueScheduledPosts).toHaveBeenCalled();
      expect(getCronDueScheduledLongFormPosts).toHaveBeenCalled();
      expect(result.processed).toBe(2); // Both posts counted, but only one scheduled
    });

    it("should handle posts with missing required fields", async () => {
      const mockPosts = [
        {
          id: "post-1",
          userId: null, // Missing userId
          signedEvent: { id: "event-1" },
          scheduledFor: "1704067200",
        },
        {
          id: "post-2",
          userId: TEST_USER_ID,
          signedEvent: null, // Missing signedEvent
          scheduledFor: "1704067200",
        },
        {
          id: "post-3",
          userId: TEST_USER_ID,
          signedEvent: { id: "event-3" },
          scheduledFor: null, // Missing scheduledFor
        },
      ];

      (getCronDueScheduledPosts as ReturnType<typeof vi.fn>).mockResolvedValue(mockPosts);
      (getCronDueScheduledLongFormPosts as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      if (!postCheckerWorker?.process) {
        throw new Error("postCheckerWorker.process is not defined");
      }
      const result = await postCheckerWorker.process({} as unknown as Job);

      // Should skip posts with missing fields
      const typedResult = result as { processed: number };
      expect(typedResult.processed).toBe(3); // All counted, but none scheduled
    });

    it("should handle longform posts", async () => {
      const now = Math.floor(Date.now() / 1000);
      const dueTime = now - 10;

      // Dynamic import() type annotation needed for type reference
      // eslint-disable-next-line @typescript-eslint/consistent-type-imports
      const mockPosts: import("~/features/posts/types").PostData[] = [];
      const mockLongformPosts = [
        {
          id: "longform-1",
          userId: TEST_USER_ID,
          signedEvent: { id: "event-1" },
          scheduledFor: dueTime.toString(),
        },
      ];

      (getCronDueScheduledPosts as ReturnType<typeof vi.fn>).mockResolvedValue(mockPosts);
      (getCronDueScheduledLongFormPosts as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockLongformPosts,
      );

      if (!postCheckerWorker?.process) {
        throw new Error("postCheckerWorker.process is not defined");
      }
      const result = await postCheckerWorker.process({} as unknown as Job) as { processed: number };

      expect(result.processed).toBe(1);
    });

    it("should handle immediate processing (timeDiff <= 0)", async () => {
      const now = Math.floor(Date.now() / 1000);
      const pastTime = now - 100; // Well in the past

      const mockPosts = [
        {
          id: "post-1",
          userId: TEST_USER_ID,
          signedEvent: { id: "event-1" },
          scheduledFor: pastTime.toString(),
        },
      ];

      (getCronDueScheduledPosts as ReturnType<typeof vi.fn>).mockResolvedValue(mockPosts);
      (getCronDueScheduledLongFormPosts as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      if (!postCheckerWorker?.process) {
        throw new Error("postCheckerWorker.process is not defined");
      }
      const result = await postCheckerWorker.process({} as unknown as Job) as { processed: number };

      expect(result.processed).toBe(1);
    });

    it("should handle database errors gracefully", async () => {
      (getCronDueScheduledPosts as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error("Database error"),
      );
      (getCronDueScheduledLongFormPosts as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      if (!postCheckerWorker?.process) {
        throw new Error("postCheckerWorker.process is not defined");
      }
      await expect(postCheckerWorker.process({} as unknown as Job)).rejects.toThrow("Database error");
    });

    it("should handle empty results", async () => {
      (getCronDueScheduledPosts as ReturnType<typeof vi.fn>).mockResolvedValue([]);
      (getCronDueScheduledLongFormPosts as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      if (!postCheckerWorker?.process) {
        throw new Error("postCheckerWorker.process is not defined");
      }
      const result = await postCheckerWorker.process({} as unknown as Job) as { processed: number };

      expect(result.processed).toBe(0);
    });
  });
});

