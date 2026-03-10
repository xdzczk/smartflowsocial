/**
 * Unit tests for PublishNowUseCase
 * Tests app/features/posts/use-cases/publish-now.use-case.server.ts
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock dependencies
vi.mock("~/models/post.queries.server", () => ({
  getPostById: vi.fn(),
}));

// updatePostStatus was removed - state transitions now use PostStateMachine
vi.mock("~/models/post.commands.server", () => ({}));

const mockPublish = vi.fn();
vi.mock("~/infra/publishers/nostr-publisher.server", () => ({
  getNostrPublisher: vi.fn(() => ({
    publish: mockPublish,
  })),
}));

const { mockAcquirePostPublishLease, mockReleasePostPublishLease } = vi.hoisted(
  () => ({
    mockAcquirePostPublishLease: vi.fn(),
    mockReleasePostPublishLease: vi.fn(),
  })
);
vi.mock("~/infra/publishing/publish-lease.server", () => ({
  acquirePostPublishLease: mockAcquirePostPublishLease,
  releasePostPublishLease: mockReleasePostPublishLease,
}));

const mockTransition = vi.fn();
vi.mock("~/features/posts/state-machine/post-state-machine.server", () => ({
  PostStateMachine: class {
    transition = mockTransition;
  },
}));

const { mockSendPublishSuccessNotification } = vi.hoisted(() => ({
  mockSendPublishSuccessNotification: vi.fn(),
}));
vi.mock("~/infra/notifications/push-notification.server", () => ({
  sendPublishSuccessNotification: mockSendPublishSuccessNotification,
}));

vi.mock("~/lib/correlation-context.server", () => ({
  getCorrelationId: vi.fn((id) => id ?? "test-correlation-id"),
}));

vi.mock("~/lib/error-logger.server", () => ({
  logInfo: vi.fn(),
  logError: vi.fn(),
}));

vi.mock("~/lib/metrics/business-metrics.server", () => ({
  recordPostPublished: vi.fn(),
  recordPostPublishFailed: vi.fn(),
}));

vi.mock("~/lib/metrics/performance-metrics.server", () => ({
  recordPublishLatency: vi.fn(),
}));

import {
  TEST_USER_ID,
  TEST_POST_ID,
  createValidSignedEvent,
} from "../../utils/test-helpers";

import { PublishNowUseCase } from "~/features/posts/publishing/index.server";
import {
  recordPostPublished,
  recordPostPublishFailed,
} from "~/lib/metrics/business-metrics.server";
import { recordPublishLatency } from "~/lib/metrics/performance-metrics.server";
import { getPostById } from "~/models/post.queries.server";

describe("PublishNowUseCase", () => {
  let useCase: PublishNowUseCase;

  beforeEach(() => {
    vi.clearAllMocks();
    mockTransition.mockResolvedValue(undefined);
    mockPublish.mockResolvedValue({ results: [] });
    mockAcquirePostPublishLease.mockResolvedValue({
      lockId: "test-lock-id",
      expiresAt: new Date(Date.now() + 30_000),
    });
    useCase = new PublishNowUseCase();
  });

  describe("execute", () => {
    it("should publish a post successfully", async () => {
      const mockPost = {
        id: TEST_POST_ID,
        userId: TEST_USER_ID,
        postType: "IMAGE",
        postKind: "POST",
        queueType: { name: "Growth Queue" },
        currentState: "DRAFT",
      };

      const signedEvent = createValidSignedEvent({ content: "test" });

      const relays = ["wss://relay1.com", "wss://relay2.com"];

      (getPostById as ReturnType<typeof vi.fn>).mockResolvedValue(mockPost);
      // State transitions now use PostStateMachine, not updatePostStatus
      mockPublish.mockResolvedValue(undefined);

      await useCase.execute({
        postId: TEST_POST_ID,
        userId: TEST_USER_ID,
        signedEvent,
        relays,
      });

      expect(getPostById).toHaveBeenCalledWith({
        id: TEST_POST_ID,
        userId: TEST_USER_ID,
      });
      expect(mockTransition).toHaveBeenCalledWith(
        TEST_POST_ID,
        TEST_USER_ID,
        "PUBLISHING",
        "Publishing post immediately"
      );
      // State transitions now use PostStateMachine, not updatePostStatus
      // finalizeEvent adds Symbol(verified) property, so check specific properties
      expect(mockPublish).toHaveBeenCalledWith(
        expect.objectContaining({
          id: signedEvent.id,
          pubkey: signedEvent.pubkey,
          kind: signedEvent.kind,
          content: signedEvent.content,
        }),
        relays,
        expect.any(String)
      );
      expect(mockTransition).toHaveBeenCalledWith(
        TEST_POST_ID,
        TEST_USER_ID,
        "PUBLISHED",
        "Successfully published to Nostr",
        expect.objectContaining({
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- Jest expect matchers have complex types
          additionalPostData: expect.objectContaining({
            nostrEventId: signedEvent.id,
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- Jest expect matchers have complex types
            publishAttemptId: expect.any(String),
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- Jest expect matchers have complex types
            publishedAt: expect.any(Date),
            publishingLockId: null,
            publishingLockExpiresAt: null,
          }),
        })
      );
      expect(recordPostPublished).toHaveBeenCalledWith("IMAGE", "immediate");
      expect(recordPublishLatency).toHaveBeenCalled();
      expect(mockSendPublishSuccessNotification).toHaveBeenCalledWith(
        TEST_USER_ID,
        TEST_POST_ID,
        expect.any(String),
        {
          isLongForm: false,
          source: "immediate",
          postKind: "POST",
          queueName: null,
        }
      );
    });

    it("should throw error if post not found", async () => {
      (getPostById as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      await expect(
        useCase.execute({
          postId: TEST_POST_ID,
          userId: TEST_USER_ID,
          signedEvent: {
            id: "event-123",
            pubkey: "test-pubkey",
            created_at: Math.floor(Date.now() / 1000),
            kind: 1,
            content: "test",
            tags: [],
            sig: "test-sig",
          },
          relays: ["wss://relay1.com"],
        })
      ).rejects.toThrow(
        `Post ${TEST_POST_ID} not found for user ${TEST_USER_ID}`
      );
    });

    it("should return without throwing when post already published (idempotent)", async () => {
      const mockPost = {
        id: TEST_POST_ID,
        userId: TEST_USER_ID,
        postType: "IMAGE",
        currentState: "PUBLISHED",
      };

      (getPostById as ReturnType<typeof vi.fn>).mockResolvedValue(mockPost);

      await expect(
        useCase.execute({
          postId: TEST_POST_ID,
          userId: TEST_USER_ID,
          signedEvent: {
            id: "event-123",
            pubkey: "test-pubkey",
            created_at: Math.floor(Date.now() / 1000),
            kind: 1,
            content: "test",
            tags: [],
            sig: "test-sig",
          },
          relays: ["wss://relay1.com"],
        })
      ).resolves.toBeUndefined();

      expect(mockPublish).not.toHaveBeenCalled();
    });

    it("should handle publish failure and transition to FAILED", async () => {
      const mockPost = {
        id: TEST_POST_ID,
        userId: TEST_USER_ID,
        postType: "TEXT",
        currentState: "DRAFT",
      };

      const signedEvent = createValidSignedEvent({ content: "test" });

      const publishError = new Error("Publish failed");

      (getPostById as ReturnType<typeof vi.fn>).mockResolvedValue(mockPost);
      mockPublish.mockRejectedValue(publishError);

      await expect(
        useCase.execute({
          postId: TEST_POST_ID,
          userId: TEST_USER_ID,
          signedEvent,
          relays: ["wss://relay1.com"],
        })
      ).rejects.toThrow("Publish failed");

      expect(mockTransition).toHaveBeenCalledWith(
        TEST_POST_ID,
        TEST_USER_ID,
        "FAILED",
        expect.stringContaining("Publish failed"),
        expect.objectContaining({
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- Jest expect matchers have complex types
          additionalPostData: expect.objectContaining({
            publishingLockId: null,
            publishingLockExpiresAt: null,
          }),
        })
      );
      expect(recordPostPublishFailed).toHaveBeenCalledWith(
        "TEXT",
        "immediate",
        "Error"
      );
      expect(recordPublishLatency).toHaveBeenCalled();
    });

    it("should use correlation ID if provided", async () => {
      const mockPost = {
        id: TEST_POST_ID,
        userId: TEST_USER_ID,
        postType: "IMAGE",
        currentState: "DRAFT",
      };

      const signedEvent = createValidSignedEvent({ content: "test" });

      (getPostById as ReturnType<typeof vi.fn>).mockResolvedValue(mockPost);
      // State transitions now use PostStateMachine, not updatePostStatus
      mockPublish.mockResolvedValue(undefined);

      await useCase.execute({
        postId: TEST_POST_ID,
        userId: TEST_USER_ID,
        signedEvent,
        relays: ["wss://relay1.com"],
        correlationId: "custom-correlation-id",
      });

      // State transitions now use PostStateMachine, not updatePostStatus
      // finalizeEvent adds Symbol(verified) property, so we check the call with expect.any(Object)
      expect(mockPublish).toHaveBeenCalledWith(
        expect.objectContaining({
          id: signedEvent.id,
          pubkey: signedEvent.pubkey,
          kind: signedEvent.kind,
          content: signedEvent.content,
        }),
        ["wss://relay1.com"],
        "custom-correlation-id"
      );
    });

    it("should handle state transition failure during publish", async () => {
      const mockPost = {
        id: TEST_POST_ID,
        userId: TEST_USER_ID,
        postType: "TEXT",
        currentState: "DRAFT",
      };

      const signedEvent = createValidSignedEvent({ content: "test" });

      (getPostById as ReturnType<typeof vi.fn>).mockResolvedValue(mockPost);
      // State transitions now use PostStateMachine, not updatePostStatus
      mockPublish.mockResolvedValue(undefined);
      mockTransition
        .mockResolvedValueOnce(undefined) // PUBLISHING transition succeeds
        .mockRejectedValueOnce(new Error("State transition failed")); // PUBLISHED transition fails

      await expect(
        useCase.execute({
          postId: TEST_POST_ID,
          userId: TEST_USER_ID,
          signedEvent,
          relays: ["wss://relay1.com"],
        })
      ).rejects.toThrow("State transition failed");
    });
  });
});
