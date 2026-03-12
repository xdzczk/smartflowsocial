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

    constructor(
      queueName: string,
      processor: (job: Job) => Promise<unknown>,
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

// Mock dependencies (single mock so all used exports are available)
vi.mock("~/features/posts/server", () => ({
  getCronDueScheduledPosts: vi.fn(),
  getCronDueScheduledLongFormPosts: vi.fn(),
}));

vi.mock("~/features/user", () => ({
  getUserById: vi.fn(),
}));

vi.mock("~/features/relays/relay-resolution.server", () => ({
  resolveExecutionRelays: vi.fn(),
}));

vi.mock("~/features/relays/publish-relay-acks.server", () => ({
  persistPublishRelayAcks: vi.fn(),
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

// Track post state for mocks
const postStateMap = new Map<string, string>();
const longFormPostStateMap = new Map<string, string>();

const { mockPrisma } = vi.hoisted(() => {
  const mockPrisma = {
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
        post: {
          findUnique: vi.fn(
            async (
              args:
                | { where: { id: string; userId?: string } }
                | { where: { id: string } }
            ) => {
              const postId = args.where.id;
              const state = postStateMap.get(postId) ?? "SCHEDULED";
              return { id: postId, currentState: state };
            }
          ),
          update: vi.fn(
            async (args: {
              where: { id: string; userId?: string };
              data: { currentState?: string };
            }) => {
              const postId = args.where.id;
              if (args.data.currentState) {
                postStateMap.set(postId, args.data.currentState);
              }
              return {
                id: postId,
                currentState:
                  args.data.currentState ??
                  postStateMap.get(postId) ??
                  "SCHEDULED",
              };
            }
          ),
        },
        longFormPost: {
          findUnique: vi.fn(
            async (
              args:
                | { where: { id: string; userId?: string } }
                | { where: { id: string } }
            ) => {
              const postId = args.where.id;
              const state = longFormPostStateMap.get(postId) ?? "SCHEDULED";
              return { id: postId, currentState: state };
            }
          ),
          update: vi.fn(
            async (args: {
              where: { id: string; userId?: string };
              data: { currentState?: string };
            }) => {
              const postId = args.where.id;
              if (args.data.currentState) {
                longFormPostStateMap.set(postId, args.data.currentState);
              }
              return {
                id: postId,
                currentState:
                  args.data.currentState ??
                  longFormPostStateMap.get(postId) ??
                  "SCHEDULED",
              };
            }
          ),
        },
        user: { findUnique: vi.fn() },
        postStateTransition: { create: vi.fn() },
        longFormPostStateTransition: { create: vi.fn() },
      });
    }),
  };
  return { mockPrisma };
});

vi.mock("~/lib/prisma.server", () => ({
  prisma: mockPrisma,
}));

import { TEST_USER_ID, createValidSignedEvent } from "../utils/test-helpers";

