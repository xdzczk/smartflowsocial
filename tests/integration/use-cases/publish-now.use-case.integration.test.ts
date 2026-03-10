/**
 * Integration tests for PublishNowUseCase
 * Tests the use case with real database interactions
 *
 * Note: These tests require a test database to be set up.
 * Run with: pnpm test:db:setup && pnpm test:integration -- --grep "PublishNowUseCase"
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock Nostr publisher
const mockPublish = vi.fn();
vi.mock("~/infra/publishers/nostr-publisher.server", () => ({
  getNostrPublisher: vi.fn(() => ({
    publish: mockPublish,
  })),
}));

import { createValidSignedEvent } from "../../utils/test-helpers";

import { PublishNowUseCase } from "~/features/posts/publishing/index.server";
import { CreatePostUseCase } from "~/features/posts/server";
import { prisma } from "~/lib/prisma.server";

// Skip if no test database configured
const TEST_DATABASE_URL =
  process.env["TEST_DATABASE_URL"] ?? process.env["DATABASE_URL"];
const SHOULD_SKIP_DB_TESTS = process.env["SKIP_DATABASE_TESTS"] === "true";

describe.skipIf(!TEST_DATABASE_URL || SHOULD_SKIP_DB_TESTS)(
  "PublishNowUseCase Integration",
  () => {
    let userId: string;
    let useCase: PublishNowUseCase;

    beforeEach(async () => {
      vi.clearAllMocks();
      mockPublish.mockResolvedValue(undefined);

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
      useCase = new PublishNowUseCase();
    });

    afterEach(async () => {
      // Clean up test data - handle missing tables gracefully
      if (userId) {
        try {
          await prisma.postStateTransition.deleteMany({
            where: { post: { userId } },
          });
        } catch {
          // Table might not exist, ignore
        }
        try {
          await prisma.post.deleteMany({
            where: { userId },
          });
        } catch {
          // Ignore errors
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

    it("should publish a post successfully", async () => {
      // Create a draft post
      const createUseCase = new CreatePostUseCase();
      const createResult = await createUseCase.execute({
        userId,
        content: "Test post",
        fileUrl: [],
        postType: "TEXT",
        isRecyclable: false,
      });

      const postId = createResult.post.id;

      // Publish the post
      const signedEvent = createValidSignedEvent({ content: "test" });

      await useCase.execute({
        postId,
        userId,
        signedEvent,
        relays: ["wss://relay.example.com"],
      });

      // Verify post is published
      const publishedPost = await prisma.post.findUnique({
        where: { id: postId },
      });
      const { deriveIsPublished } =
        await import("~/features/posts/state-machine/post-state");
      expect(deriveIsPublished(publishedPost?.currentState)).toBe(true);
      expect(publishedPost?.currentState).toBe("PUBLISHED");

      // Verify state transitions
      const transitions = await prisma.postStateTransition.findMany({
        where: { postId },
        orderBy: { createdAt: "asc" },
      });
      expect(transitions.length).toBeGreaterThanOrEqual(2);
      const states = transitions.map((t) => t.toState);
      expect(states).toContain("PUBLISHING");
      expect(states).toContain("PUBLISHED");

      // Verify publisher was called
      // finalizeEvent adds Symbol(verified), so check properties instead
      expect(mockPublish).toHaveBeenCalledWith(
        expect.objectContaining({
          id: signedEvent.id,
          pubkey: signedEvent.pubkey,
          kind: signedEvent.kind,
          content: signedEvent.content,
        }),
        ["wss://relay.example.com"],
        expect.any(String)
      );
    });

    it("should throw error if post not found", async () => {
      await expect(
        useCase.execute({
          postId: "non-existent-post-id",
          userId,
          signedEvent: {
            id: "test-event-id",
            pubkey: "test-pubkey",
            created_at: Math.floor(Date.now() / 1000),
            kind: 1,
            content: "test",
            tags: [],
            sig: "test-sig",
          },
          relays: ["wss://relay.example.com"],
        })
      ).rejects.toThrow("not found for user");
    });

    it("should throw error if post already published", async () => {
      // Create and publish a post
      const createUseCase = new CreatePostUseCase();
      const createResult = await createUseCase.execute({
        userId,
        content: "Test post",
        fileUrl: [],
        postType: "TEXT",
        isRecyclable: false,
      });

      const postId = createResult.post.id;

      // Publish first time
      const firstSignedEvent = createValidSignedEvent({ content: "test" });
      await useCase.execute({
        postId,
        userId,
        signedEvent: firstSignedEvent,
        relays: ["wss://relay.example.com"],
      });

      // Try to publish again (idempotent: should resolve without throwing)
      const secondSignedEvent = createValidSignedEvent({ content: "test-2" });
      await expect(
        useCase.execute({
          postId,
          userId,
          signedEvent: secondSignedEvent,
          relays: ["wss://relay.example.com"],
        })
      ).resolves.toBeUndefined();
    });
  }
);
