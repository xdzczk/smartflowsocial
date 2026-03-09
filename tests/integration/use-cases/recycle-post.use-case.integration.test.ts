/**
 * Integration tests for RecyclePostUseCase
 * Tests the use case with real database interactions
 *
 * Note: These tests require a test database to be set up.
 * Run with: pnpm test:db:setup && pnpm test:integration -- --grep "RecyclePostUseCase"
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock global fetch for Nostr publisher
global.fetch = vi.fn();

import { createValidSignedEvent } from "../../utils/test-helpers";

import {
  PublishNowUseCase,
  RecyclePostUseCase,
} from "~/features/posts/publishing/index.server";
import { CreatePostUseCase } from "~/features/posts/server";
import { prisma } from "~/lib/prisma.server";

// Skip if no test database configured
const TEST_DATABASE_URL =
  process.env["TEST_DATABASE_URL"] ?? process.env["DATABASE_URL"];
const SHOULD_SKIP_DB_TESTS = process.env["SKIP_DATABASE_TESTS"] === "true";

describe.skipIf(!TEST_DATABASE_URL || SHOULD_SKIP_DB_TESTS)(
  "RecyclePostUseCase Integration",
  () => {
    let userId: string;
    let useCase: RecyclePostUseCase;

    beforeEach(async () => {
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
      useCase = new RecyclePostUseCase();

      // Mock fetch for Nostr publisher
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- Test mock needs type assertion
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        status: 200,
        statusText: "OK",
      } as Response);
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

    it("should recycle a published post without scheduling", async () => {
      // Create and publish a recyclable post
      const createUseCase = new CreatePostUseCase();
      const createResult = await createUseCase.execute({
        userId,
        content: "Original post content",
        caption: "Original caption",
        fileUrl: ["https://example.com/image.jpg"],
        postType: "IMAGE",
        isRecyclable: true,
      });

      const originalPostId = createResult.post.id;

      // Publish the post
      const publishUseCase = new PublishNowUseCase();
      await publishUseCase.execute({
        postId: originalPostId,
        userId,
        signedEvent: createValidSignedEvent({ content: "test" }),
        relays: ["wss://relay.example.com"],
      });

      // Verify original post is published and recyclable
      const originalPost = await prisma.post.findUnique({
        where: { id: originalPostId },
      });
      const { deriveIsPublished } =
        await import("~/features/posts/state-machine/post-state");
      expect(deriveIsPublished(originalPost?.currentState)).toBe(true);
      expect(originalPost?.isRecyclable).toBe(true);

      // Recycle the post
      const result = await useCase.execute({
        originalPostId,
        userId,
      });

      expect(result.newPostId).toBeDefined();
      expect(result.scheduled).toBe(false);

      // Verify new post was created
      const newPost = await prisma.post.findUnique({
        where: { id: result.newPostId },
      });
      expect(newPost).toBeDefined();
      expect(newPost?.userId).toBe(userId);
      const { deriveIsPublished: deriveIsPublished2 } =
        await import("~/features/posts/state-machine/post-state");
      expect(deriveIsPublished2(newPost?.currentState)).toBe(false);
      expect(newPost?.isRecyclable).toBe(true); // Inherited from original

      // Verify original post is marked as non-recyclable
      const updatedOriginalPost = await prisma.post.findUnique({
        where: { id: originalPostId },
      });
      expect(updatedOriginalPost?.isRecyclable).toBe(false);
    });

    it("should recycle a post with scheduling", async () => {
      // Create and publish a recyclable post
      const createUseCase = new CreatePostUseCase();
      const createResult = await createUseCase.execute({
        userId,
        content: "Original post content",
        fileUrl: ["https://example.com/image.jpg"],
        postType: "IMAGE",
        isRecyclable: true,
      });

      const originalPostId = createResult.post.id;

      // Publish the post
      const publishUseCase = new PublishNowUseCase();
      await publishUseCase.execute({
        postId: originalPostId,
        userId,
        signedEvent: createValidSignedEvent({ content: "test" }),
        relays: ["wss://relay.example.com"],
      });

      // Recycle with scheduling
      const scheduledFor = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now
      const result = await useCase.execute({
        originalPostId,
        userId,
        scheduledFor,
      });

      expect(result.newPostId).toBeDefined();
      expect(result.scheduled).toBe(true);

      // Verify new post is scheduled
      const newPost = await prisma.post.findUnique({
        where: { id: result.newPostId },
      });
      const { deriveIsScheduled } =
        await import("~/features/posts/state-machine/post-state");
      expect(deriveIsScheduled(newPost?.currentState)).toBe(true);
      expect(newPost?.currentState).toBe("SCHEDULED");
    });

    it("should prevent recycling a non-recyclable post", async () => {
      // Create and publish a non-recyclable post
      const createUseCase = new CreatePostUseCase();
      const createResult = await createUseCase.execute({
        userId,
        content: "Non-recyclable post",
        fileUrl: ["https://example.com/image.jpg"],
        postType: "IMAGE",
        isRecyclable: false,
      });

      const originalPostId = createResult.post.id;

      // Publish the post
      const publishUseCase = new PublishNowUseCase();
      await publishUseCase.execute({
        postId: originalPostId,
        userId,
        signedEvent: createValidSignedEvent({ content: "test" }),
        relays: ["wss://relay.example.com"],
      });

      // Try to recycle (should fail)
      await expect(
        useCase.execute({
          originalPostId,
          userId,
        })
      ).rejects.toThrow("is not marked as recyclable");
    });

    it("should prevent recycling an unpublished post", async () => {
      // Create a draft post (not published)
      const createUseCase = new CreatePostUseCase();
      const createResult = await createUseCase.execute({
        userId,
        content: "Draft post",
        fileUrl: ["https://example.com/image.jpg"],
        postType: "IMAGE",
        isRecyclable: true,
      });

      const originalPostId = createResult.post.id;

      // Try to recycle (should fail)
      await expect(
        useCase.execute({
          originalPostId,
          userId,
        })
      ).rejects.toThrow("must be published before recycling");
    });

    it("should use idempotency to prevent duplicate recycling", async () => {
      // Create and publish a recyclable post
      const createUseCase = new CreatePostUseCase();
      const createResult = await createUseCase.execute({
        userId,
        content: "Original post",
        fileUrl: ["https://example.com/image.jpg"],
        postType: "IMAGE",
        isRecyclable: true,
      });

      const originalPostId = createResult.post.id;

      // Publish the post
      const publishUseCase = new PublishNowUseCase();
      await publishUseCase.execute({
        postId: originalPostId,
        userId,
        signedEvent: createValidSignedEvent({ content: "test" }),
        relays: ["wss://relay.example.com"],
      });

      const scheduledFor = Math.floor(Date.now() / 1000) + 3600;

      // Recycle first time
      const result1 = await useCase.execute({
        originalPostId,
        userId,
        scheduledFor,
      });

      // Try to recycle again with same schedule (should return existing post)
      const result2 = await useCase.execute({
        originalPostId,
        userId,
        scheduledFor,
      });

      expect(result1.newPostId).toBe(result2.newPostId);
    });
  }
);