import { getCronDueScheduledLongFormPosts } from "~/features/posts/server";
import { getCronDueScheduledPosts } from "~/features/posts/server";
import { persistPublishRelayAcks } from "~/features/relays/publish-relay-acks.server";
import { relaysArray as systemDefaultRelays } from "~/features/relays/relay-constants";
import { resolveExecutionRelays } from "~/features/relays/relay-resolution.server";
import { getUserById } from "~/features/user";
import { enqueuePostJob } from "~/infra/queue";
import { prisma } from "~/lib/prisma.server";

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
    postStateMap.clear();
    longFormPostStateMap.clear();
    process.env["NOSTR_PUBLISHER_URL"] =
      "https://api.nostr-publisher.com/publish";

    (resolveExecutionRelays as ReturnType<typeof vi.fn>).mockResolvedValue(
      systemDefaultRelays
    );
    (persistPublishRelayAcks as ReturnType<typeof vi.fn>).mockResolvedValue(
      undefined
    );

    // Publish-lease mocks (acquire/release use updateMany)
    (prisma.post.updateMany as ReturnType<typeof vi.fn>).mockResolvedValue({
      count: 1,
    });
    (
      prisma.longFormPost.updateMany as ReturnType<typeof vi.fn>
    ).mockResolvedValue({
      count: 1,
    });

    // Set up default mockImplementation for post.findUnique that uses state map
    (prisma.post.findUnique as ReturnType<typeof vi.fn>).mockImplementation(
      // eslint-disable-next-line @typescript-eslint/no-misused-promises -- Mock implementation needs to be async
      async (
        args:
          | { where: { id: string; userId?: string } }
          | { where: { id: string } }
      ) => {
        const postId = args.where.id;

        const state = postStateMap.get(postId) ?? "SCHEDULED";
        return {
          id: postId,
          currentState: state,
          nostrEventId: null,
          scheduledAtUtc: new Date(),
          scheduledFor: "1234567890",
          userId: TEST_USER_ID,
          postType: "IMAGE",
        };
      }
    );

    // Set up default mockImplementation for post.update that tracks state changes
    (prisma.post.update as ReturnType<typeof vi.fn>).mockImplementation(
      // eslint-disable-next-line @typescript-eslint/no-misused-promises -- Mock implementation needs to be async
      async (args: {
        where: { id: string; userId?: string };
        data: { currentState?: string };
      }) => {
        const postId = args.where.id;
        if (args.data.currentState) {
          postStateMap.set(postId, args.data.currentState);
        }
        return {
          id: postId,
          ...args.data,
          currentState:
            args.data.currentState ?? postStateMap.get(postId) ?? "SCHEDULED",
        };
      }
    );

    // Set up default mockImplementation for longFormPost.findUnique that uses state map
    (
      prisma.longFormPost.findUnique as ReturnType<typeof vi.fn>
    ).mockImplementation(
      // eslint-disable-next-line @typescript-eslint/no-misused-promises -- Mock implementation needs to be async
      async (
        args:
          | { where: { id: string; userId?: string } }
          | { where: { id: string } }
      ) => {
        const postId = args.where.id;

        const state = longFormPostStateMap.get(postId) ?? "SCHEDULED";
        return {
          id: postId,
          currentState: state,
          nostrEventId: null,
          scheduledAtUtc: new Date(),
          scheduledFor: "1234567890",
          userId: TEST_USER_ID,
        };
      }
    );

    // Set up default mockImplementation for longFormPost.update that tracks state changes
    (prisma.longFormPost.update as ReturnType<typeof vi.fn>).mockImplementation(
      // eslint-disable-next-line @typescript-eslint/no-misused-promises -- Mock implementation needs to be async
      async (args: {
        where: { id: string; userId?: string };
        data: { currentState?: string };
      }) => {
        const postId = args.where.id;

        if (args.data.currentState) {
          longFormPostStateMap.set(postId, args.data.currentState);
        }
        return {
          id: postId,
          ...args.data,
          currentState:
            args.data.currentState ??
            longFormPostStateMap.get(postId) ??
            "SCHEDULED",
        };
      }
    );

    // Dynamically import workers after mocks
    const module = await import("~/features/posts/queues.server");
    scheduledPostsWorker =
      module.scheduledPostsWorker as unknown as MockWorkerType;
    scheduledLongFormPostsWorker =
      module.scheduledLongFormPostsWorker as unknown as MockWorkerType;
    postCheckerWorker = module.postCheckerWorker as unknown as MockWorkerType;
  });

  describe("Scheduled Posts Worker", () => {
    it("should process scheduled post successfully", async () => {
      const signedEvent = createValidSignedEvent({ content: "Test post" });
      const mockJobData = {
        postId: "post-123",
        userId: TEST_USER_ID,
        signedEvent,
      };
      const mockJob: Job = {
        data: mockJobData,
      } as unknown as Job;

      // Initialize post state
      postStateMap.set("post-123", "SCHEDULED");

      (
        resolveExecutionRelays as ReturnType<typeof vi.fn>
      ).mockResolvedValueOnce(["wss://relay1.com", "wss://relay2.com"]);
      // State transitions now use PostStateMachine, not updatePostStatus
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        status: 200,
      });

      if (!scheduledPostsWorker?.process) {
        throw new Error("scheduledPostsWorker.process is not defined");
      }
      const result = await scheduledPostsWorker.process(mockJob);

      // State transitions now use PostStateMachine, not updatePostStatus
      expect(resolveExecutionRelays).toHaveBeenCalledWith(TEST_USER_ID);
      // fetchWithRetry adds additional options (timeout, maxRetries, correlation ID, etc.)
      expect(global.fetch).toHaveBeenCalled();
      const fetchCall = (global.fetch as ReturnType<typeof vi.fn>).mock
        .calls[0];
      if (!fetchCall) {
        throw new Error("fetch was not called");
      }
      expect(fetchCall[0]).toBe("https://api.nostr-publisher.com/publish");
      const fetchOptions = fetchCall[1] as RequestInit;
      expect(fetchOptions.method).toBe("POST");
      const headers = fetchOptions.headers as
        | Record<string, string>
        | undefined;
      expect(headers?.["Content-Type"]).toBe("application/json");
      // JSON.stringify excludes Symbol(verified), so parse and check properties
      const body = JSON.parse(fetchOptions.body as string) as {
        relays: string[];
        event: { id: string; pubkey: string; kind: number; content: string };
      };
      expect(body.relays).toEqual(["wss://relay1.com", "wss://relay2.com"]);
      expect(body.event).toMatchObject({
        id: mockJobData.signedEvent.id,
        pubkey: mockJobData.signedEvent.pubkey,
        kind: mockJobData.signedEvent.kind,
        content: mockJobData.signedEvent.content,
      });
      expect(result).toEqual({ success: true, postId: "post-123" });
    });

    it("should sanitize user relays", async () => {
      const signedEvent = createValidSignedEvent();
      const mockJobData = {
        postId: "post-123",
        userId: TEST_USER_ID,
        signedEvent,
      };
      const mockJob: Job = {
        data: mockJobData,
      } as unknown as Job;

      // Sanitization happens inside relay resolution; this test verifies that the
      // worker uses the resolved relays for publishing.
      (
        resolveExecutionRelays as ReturnType<typeof vi.fn>
      ).mockResolvedValueOnce(["wss://relay1.com", "wss://relay2.com"]);
      // State transitions now use PostStateMachine, not updatePostStatus
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        status: 200,
      });

      if (!scheduledPostsWorker?.process) {
        throw new Error("scheduledPostsWorker.process is not defined");
      }
      await scheduledPostsWorker.process(mockJob);

      // fetchWithRetry adds additional options (timeout, maxRetries, correlation ID, etc.)
      expect(global.fetch).toHaveBeenCalled();
      const fetchCall = (global.fetch as ReturnType<typeof vi.fn>).mock
        .calls[0];
      if (!fetchCall) {
        throw new Error("fetch was not called");
      }
      const fetchOptions = fetchCall[1] as RequestInit;
      // JSON.stringify field order may vary, so parse and check properties
      const body = JSON.parse(fetchOptions.body as string) as {
        relays: string[];
        event: { id: string; pubkey: string; kind: number; content: string };
      };
      expect(body.relays).toEqual(["wss://relay1.com", "wss://relay2.com"]);
      expect(body.event).toMatchObject({
        id: mockJobData.signedEvent.id,
        pubkey: mockJobData.signedEvent.pubkey,
        kind: mockJobData.signedEvent.kind,
        content: mockJobData.signedEvent.content,
      });
    });

    it("should handle missing user", async () => {
      const signedEvent = createValidSignedEvent();
      const mockJobData = {
        postId: "post-123",
        userId: TEST_USER_ID,
        signedEvent,
      };
      const mockJob: Job = {
        data: mockJobData,
      } as unknown as Job;

      // Initialize post state
      postStateMap.set("post-123", "SCHEDULED");

      (
        resolveExecutionRelays as ReturnType<typeof vi.fn>
      ).mockRejectedValueOnce(new Error(`User ${TEST_USER_ID} not found`));

      if (!scheduledPostsWorker?.process) {
        throw new Error("scheduledPostsWorker.process is not defined");
      }
      await expect(scheduledPostsWorker.process(mockJob)).rejects.toThrow(
        `User ${TEST_USER_ID} not found`
      );
    });

    it("should handle empty user relays", async () => {
      const signedEvent = createValidSignedEvent();
      const mockJobData = {
        postId: "post-123",
        userId: TEST_USER_ID,
        signedEvent,
      };
      const mockJob: Job = {
        data: mockJobData,
      } as unknown as Job;

      // If the resolver returns an empty list, the publisher falls back to its own defaults.
      (
        resolveExecutionRelays as ReturnType<typeof vi.fn>
      ).mockResolvedValueOnce([]);
      // State transitions now use PostStateMachine, not updatePostStatus
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        status: 200,
      });

      if (!scheduledPostsWorker?.process) {
        throw new Error("scheduledPostsWorker.process is not defined");
      }
      await scheduledPostsWorker.process(mockJob);

      // fetchWithRetry adds additional options (timeout, maxRetries, correlation ID, etc.)
      expect(global.fetch).toHaveBeenCalled();
      const fetchCall = (global.fetch as ReturnType<typeof vi.fn>).mock
        .calls[0];
      if (!fetchCall) {
        throw new Error("fetch was not called");
      }
      const fetchOptions = fetchCall[1] as RequestInit;
      // JSON.stringify excludes Symbol(verified), so parse and check properties
      const body = JSON.parse(fetchOptions.body as string) as {
        relays: string[];
        event: { id: string; pubkey: string; kind: number; content: string };
      };
      expect([...body.relays].sort()).toEqual([...systemDefaultRelays].sort());
      expect(body.event).toMatchObject({
        id: mockJobData.signedEvent.id,
        pubkey: mockJobData.signedEvent.pubkey,
        kind: mockJobData.signedEvent.kind,
        content: mockJobData.signedEvent.content,
      });
    });

    it("should handle publisher API errors", async () => {
      const signedEvent = createValidSignedEvent();
      const mockJobData = {
        postId: "post-123",
        userId: TEST_USER_ID,
        signedEvent,
      };
      const mockJob: Job = {
        data: mockJobData,
      } as unknown as Job;

      // Initialize post state
      postStateMap.set("post-123", "SCHEDULED");

      const mockUser = {
        id: TEST_USER_ID,
        userRelays: ["wss://relay1.com"],
      };

      (getUserById as ReturnType<typeof vi.fn>).mockResolvedValue(mockUser);
      // State transitions now use PostStateMachine, not updatePostStatus
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
      });

      if (!scheduledPostsWorker?.process) {
        throw new Error("scheduledPostsWorker.process is not defined");
      }
      await expect(scheduledPostsWorker.process(mockJob)).rejects.toThrow(
        "Failed to post to nostr publisher"
      );
    });

    it("should handle fetch errors", async () => {
      const signedEvent = createValidSignedEvent();
      const mockJobData = {
        postId: "post-123",
        userId: TEST_USER_ID,
        signedEvent,
      };
      const mockJob: Job = {
        data: mockJobData,
      } as unknown as Job;

      const mockUser = {
        id: TEST_USER_ID,
        userRelays: ["wss://relay1.com"],
      };

      (getUserById as ReturnType<typeof vi.fn>).mockResolvedValue(mockUser);
      // State transitions now use PostStateMachine, not updatePostStatus
      (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error("Network error")
      );

      if (!scheduledPostsWorker?.process) {
        throw new Error("scheduledPostsWorker.process is not defined");
      }
      await expect(scheduledPostsWorker.process(mockJob)).rejects.toThrow(
        "Network error"
      );
    });
  });

  describe("Scheduled Longform Posts Worker", () => {
    it("should process scheduled longform post successfully", async () => {
      const signedEvent = createValidSignedEvent({
        kind: 30023,
        content: "Longform post",
      });
      const mockJobData = {
        postId: "longform-123",
        userId: TEST_USER_ID,
        signedEvent,
      };
      const mockJob: Job = {
        data: mockJobData,
      } as unknown as Job;

      // Initialize longform post state
      longFormPostStateMap.set("longform-123", "SCHEDULED");
      (
        resolveExecutionRelays as ReturnType<typeof vi.fn>
      ).mockResolvedValueOnce(["wss://relay1.com"]);
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        status: 200,
      });

      if (!scheduledLongFormPostsWorker?.process) {
        throw new Error("scheduledLongFormPostsWorker.process is not defined");
      }
      const result = await scheduledLongFormPostsWorker.process(mockJob);

      // State transitions now use LongFormPostStateMachine, not updateLongFormPostStatus
      expect(result).toEqual({ success: true, postId: "longform-123" });
    });

    it("should handle missing user", async () => {
      const signedEvent = createValidSignedEvent();
      const mockJobData = {
        postId: "longform-123",
        userId: TEST_USER_ID,
        signedEvent,
      };
      const mockJob: Job = {
        data: mockJobData,
      } as unknown as Job;

      (
        resolveExecutionRelays as ReturnType<typeof vi.fn>
      ).mockRejectedValueOnce(new Error(`User ${TEST_USER_ID} not found`));

      if (!scheduledLongFormPostsWorker?.process) {
        throw new Error("scheduledLongFormPostsWorker.process is not defined");
      }
      await expect(
        scheduledLongFormPostsWorker.process(mockJob)
      ).rejects.toThrow(`User ${TEST_USER_ID} not found`);
    });

    it("should handle publisher API errors", async () => {
      const signedEvent = createValidSignedEvent();
      const mockJobData = {
        postId: "longform-123",
        userId: TEST_USER_ID,
        signedEvent,
      };
      const mockJob: Job = {
        data: mockJobData,
      } as unknown as Job;

      // Initialize longform post state
      longFormPostStateMap.set("longform-123", "SCHEDULED");

      const mockUser = {
        id: TEST_USER_ID,
        userRelays: ["wss://relay1.com"],
      };

      (getUserById as ReturnType<typeof vi.fn>).mockResolvedValue(mockUser);
      // State transitions now use LongFormPostStateMachine, not updateLongFormPostStatus
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
      });

      if (!scheduledLongFormPostsWorker?.process) {
        throw new Error("scheduledLongFormPostsWorker.process is not defined");
      }
      await expect(
        scheduledLongFormPostsWorker.process(mockJob)
      ).rejects.toThrow("Failed to post to nostr publisher");
    });
  });

  describe("Post Checker Worker", () => {
    it("should check for due posts and schedule them", async () => {
      const now = Math.floor(Date.now() / 1000);
      const dueTime = now - 10; // 10 seconds ago

      const signedEvent1 = createValidSignedEvent({ content: "event-1" });
      const signedEvent2 = createValidSignedEvent({ content: "event-2" });

      // extractPostData expects scheduledAtUtc (Date); scheduledFor is ignored
      const mockPosts = [
        {
          id: "post-1",
          userId: TEST_USER_ID,
          signedEvent: signedEvent1,
          scheduledAtUtc: new Date(dueTime * 1000),
        },
        {
          id: "post-2",
          userId: TEST_USER_ID,
          signedEvent: signedEvent2,
          scheduledAtUtc: new Date((now + 100) * 1000), // Future post
        },
      ];

      // Dynamic import() type annotation needed for type reference
      // eslint-disable-next-line @typescript-eslint/consistent-type-imports -- Dynamic import requires value import
      type LongFormPostData = import("~/features/posts/types").LongFormPostData;
      const mockLongformPosts: LongFormPostData[] = [];

      (getCronDueScheduledPosts as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockPosts
      );
      (
        getCronDueScheduledLongFormPosts as ReturnType<typeof vi.fn>
      ).mockResolvedValue(mockLongformPosts);
      (enqueuePostJob as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

      if (!postCheckerWorker?.process) {
        throw new Error("postCheckerWorker.process is not defined");
      }
      const result = (await postCheckerWorker.process(
        {} as unknown as Job
      )) as { processed: number };

      expect(getCronDueScheduledPosts).toHaveBeenCalled();
      expect(getCronDueScheduledLongFormPosts).toHaveBeenCalled();
      // Only the due post (timeDiff <= 1) should be processed
      expect(result.processed).toBe(1);
    });

    it("should handle posts with missing required fields", async () => {
      const signedEvent3 = createValidSignedEvent({ content: "event-3" });
      const mockPosts = [
        {
          id: "post-1",
          userId: null, // Missing userId
          signedEvent: signedEvent3,
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
          signedEvent: signedEvent3,
          scheduledFor: null, // Missing scheduledFor
        },
      ];

      (getCronDueScheduledPosts as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockPosts
      );
      (
        getCronDueScheduledLongFormPosts as ReturnType<typeof vi.fn>
      ).mockResolvedValue([]);

      if (!postCheckerWorker?.process) {
        throw new Error("postCheckerWorker.process is not defined");
      }
      const result = await postCheckerWorker.process({} as unknown as Job);

      // Should skip posts with missing fields (extractPostData returns null for invalid posts)
      const typedResult = result as { processed: number };
      expect(typedResult.processed).toBe(0); // None processed due to missing required fields
    });

    it("should handle longform posts", async () => {
      const now = Math.floor(Date.now() / 1000);
      const dueTime = now - 10;
      const signedEvent = createValidSignedEvent({
        content: "event-1",
        kind: 30023,
      });

      // Dynamic import() type annotation needed for type reference
      // eslint-disable-next-line @typescript-eslint/consistent-type-imports -- Dynamic import requires value import
      const mockPosts: Array<import("~/features/posts/types").PostData> = [];
      const mockLongformPosts = [
        {
          id: "longform-1",
          userId: TEST_USER_ID,
          signedEvent: signedEvent,
          scheduledAtUtc: new Date(dueTime * 1000),
        },
      ];

      (getCronDueScheduledPosts as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockPosts
      );
      (
        getCronDueScheduledLongFormPosts as ReturnType<typeof vi.fn>
      ).mockResolvedValue(mockLongformPosts);

      if (!postCheckerWorker?.process) {
        throw new Error("postCheckerWorker.process is not defined");
      }
      const result = (await postCheckerWorker.process(
        {} as unknown as Job
      )) as { processed: number };

      expect(result.processed).toBe(1);
    });

    it("should handle immediate processing (timeDiff <= 0)", async () => {
      const now = Math.floor(Date.now() / 1000);
      const pastTime = now - 100; // Well in the past
      const signedEvent = createValidSignedEvent({ content: "event-1" });

      const mockPosts = [
        {
          id: "post-1",
          userId: TEST_USER_ID,
          signedEvent: signedEvent,
          scheduledAtUtc: new Date(pastTime * 1000),
        },
      ];

      (getCronDueScheduledPosts as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockPosts
      );
      (
        getCronDueScheduledLongFormPosts as ReturnType<typeof vi.fn>
      ).mockResolvedValue([]);

      if (!postCheckerWorker?.process) {
        throw new Error("postCheckerWorker.process is not defined");
      }
      const result = (await postCheckerWorker.process(
        {} as unknown as Job
      )) as { processed: number };

      expect(result.processed).toBe(1);
    });

    it("should handle database errors gracefully", async () => {
      (getCronDueScheduledPosts as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error("Database error")
      );
      (
        getCronDueScheduledLongFormPosts as ReturnType<typeof vi.fn>
      ).mockResolvedValue([]);

      if (!postCheckerWorker?.process) {
        throw new Error("postCheckerWorker.process is not defined");
      }
      await expect(
        postCheckerWorker.process({} as unknown as Job)
      ).rejects.toThrow("Database error");
    });

    it("should handle empty results", async () => {
      (getCronDueScheduledPosts as ReturnType<typeof vi.fn>).mockResolvedValue(
        []
      );
      (
        getCronDueScheduledLongFormPosts as ReturnType<typeof vi.fn>
      ).mockResolvedValue([]);

      if (!postCheckerWorker?.process) {
        throw new Error("postCheckerWorker.process is not defined");
      }
      const result = (await postCheckerWorker.process(
        {} as unknown as Job
      )) as { processed: number };

      expect(result.processed).toBe(0);
    });
  });
});
