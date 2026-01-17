/**
 * Integration tests for CancelScheduleUseCase
 * Tests the use case with real database interactions
 *
 * Note: These tests require a test database to be set up.
 * Run with: pnpm test:db:setup && pnpm test:integration -- --grep "CancelScheduleUseCase"
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";

import { CancelScheduleUseCase } from "~/features/posts/use-cases/cancel-schedule.use-case.server";
import { CreatePostUseCase } from "~/features/posts/use-cases/create-post.use-case.server";
import { SchedulePostUseCase } from "~/features/posts/use-cases/schedule-post.use-case.server";
import { prisma } from "~/lib/prisma.server";

// Skip if no test database configured
const TEST_DATABASE_URL =
  process.env["TEST_DATABASE_URL"] ?? process.env["DATABASE_URL"];

describe.skipIf(!TEST_DATABASE_URL)("CancelScheduleUseCase Integration", () => {
  let userId: string;
  let useCase: CancelScheduleUseCase;

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
    useCase = new CancelScheduleUseCase();
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

  it("should cancel a scheduled post and update state", async () => {
    // Create a post
    const createUseCase = new CreatePostUseCase();
    const createResult = await createUseCase.execute({
      userId,
      content: "Test post",
      fileUrl: ["https://example.com/image.jpg"],
      postType: "IMAGE",
      isRecyclable: false,
      scheduledFor: Math.floor(Date.now() / 1000) + 3600, // 1 hour from now
    });

    const postId = createResult.post.id;

    // Schedule the post
    const scheduleUseCase = new SchedulePostUseCase();
    const { fromDate } = await import("~/lib/temporal");
    const scheduledAtUtc = fromDate(new Date(Date.now() + 3600000), "UTC"); // 1 hour from now
    await scheduleUseCase.execute({
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
    const { deriveIsScheduled } =
      await import("~/features/posts/state-machine/post-state");
    expect(deriveIsScheduled(scheduledPost?.currentState)).toBe(true);
    expect(scheduledPost?.currentState).toBe("SCHEDULED");

    // Cancel the scheduled post
    const result = await useCase.execute({
      postId,
      userId,
    });

    expect(result.cancelled).toBe(true);

    // Verify post is no longer scheduled
    const cancelledPost = await prisma.post.findUnique({
      where: { id: postId },
    });
    const { deriveIsScheduled: deriveIsScheduled2 } =
      await import("~/features/posts/state-machine/post-state");
    expect(deriveIsScheduled2(cancelledPost?.currentState)).toBe(false);
    expect(cancelledPost?.currentState).toBe("CANCELLED");
    // scheduledAtUtc may be null or undefined depending on how Prisma handles it
    expect(cancelledPost?.scheduledAtUtc).toBeFalsy();

    // Verify state transition was recorded
    const transitions = await prisma.postStateTransition.findMany({
      where: { postId },
      orderBy: { createdAt: "desc" },
    });
    expect(transitions.length).toBeGreaterThan(0);
    const lastTransition = transitions[0];
    expect(lastTransition?.toState).toBe("CANCELLED");
  });

  it("should handle cancelling a post that is not scheduled", async () => {
    // Create a draft post (not scheduled)
    const createUseCase = new CreatePostUseCase();
    const createResult = await createUseCase.execute({
      userId,
      content: "Test draft post",
      fileUrl: ["https://example.com/image.jpg"],
      postType: "IMAGE",
      isRecyclable: false,
    });

    const postId = createResult.post.id;

    // Try to cancel (should return cancelled: false)
    const result = await useCase.execute({
      postId,
      userId,
    });

    expect(result.cancelled).toBe(false);
  });
});
