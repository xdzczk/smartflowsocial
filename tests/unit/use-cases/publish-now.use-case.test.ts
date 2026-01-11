/**
 * Unit tests for PublishNowUseCase
 * Tests app/features/posts/use-cases/publish-now.use-case.server.ts
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock dependencies
vi.mock("~/models/post.queries.server", () => ({
  getPostById: vi.fn(),
}));

vi.mock("~/models/post.commands.server", () => ({
  updatePostStatus: vi.fn(),
}));

const mockPublish = vi.fn();
vi.mock("~/infra/publishers/nostr-publisher.server", () => ({
  getNostrPublisher: vi.fn(() => ({
    publish: mockPublish,
  })),
}));

const mockTransition = vi.fn();
vi.mock("~/features/posts/state-machine/post-state-machine.server", () => ({
  PostStateMachine: class {
    transition = mockTransition;
  },
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

import { TEST_USER_ID, TEST_POST_ID } from "../../utils/test-helpers";

import { PublishNowUseCase } from "~/features/posts/use-cases/publish-now.use-case.server";
import {
  recordPostPublished,
  recordPostPublishFailed,
} from "~/lib/metrics/business-metrics.server";
import { recordPublishLatency } from "~/lib/metrics/performance-metrics.server";
import { updatePostStatus } from "~/models/post.commands.server";
import { getPostById } from "~/models/post.queries.server";

describe("PublishNowUseCase", () => {
  let useCase: PublishNowUseCase;

  beforeEach(() => {
    vi.clearAllMocks();
    mockTransition.mockResolvedValue(undefined);
    mockPublish.mockResolvedValue(undefined);
    useCase = new PublishNowUseCase();
  });

  describe("execute", () => {
    it("should publish a post successfully", async () => {
      const mockPost = {
        id: TEST_POST_ID,
        userId: TEST_USER_ID,
        postType: "IMAGE",
        isPosted: false,
      };

      const signedEvent = {
        id: "event-123",
        pubkey: "test-pubkey",
        created_at: Math.floor(Date.now() / 1000),
        kind: 1,
        content: "test",
        tags: [],
        sig: "test-sig",
      };

      const relays = ["wss://relay1.com", "wss://relay2.com"];

      (getPostById as ReturnType<typeof vi.fn>).mockResolvedValue(mockPost);
      (updatePostStatus as ReturnType<typeof vi.fn>).mockResolvedValue(
        undefined
      );
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
      expect(updatePostStatus).toHaveBeenCalledWith({
        id: TEST_POST_ID,
        userId: TEST_USER_ID,
        isPosted: true,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- Jest expect matchers have complex types
        correlationId: expect.any(String),
      });
      expect(mockPublish).toHaveBeenCalledWith(
        signedEvent,
        relays,
        expect.any(String)
      );
      expect(mockTransition).toHaveBeenCalledWith(
        TEST_POST_ID,
        TEST_USER_ID,
        "PUBLISHED",
        "Successfully published to Nostr"
      );
      expect(recordPostPublished).toHaveBeenCalledWith("IMAGE", "immediate");
      expect(recordPublishLatency).toHaveBeenCalled();
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

    it("should throw error if post already published", async () => {
      const mockPost = {
        id: TEST_POST_ID,
        userId: TEST_USER_ID,
        postType: "IMAGE",
        isPosted: true,
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
      ).rejects.toThrow(`Post ${TEST_POST_ID} already published`);
    });

    it("should handle publish failure and transition to FAILED", async () => {
      const mockPost = {
        id: TEST_POST_ID,
        userId: TEST_USER_ID,
        postType: "TEXT",
        isPosted: false,
      };

      const signedEvent = {
        id: "event-123",
        pubkey: "test-pubkey",
        created_at: Math.floor(Date.now() / 1000),
        kind: 1,
        content: "test",
        tags: [],
        sig: "test-sig",
      };

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
        expect.stringContaining("Publish failed")
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
        isPosted: false,
      };

      const signedEvent = {
        id: "event-123",
        pubkey: "test-pubkey",
        created_at: Math.floor(Date.now() / 1000),
        kind: 1,
        content: "test",
        tags: [],
        sig: "test-sig",
      };

      (getPostById as ReturnType<typeof vi.fn>).mockResolvedValue(mockPost);
      (updatePostStatus as ReturnType<typeof vi.fn>).mockResolvedValue(
        undefined
      );
      mockPublish.mockResolvedValue(undefined);

      await useCase.execute({
        postId: TEST_POST_ID,
        userId: TEST_USER_ID,
        signedEvent,
        relays: ["wss://relay1.com"],
        correlationId: "custom-correlation-id",
      });

      expect(updatePostStatus).toHaveBeenCalledWith({
        id: TEST_POST_ID,
        userId: TEST_USER_ID,
        isPosted: true,
        correlationId: "custom-correlation-id",
      });
      expect(mockPublish).toHaveBeenCalledWith(
        signedEvent,
        ["wss://relay1.com"],
        "custom-correlation-id"
      );
    });

    it("should handle state transition failure during publish", async () => {
      const mockPost = {
        id: TEST_POST_ID,
        userId: TEST_USER_ID,
        postType: "TEXT",
        isPosted: false,
      };

      const signedEvent = {
        id: "event-123",
        pubkey: "test-pubkey",
        created_at: Math.floor(Date.now() / 1000),
        kind: 1,
        content: "test",
        tags: [],
        sig: "test-sig",
      };

      (getPostById as ReturnType<typeof vi.fn>).mockResolvedValue(mockPost);
      (updatePostStatus as ReturnType<typeof vi.fn>).mockResolvedValue(
        undefined
      );
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
