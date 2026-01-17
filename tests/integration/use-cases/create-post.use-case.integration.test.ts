/**
 * Integration tests for CreatePostUseCase
 * Tests the use case with real database interactions
 *
 * Note: These tests require a test database to be set up.
 * Run with: pnpm test:db:setup && pnpm test:integration -- --grep "CreatePostUseCase"
 */

import { describe, it, expect, beforeEach, afterEach, beforeAll } from "vitest";

import { setupTestDatabase } from "../../database/test-db";

import { CreatePostUseCase } from "~/features/posts/use-cases/create-post.use-case.server";
import { prisma } from "~/lib/prisma.server";

// Skip if no test database configured
const TEST_DATABASE_URL =
  process.env["TEST_DATABASE_URL"] ?? process.env["DATABASE_URL"];

describe.skipIf(!TEST_DATABASE_URL)("CreatePostUseCase Integration", () => {
  // Setup database before all tests in this suite
  beforeAll(async () => {
    await setupTestDatabase();
  });
  let userId: string;
  let useCase: CreatePostUseCase;

  beforeEach(async () => {
    // Create a test user with unique identifier to avoid race conditions
    const uniqueId = `${Date.now()}-${Math.random()}`;
    const user = await prisma.user.create({
      data: {
        npub: `test-${uniqueId}`,
        isEnabled: true,
      },
    });
    userId = user.id;
    useCase = new CreatePostUseCase();
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

  it("should create a draft post successfully", async () => {
    const result = await useCase.execute({
      userId,
      content: "Test draft post",
      fileUrl: [],
      postType: "TEXT",
      isRecyclable: false,
    });

    expect(result.post).toBeDefined();
    expect(result.post.userId).toBe(userId);
    expect(result.post.content).toBe("Test draft post");
    expect(result.post.postType).toBe("TEXT");
    const { deriveIsScheduled, deriveIsPosted } =
      await import("~/features/posts/state-machine/post-state");
    expect(deriveIsScheduled(result.post.currentState)).toBe(false);
    expect(deriveIsPosted(result.post.currentState)).toBe(false);
    expect(result.needsScheduling).toBe(false);

    // Verify state transition
    const transitions = await prisma.postStateTransition.findMany({
      where: { postId: result.post.id },
      orderBy: { createdAt: "desc" },
    });
    expect(transitions.length).toBeGreaterThan(0);
    expect(transitions[0]?.toState).toBe("DRAFT");
  });

  it("should create a scheduled post successfully", async () => {
    const scheduledFor = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now

    const result = await useCase.execute({
      userId,
      content: "Test scheduled post",
      fileUrl: ["https://example.com/image.jpg"],
      postType: "IMAGE",
      isRecyclable: false,
      scheduledFor,
    });

    expect(result.post).toBeDefined();
    expect(result.post.userId).toBe(userId);
    const { deriveIsScheduled } =
      await import("~/features/posts/state-machine/post-state");
    expect(deriveIsScheduled(result.post.currentState)).toBe(true);
    expect(result.needsScheduling).toBe(true);

    // Verify state transition
    const transitions = await prisma.postStateTransition.findMany({
      where: { postId: result.post.id },
      orderBy: { createdAt: "desc" },
    });
    expect(transitions.length).toBeGreaterThan(0);
    expect(transitions[0]?.toState).toBe("SCHEDULED");

    // Outbox event is only created when signedEvent is provided
    // Since this test doesn't provide a signedEvent, no outbox event should be created
    const outboxEvents = await prisma.outboxEvent.findMany({
      where: {
        aggregateId: result.post.id,
        eventType: "POST_SCHEDULED",
      },
    });
    expect(outboxEvents.length).toBe(0);
  });

  it("should return existing post if idempotency key matches", async () => {
    const scheduledFor = Math.floor(Date.now() / 1000) + 3600;

    // Create first post
    const result1 = await useCase.execute({
      userId,
      content: "Test post",
      fileUrl: [],
      postType: "TEXT",
      isRecyclable: false,
      scheduledFor,
    });

    // Try to create same post again (should return existing)
    const result2 = await useCase.execute({
      userId,
      content: "Test post",
      fileUrl: [],
      postType: "TEXT",
      isRecyclable: false,
      scheduledFor,
    });

    expect(result1.post.id).toBe(result2.post.id);

    // Verify only one post was created
    const posts = await prisma.post.findMany({
      where: { userId },
    });
    expect(posts.length).toBe(1);
  });

  it("should apply hashtags when showHashTagsinPosts is true", async () => {
    const result = await useCase.execute({
      userId,
      content: "Test content",
      fileUrl: [],
      postType: "TEXT",
      isRecyclable: false,
      hashTagPresetTags: "#hashtag1 #hashtag2",
      showHashTagsinPosts: true,
    });

    expect(result.post.content).toContain("#hashtag1");
    expect(result.post.content).toContain("#hashtag2");
  });

  it("should not apply hashtags when showHashTagsinPosts is false", async () => {
    const result = await useCase.execute({
      userId,
      content: "Test content",
      fileUrl: [],
      postType: "TEXT",
      isRecyclable: false,
      hashTagPresetTags: "#hashtag1 #hashtag2",
      showHashTagsinPosts: false,
    });

    expect(result.post.content).toBe("Test content");
    expect(result.post.content).not.toContain("#hashtag1");
  });
});
