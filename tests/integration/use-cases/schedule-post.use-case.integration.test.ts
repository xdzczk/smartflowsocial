/**
 * Integration tests for SchedulePostUseCase
 * Tests the use case with real database interactions
 *
 * Note: These tests require a test database to be set up.
 * Run with: pnpm test:db:setup && pnpm test:integration -- --grep "SchedulePostUseCase"
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";

import { CreatePostUseCase } from "~/features/posts/use-cases/create-post.use-case.server";
import { SchedulePostUseCase } from "~/features/posts/use-cases/schedule-post.use-case.server";
import { prisma } from "~/lib/prisma.server";

// Skip if no test database configured
const TEST_DATABASE_URL =
  process.env["TEST_DATABASE_URL"] ?? process.env["DATABASE_URL"];

describe.skipIf(!TEST_DATABASE_URL)("SchedulePostUseCase Integration", () => {
  let userId: string;
  let useCase: SchedulePostUseCase;

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
    useCase = new SchedulePostUseCase();
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
        const posts = await prisma.post.findMany({
          where: { userId },
          select: { id: true },
        });
        if (posts.length > 0) {
          await prisma.outboxEvent.deleteMany({
            where: {
              aggregateId: { in: posts.map((p) => p.id) },
            },
          });
        }
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

  it("should schedule a post successfully", async () => {
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

    // Schedule the post
    const scheduledAtUtc = new Date(Date.now() + 3600000); // 1 hour from now
    await useCase.execute({
      postId,
      userId,
      scheduledAtUtc,
      signedEvent: {
        id: "test-event-id",
        pubkey: "test-pubkey",
        created_at: Math.floor(Date.now() / 1000),
        kind: 1,
        content: "test",
        tags: [],
        sig: "test-sig",
      },
    });

    // Verify post is scheduled
    const scheduledPost = await prisma.post.findUnique({
      where: { id: postId },
    });
    expect(scheduledPost?.isScheduled).toBe(true);
    expect(scheduledPost?.scheduledAtUtc).toEqual(scheduledAtUtc);
    expect(scheduledPost?.currentState).toBe("SCHEDULED");

    // Verify outbox event was created
    const outboxEvents = await prisma.outboxEvent.findMany({
      where: {
        aggregateId: postId,
        eventType: "POST_SCHEDULED",
      },
    });
    expect(outboxEvents.length).toBe(1);

    // Verify state transition
    const transitions = await prisma.postStateTransition.findMany({
      where: { postId },
      orderBy: { createdAt: "desc" },
    });
    expect(transitions.length).toBeGreaterThan(0);
    const lastTransition = transitions[0];
    expect(lastTransition?.toState).toBe("SCHEDULED");
  });

  it("should throw error if post not found", async () => {
    await expect(
      useCase.execute({
        postId: "non-existent-post-id",
        userId,
        scheduledAtUtc: new Date(),
        signedEvent: {
          id: "test-event-id",
          pubkey: "test-pubkey",
          created_at: Math.floor(Date.now() / 1000),
          kind: 1,
          content: "test",
          tags: [],
          sig: "test-sig",
        },
      })
    ).rejects.toThrow("not found for user");
  });
});
