/**
 * Integration tests for PostStateMachine
 * Tests the state machine with real database interactions
 *
 * Note: These tests require a test database to be set up.
 * Run with: pnpm test:db:setup && pnpm test:integration -- --grep "PostStateMachine"
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

import { createValidSignedEvent } from "../../utils/test-helpers";

import { PostStateMachine } from "~/features/posts/state-machine/post-state-machine.server";
import { CreatePostUseCase } from "~/features/posts/use-cases/create-post.use-case.server";
import { PublishNowUseCase } from "~/features/posts/use-cases/publish-now.use-case.server";
import { prisma } from "~/lib/prisma.server";

// Mock Nostr publisher
vi.mock("~/infra/publishers/nostr-publisher.server", () => ({
  getNostrPublisher: vi.fn(() => ({
    publish: vi.fn(() =>
      Promise.resolve({ ok: true, status: 200, statusText: "OK" })
    ),
  })),
}));

// Skip if no test database configured
const TEST_DATABASE_URL =
  process.env["TEST_DATABASE_URL"] ?? process.env["DATABASE_URL"];

describe.skipIf(!TEST_DATABASE_URL)("PostStateMachine Integration", () => {
  let userId: string;
  let stateMachine: PostStateMachine;

  beforeEach(async () => {
    // Create a test user
    const user = await prisma.user.create({
      data: {
        npub: `test-${Date.now()}`,
        isEnabled: true,
      },
    });
    userId = user.id;
    stateMachine = new PostStateMachine();
  });

  afterEach(async () => {
    // Clean up test data
    await prisma.postStateTransition.deleteMany({
      where: { post: { userId } },
    });
    await prisma.post.deleteMany({
      where: { userId },
    });
    await prisma.user.delete({
      where: { id: userId },
    });
  });

  describe("transition", () => {
    it("should transition a post from DRAFT to SCHEDULED", async () => {
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

      // Transition to SCHEDULED
      await stateMachine.transition(
        postId,
        userId,
        "SCHEDULED",
        "Post scheduled for later"
      );

      // Verify post state updated
      const post = await prisma.post.findUnique({
        where: { id: postId },
      });
      expect(post?.currentState).toBe("SCHEDULED");

      // Verify transition recorded
      const transitions = await prisma.postStateTransition.findMany({
        where: { postId },
        orderBy: { createdAt: "desc" },
      });
      expect(transitions.length).toBeGreaterThan(0);
      const lastTransition = transitions[0];
      expect(lastTransition?.fromState).toBe("DRAFT");
      expect(lastTransition?.toState).toBe("SCHEDULED");
      expect(lastTransition?.reason).toBe("Post scheduled for later");
    });

    it("should transition a post through full lifecycle", async () => {
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

      // DRAFT -> SCHEDULED
      await stateMachine.transition(postId, userId, "SCHEDULED", "Scheduled");
      let post = await prisma.post.findUnique({ where: { id: postId } });
      expect(post?.currentState).toBe("SCHEDULED");

      // SCHEDULED -> PUBLISHING
      await stateMachine.transition(
        postId,
        userId,
        "PUBLISHING",
        "Starting publish"
      );
      post = await prisma.post.findUnique({ where: { id: postId } });
      expect(post?.currentState).toBe("PUBLISHING");

      // PUBLISHING -> PUBLISHED
      await stateMachine.transition(
        postId,
        userId,
        "PUBLISHED",
        "Published successfully"
      );
      post = await prisma.post.findUnique({ where: { id: postId } });
      expect(post?.currentState).toBe("PUBLISHED");

      // Verify all transitions recorded
      const transitions = await prisma.postStateTransition.findMany({
        where: { postId },
        orderBy: { createdAt: "asc" },
      });
      expect(transitions.length).toBeGreaterThanOrEqual(3);
      expect(transitions.map((t) => t.toState)).toContain("SCHEDULED");
      expect(transitions.map((t) => t.toState)).toContain("PUBLISHING");
      expect(transitions.map((t) => t.toState)).toContain("PUBLISHED");
    });

    it("should handle failed publish transition", async () => {
      // Create and schedule a post
      const createUseCase = new CreatePostUseCase();
      const createResult = await createUseCase.execute({
        userId,
        content: "Test post",
        fileUrl: [],
        postType: "TEXT",
        isRecyclable: false,
        scheduledFor: Math.floor(Date.now() / 1000) + 3600,
      });

      const postId = createResult.post.id;

      // Transition to PUBLISHING
      await stateMachine.transition(
        postId,
        userId,
        "PUBLISHING",
        "Starting publish"
      );

      // Transition to FAILED
      await stateMachine.transition(
        postId,
        userId,
        "FAILED",
        "Publish failed: Network error"
      );

      // Verify state
      const post = await prisma.post.findUnique({ where: { id: postId } });
      expect(post?.currentState).toBe("FAILED");

      // Verify can recover from FAILED
      await stateMachine.transition(postId, userId, "DRAFT", "Retry as draft");
      const recoveredPost = await prisma.post.findUnique({
        where: { id: postId },
      });
      expect(recoveredPost?.currentState).toBe("DRAFT");
    });

    it("should throw error for invalid transition", async () => {
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

      // Publish the post to get it to PUBLISHED state
      const publishUseCase = new PublishNowUseCase();
      await publishUseCase.execute({
        postId,
        userId,
        signedEvent: createValidSignedEvent({ content: "test" }),
        relays: ["wss://relay.example.com"],
      });

      // Try invalid transition: PUBLISHED -> SCHEDULED (PUBLISHED is terminal)
      await expect(
        stateMachine.transition(postId, userId, "SCHEDULED", "Invalid")
      ).rejects.toThrow("Invalid transition from PUBLISHED to SCHEDULED");
    });

    it("should throw error if post not found", async () => {
      await expect(
        stateMachine.transition(
          "non-existent-post-id",
          userId,
          "SCHEDULED",
          "Test"
        )
      ).rejects.toThrow("not found for user");
    });
  });

  describe("getStateHistory", () => {
    it("should return state transition history in descending order", async () => {
      // Create a post
      const createUseCase = new CreatePostUseCase();
      const createResult = await createUseCase.execute({
        userId,
        content: "Test post",
        fileUrl: [],
        postType: "TEXT",
        isRecyclable: false,
      });

      const postId = createResult.post.id;

      // Make multiple transitions
      await stateMachine.transition(postId, userId, "SCHEDULED", "Scheduled");
      await stateMachine.transition(postId, userId, "PUBLISHING", "Publishing");
      await stateMachine.transition(postId, userId, "PUBLISHED", "Published");

      // Get history
      const history = await stateMachine.getStateHistory(postId);

      // Should be in descending order (newest first)
      expect(history.length).toBeGreaterThanOrEqual(3);
      expect(history[0]?.to).toBe("PUBLISHED");
      expect(history[0]?.from).toBe("PUBLISHING");
    });

    it("should return empty array for post with no transitions", async () => {
      // Create a post (which creates initial transition)
      const createUseCase = new CreatePostUseCase();
      const createResult = await createUseCase.execute({
        userId,
        content: "Test post",
        fileUrl: [],
        postType: "TEXT",
        isRecyclable: false,
      });

      const postId = createResult.post.id;

      // Get history (should have at least the initial DRAFT transition)
      const history = await stateMachine.getStateHistory(postId);
      expect(Array.isArray(history)).toBe(true);
    });
  });

  describe("getCurrentState", () => {
    it("should return current state of post", async () => {
      // Create a post
      const createUseCase = new CreatePostUseCase();
      const createResult = await createUseCase.execute({
        userId,
        content: "Test post",
        fileUrl: [],
        postType: "TEXT",
        isRecyclable: false,
      });

      const postId = createResult.post.id;

      // Get current state (should be DRAFT initially)
      let state = await stateMachine.getCurrentState(postId);
      expect(state).toBe("DRAFT");

      // Transition and check again
      await stateMachine.transition(postId, userId, "SCHEDULED", "Scheduled");
      state = await stateMachine.getCurrentState(postId);
      expect(state).toBe("SCHEDULED");
    });

    it("should return DRAFT if post has null currentState", async () => {
      // Create a post
      const createUseCase = new CreatePostUseCase();
      const createResult = await createUseCase.execute({
        userId,
        content: "Test post",
        fileUrl: [],
        postType: "TEXT",
        isRecyclable: false,
      });

      const postId = createResult.post.id;

      // Manually set currentState to undefined (simulating old data)
      await prisma.post.update({
        where: { id: postId },
        data: { currentState: undefined },
      });

      const state = await stateMachine.getCurrentState(postId);
      expect(state).toBe("DRAFT");
    });
  });
});
