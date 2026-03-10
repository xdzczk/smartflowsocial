/**
 * Integration tests for PublishLongFormNowUseCase
 * Tests the use case with real database interactions
 *
 * Note: These tests require a test database to be set up.
 * Run with: pnpm test:db:setup && pnpm test:integration -- --grep "PublishLongFormNowUseCase"
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const { mockPublish, mockAcquireLease, mockReleaseLease } = vi.hoisted(() => {
  return {
    mockPublish: vi.fn(),
    mockAcquireLease: vi.fn().mockResolvedValue({
      lockId: "test-lock-id",
      expiresAt: new Date(Date.now() + 30_000),
    }),
    mockReleaseLease: vi.fn().mockResolvedValue(undefined),
  };
});

vi.mock("~/infra/publishers/nostr-publisher.server", () => ({
  getNostrPublisher: vi.fn(() => ({
    publish: mockPublish,
  })),
}));

vi.mock("~/infra/publishing/publish-lease.server", () => ({
  acquireLongFormPostPublishLease: mockAcquireLease,
  releaseLongFormPostPublishLease: mockReleaseLease,
}));

import { createValidSignedEvent } from "../../utils/test-helpers";

import { CreateLongFormPostUseCase } from "~/features/posts/server";
import { PublishLongFormNowUseCase } from "~/features/posts/server";
import { prisma } from "~/lib/prisma.server";

// Skip if no test database configured
const TEST_DATABASE_URL =
  process.env["TEST_DATABASE_URL"] ?? process.env["DATABASE_URL"];
const SHOULD_SKIP_DB_TESTS = process.env["SKIP_DATABASE_TESTS"] === "true";

describe.skipIf(!TEST_DATABASE_URL || SHOULD_SKIP_DB_TESTS)(
  "PublishLongFormNowUseCase Integration",
  () => {
    let userId: string;
    let useCase: PublishLongFormNowUseCase;
    const correlationId = "test-correlation-id";

    beforeEach(async () => {
      vi.clearAllMocks();
      mockPublish.mockResolvedValue({ results: [] });

      // Create a test user - use upsert to handle duplicates
      const npub = `test-${Date.now()}-${Math.random()}`;
      const user = await prisma.user.upsert({
        where: { npub },
        update: {},
        create: {
          npub,
          isEnabled: true,
        },
      });
      userId = user.id;
      useCase = new PublishLongFormNowUseCase();
    });

    afterEach(async () => {
      // Clean up test data - handle missing tables gracefully
      if (userId) {
        try {
          await prisma.longFormPost.deleteMany({
            where: { userId },
          });
        } catch {
          // Table might not exist, ignore
        }
        try {
          await prisma.user.delete({
            where: { id: userId },
          });
        } catch {
          // Ignore errors
        }
      }
    });

    it("should publish a longform post successfully", async () => {
      // Create a draft longform post
      const createUseCase = new CreateLongFormPostUseCase();
      const createResult = await createUseCase.execute({
        userId,
        title: "Test Title",
        content: "Test content",
      });

      const postId = createResult.post.id;

      // Publish the post
      const signedEvent = createValidSignedEvent({ content: "test" });

      await useCase.execute({
        postId,
        userId,
        signedEvent,
        relays: ["wss://relay.example.com"],
        correlationId,
      });

      // Verify post is published
      const publishedPost = await prisma.longFormPost.findUnique({
        where: { id: postId },
      });
      const { deriveIsPublishedLongForm } =
        await import("~/features/posts/longform/state-machine/longform-post-state");
      expect(deriveIsPublishedLongForm(publishedPost?.currentState)).toBe(true);

      // Verify publisher was called
      expect(mockPublish).toHaveBeenCalledWith(
        expect.objectContaining({
          id: signedEvent.id,
          pubkey: signedEvent.pubkey,
          sig: signedEvent.sig,
          kind: signedEvent.kind,
          created_at: signedEvent.created_at,
        }),
        ["wss://relay.example.com"],
        correlationId
      );
    });

    it("should throw error if post not found", async () => {
      await expect(
        useCase.execute({
          postId: "non-existent-post-id",
          userId,
          signedEvent: createValidSignedEvent({ content: "test" }),
          relays: ["wss://relay.example.com"],
        })
      ).rejects.toThrow("not found for user");
    });

    it("should throw error if post already published", async () => {
      // Create and publish a longform post
      const createUseCase = new CreateLongFormPostUseCase();
      const createResult = await createUseCase.execute({
        userId,
        title: "Test Title",
        content: "Test content",
      });

      const postId = createResult.post.id;

      // Publish first time
      await useCase.execute({
        postId,
        userId,
        signedEvent: createValidSignedEvent({ content: "test" }),
        relays: ["wss://relay.example.com"],
      });

      // Try to publish again (idempotent: should resolve without throwing)
      await expect(
        useCase.execute({
          postId,
          userId,
          signedEvent: createValidSignedEvent({ content: "test 2" }),
          relays: ["wss://relay.example.com"],
        })
      ).resolves.toBeUndefined();
    });
  }
);
