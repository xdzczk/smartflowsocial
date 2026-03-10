/**
 * Unit tests for PublishLongFormNowUseCase
 * Tests app/features/posts/use-cases/publish-longform-now.use-case.server.ts
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock dependencies
vi.mock("~/models/longformpost.server", () => ({
  getLongFormPost: vi.fn(),
}));

const mockPublish = vi.fn();
vi.mock("~/infra/publishers/nostr-publisher.server", () => ({
  getNostrPublisher: vi.fn(() => ({
    publish: mockPublish,
  })),
}));

const {
  mockAcquireLongFormPostPublishLease,
  mockReleaseLongFormPostPublishLease,
} = vi.hoisted(() => ({
  mockAcquireLongFormPostPublishLease: vi.fn(),
  mockReleaseLongFormPostPublishLease: vi.fn(),
}));
vi.mock("~/infra/publishing/publish-lease.server", () => ({
  acquireLongFormPostPublishLease: mockAcquireLongFormPostPublishLease,
  releaseLongFormPostPublishLease: mockReleaseLongFormPostPublishLease,
}));

vi.mock("~/lib/correlation-context.server", () => ({
  getCorrelationId: vi.fn((id) => id ?? "test-correlation-id"),
}));

const { mockPrisma } = vi.hoisted(() => {
  const mockLongFormPostUpdate = vi.fn().mockResolvedValue({});
  const mockLongFormPostStateTransitionCreate = vi.fn().mockResolvedValue({});
  const mockPrisma = {
    longFormPost: {
      findUnique: vi.fn(),
      update: mockLongFormPostUpdate,
    },
    $transaction: vi.fn((fn: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        longFormPost: { update: mockLongFormPostUpdate },
        longFormPostStateTransition: {
          create: mockLongFormPostStateTransitionCreate,
        },
      };
      return fn(tx);
    }),
  };
  return { mockPrisma };
});

vi.mock("~/lib/prisma.server", () => ({
  prisma: mockPrisma,
}));

const mockTransition = vi.fn();
vi.mock("~/features/posts/server", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    LongFormPostStateMachine: class {
      transition = mockTransition;
    },
  };
});

const { mockSendPublishSuccessNotification } = vi.hoisted(() => ({
  mockSendPublishSuccessNotification: vi.fn(),
}));
vi.mock("~/infra/notifications/push-notification.server", () => ({
  sendPublishSuccessNotification: mockSendPublishSuccessNotification,
}));

import { createValidSignedEvent } from "../../utils/nostr-test-helpers";
import { TEST_USER_ID, TEST_POST_ID } from "../../utils/test-helpers";

import { PublishLongFormNowUseCase } from "~/features/posts/server";
import { getLongFormPost } from "~/models/longformpost.server";

describe("PublishLongFormNowUseCase", () => {
  let useCase: PublishLongFormNowUseCase;

  beforeEach(() => {
    vi.clearAllMocks();
    mockPublish.mockResolvedValue({ results: [] });
    mockTransition.mockResolvedValue(undefined);
    mockAcquireLongFormPostPublishLease.mockResolvedValue({
      lockId: "test-lock-id",
      expiresAt: new Date(Date.now() + 30_000),
    });
    (
      mockPrisma.longFormPost.findUnique as ReturnType<typeof vi.fn>
    ).mockResolvedValue({
      id: TEST_POST_ID,
      userId: TEST_USER_ID,
      currentState: "DRAFT",
    });
    useCase = new PublishLongFormNowUseCase();
  });

  describe("execute", () => {
    it("should publish a longform post successfully", async () => {
      const mockPost = {
        id: TEST_POST_ID,
        userId: TEST_USER_ID,
        title: "Test Title",
        queueType: { name: "Longform Queue" },
        currentState: "DRAFT",
      };

      const signedEvent = createValidSignedEvent({ content: "test" });

      const relays = ["wss://relay1.com", "wss://relay2.com"];

      (getLongFormPost as ReturnType<typeof vi.fn>).mockResolvedValue(mockPost);
      mockPublish.mockResolvedValue({ results: [] });

      await useCase.execute({
        postId: TEST_POST_ID,
        userId: TEST_USER_ID,
        signedEvent,
        relays,
      });

      expect(getLongFormPost).toHaveBeenCalledWith({
        id: TEST_POST_ID,
        userId: TEST_USER_ID,
      });
      // State transitions now use LongFormPostStateMachine, not updateLongFormPostStatus
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
      expect(mockSendPublishSuccessNotification).toHaveBeenCalledWith(
        TEST_USER_ID,
        TEST_POST_ID,
        expect.any(String),
        {
          isLongForm: true,
          source: "immediate",
          queueName: "Longform Queue",
        }
      );
    });

    it("should throw error if post not found", async () => {
      (getLongFormPost as ReturnType<typeof vi.fn>).mockResolvedValue(null);

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
        `Long form post ${TEST_POST_ID} not found for user ${TEST_USER_ID}`
      );
    });

    it("should throw error if post already published", async () => {
      const mockPost = {
        id: TEST_POST_ID,
        userId: TEST_USER_ID,
        title: "Test Title",
        currentState: "PUBLISHED",
      };

      (getLongFormPost as ReturnType<typeof vi.fn>).mockResolvedValue(mockPost);

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

    it("should use correlation ID if provided", async () => {
      const mockPost = {
        id: TEST_POST_ID,
        userId: TEST_USER_ID,
        title: "Test Title",
        currentState: "DRAFT",
      };

      const signedEvent = createValidSignedEvent({ content: "test" });

      (getLongFormPost as ReturnType<typeof vi.fn>).mockResolvedValue(mockPost);
      mockPublish.mockResolvedValue({ results: [] });

      await useCase.execute({
        postId: TEST_POST_ID,
        userId: TEST_USER_ID,
        signedEvent,
        relays: ["wss://relay1.com"],
        correlationId: "custom-correlation-id",
      });

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

    it("should handle publish failure", async () => {
      const mockPost = {
        id: TEST_POST_ID,
        userId: TEST_USER_ID,
        title: "Test Title",
        currentState: "DRAFT",
      };

      const signedEvent = createValidSignedEvent({ content: "test" });

      const publishError = new Error("Publish failed");

      (getLongFormPost as ReturnType<typeof vi.fn>).mockResolvedValue(mockPost);
      mockPublish.mockRejectedValue(publishError);

      await expect(
        useCase.execute({
          postId: TEST_POST_ID,
          userId: TEST_USER_ID,
          signedEvent,
          relays: ["wss://relay1.com"],
        })
      ).rejects.toThrow("Publish failed");
    });
  });
});
