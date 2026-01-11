/**
 * Unit tests for PublishLongFormNowUseCase
 * Tests app/features/posts/use-cases/publish-longform-now.use-case.server.ts
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock dependencies
vi.mock("~/models/longformpost.server", () => ({
  getLongFormPost: vi.fn(),
  updateLongFormPostStatus: vi.fn(),
}));

const mockPublish = vi.fn();
vi.mock("~/infra/publishers/nostr-publisher.server", () => ({
  getNostrPublisher: vi.fn(() => ({
    publish: mockPublish,
  })),
}));

import { TEST_USER_ID, TEST_POST_ID } from "../../utils/test-helpers";

import { PublishLongFormNowUseCase } from "~/features/posts/use-cases/publish-longform-now.use-case.server";
import {
  getLongFormPost,
  updateLongFormPostStatus,
} from "~/models/longformpost.server";

describe("PublishLongFormNowUseCase", () => {
  let useCase: PublishLongFormNowUseCase;

  beforeEach(() => {
    vi.clearAllMocks();
    mockPublish.mockResolvedValue(undefined);
    useCase = new PublishLongFormNowUseCase();
  });

  describe("execute", () => {
    it("should publish a longform post successfully", async () => {
      const mockPost = {
        id: TEST_POST_ID,
        userId: TEST_USER_ID,
        title: "Test Title",
        isPublished: false,
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

      (getLongFormPost as ReturnType<typeof vi.fn>).mockResolvedValue(mockPost);
      (updateLongFormPostStatus as ReturnType<typeof vi.fn>).mockResolvedValue(
        undefined
      );
      mockPublish.mockResolvedValue(undefined);

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
      expect(updateLongFormPostStatus).toHaveBeenCalledWith({
        id: TEST_POST_ID,
        userId: TEST_USER_ID,
        isPublished: true,
      });
      expect(mockPublish).toHaveBeenCalledWith(signedEvent, relays, undefined);
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
        isPublished: true,
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
      ).rejects.toThrow(`Long form post ${TEST_POST_ID} already published`);
    });

    it("should use correlation ID if provided", async () => {
      const mockPost = {
        id: TEST_POST_ID,
        userId: TEST_USER_ID,
        title: "Test Title",
        isPublished: false,
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

      (getLongFormPost as ReturnType<typeof vi.fn>).mockResolvedValue(mockPost);
      (updateLongFormPostStatus as ReturnType<typeof vi.fn>).mockResolvedValue(
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

      expect(mockPublish).toHaveBeenCalledWith(
        signedEvent,
        ["wss://relay1.com"],
        "custom-correlation-id"
      );
    });

    it("should handle publish failure", async () => {
      const mockPost = {
        id: TEST_POST_ID,
        userId: TEST_USER_ID,
        title: "Test Title",
        isPublished: false,
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
