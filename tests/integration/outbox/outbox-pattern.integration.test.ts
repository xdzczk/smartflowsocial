/**
 * Integration tests for Outbox Pattern
 * Tests transactional guarantees and event processing with real database
 *
 * Note: These tests require a test database to be set up.
 * Run with: pnpm test:db:setup && pnpm test:integration -- --grep "Outbox Pattern"
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";

import { CreatePostUseCase } from "~/features/posts/use-cases/create-post.use-case.server";
import { SchedulePostUseCase } from "~/features/posts/use-cases/schedule-post.use-case.server";
import {
  createOutboxEvent,
  getUnprocessedOutboxEvents,
  markOutboxEventProcessed,
  type PostScheduledPayload,
} from "~/infra/outbox/outbox.server";
import { prisma } from "~/lib/prisma.server";

// Skip if no test database configured
const TEST_DATABASE_URL =
  process.env["TEST_DATABASE_URL"] ?? process.env["DATABASE_URL"];

describe.skipIf(!TEST_DATABASE_URL)("Outbox Pattern Integration", () => {
  let userId: string;

  beforeEach(async () => {
    // Create a test user with a unique npub to avoid collisions
    // Use timestamp + random number for better uniqueness
    const uniqueNpub = `test-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    const user = await prisma.user.create({
      data: {
        npub: uniqueNpub,
        isEnabled: true,
      },
    });
    userId = user.id;
  });

  afterEach(async () => {
    // Clean up test data
    await prisma.outboxEvent.deleteMany({
      where: {
        aggregateId: {
          in: await prisma.post
            .findMany({ where: { userId }, select: { id: true } })
            .then((posts) => posts.map((p) => p.id)),
        },
      },
    });
    await prisma.postStateTransition.deleteMany({
      where: { post: { userId } },
    });
    await prisma.post.deleteMany({
      where: { userId },
    });
    // Use deleteMany with where to handle case where user might not exist
    await prisma.user.deleteMany({
      where: { id: userId },
    });
  });

  describe("Transactional Guarantees", () => {
    it("should create outbox event atomically with post creation", async () => {
      // Create a scheduled post with signedEvent (which creates outbox event in transaction)
      const createUseCase = new CreatePostUseCase();
      const scheduledFor = Math.floor(Date.now() / 1000) + 3600;
      const signedEvent = {
        id: "event-123",
        pubkey: "pk-123",
        created_at: scheduledFor,
        kind: 1,
        content: "Test post",
        tags: [],
        sig: "sig-123",
      };

      const result = await createUseCase.execute({
        userId,
        content: "Test post",
        fileUrl: [],
        postType: "TEXT",
        isRecyclable: false,
        scheduledFor,
        signedEvent,
      });

      const postId = result.post.id;

      // Verify outbox event was created
      const outboxEvents = await prisma.outboxEvent.findMany({
        where: {
          aggregateId: postId,
          eventType: "POST_SCHEDULED",
        },
      });

      expect(outboxEvents.length).toBe(1);
      expect(outboxEvents[0]?.processedAt).toBeNull();
    });

    it("should create outbox event atomically with post scheduling", async () => {
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

      // Schedule the post (which creates outbox event in transaction)
      const scheduleUseCase = new SchedulePostUseCase();
      const scheduledAtUtc = new Date(Date.now() + 3600000);
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

      // Verify outbox event was created
      const outboxEvents = await prisma.outboxEvent.findMany({
        where: {
          aggregateId: postId,
          eventType: "POST_SCHEDULED",
        },
      });

      expect(outboxEvents.length).toBe(1);
      expect(outboxEvents[0]?.processedAt).toBeNull();
    });
  });

  describe("Outbox Event Management", () => {
    it("should create and retrieve unprocessed events", async () => {
      const payload: PostScheduledPayload = {
        postId: "post-1",
        userId,
        signedEvent: {
          id: "event-123",
          pubkey: "test-pubkey",
          created_at: Math.floor(Date.now() / 1000),
          kind: 1,
          content: "test",
          tags: [],
          sig: "test-sig",
        },
        scheduledFor: Math.floor(Date.now() / 1000) + 3600,
        schemaVersion: "1.0",
      };

      await createOutboxEvent(
        "POST_SCHEDULED",
        "post-1",
        "Post",
        payload,
        new Date(payload.scheduledFor * 1000)
      );

      const unprocessedEvents = await getUnprocessedOutboxEvents(10);

      expect(unprocessedEvents.length).toBeGreaterThan(0);
      const event = unprocessedEvents.find((e) => e.aggregateId === "post-1");
      expect(event).toBeDefined();
      expect(event?.processedAt).toBeNull();
    });

    it("should mark event as processed", async () => {
      const payload: PostScheduledPayload = {
        postId: "post-2",
        userId,
        signedEvent: {
          id: "event-456",
          pubkey: "test-pubkey",
          created_at: Math.floor(Date.now() / 1000),
          kind: 1,
          content: "test",
          tags: [],
          sig: "test-sig",
        },
        scheduledFor: Math.floor(Date.now() / 1000) + 3600,
        schemaVersion: "1.0",
      };

      const event = await createOutboxEvent(
        "POST_SCHEDULED",
        "post-2",
        "Post",
        payload,
        new Date(payload.scheduledFor * 1000)
      );

      await markOutboxEventProcessed(event.id);

      const updatedEvent = await prisma.outboxEvent.findUnique({
        where: { id: event.id },
      });

      expect(updatedEvent?.processedAt).not.toBeNull();
      expect(updatedEvent?.processingError).toBeNull();
    });

    it("should mark event as processed with error", async () => {
      const payload: PostScheduledPayload = {
        postId: "post-3",
        userId,
        signedEvent: {
          id: "event-789",
          pubkey: "test-pubkey",
          created_at: Math.floor(Date.now() / 1000),
          kind: 1,
          content: "test",
          tags: [],
          sig: "test-sig",
        },
        scheduledFor: Math.floor(Date.now() / 1000) + 3600,
        schemaVersion: "1.0",
      };

      const event = await createOutboxEvent(
        "POST_SCHEDULED",
        "post-3",
        "Post",
        payload,
        new Date(payload.scheduledFor * 1000)
      );

      await markOutboxEventProcessed(event.id, "Processing failed");

      const updatedEvent = await prisma.outboxEvent.findUnique({
        where: { id: event.id },
      });

      expect(updatedEvent?.processedAt).not.toBeNull();
      expect(updatedEvent?.processingError).toBe("Processing failed");
    });

    it("should only retrieve unprocessed events", async () => {
      const payload: PostScheduledPayload = {
        postId: "post-4",
        userId,
        signedEvent: {
          id: "event-abc",
          pubkey: "test-pubkey",
          created_at: Math.floor(Date.now() / 1000),
          kind: 1,
          content: "test",
          tags: [],
          sig: "test-sig",
        },
        scheduledFor: Math.floor(Date.now() / 1000) + 3600,
        schemaVersion: "1.0",
      };

      const event = await createOutboxEvent(
        "POST_SCHEDULED",
        "post-4",
        "Post",
        payload,
        new Date(payload.scheduledFor * 1000)
      );

      // Mark as processed
      await markOutboxEventProcessed(event.id);

      // Should not appear in unprocessed events
      const unprocessedEvents = await getUnprocessedOutboxEvents(10);
      const foundEvent = unprocessedEvents.find((e) => e.id === event.id);
      expect(foundEvent).toBeUndefined();
    });

    it("should respect scheduledFor when retrieving events", async () => {
      const futureDate = new Date(Date.now() + 7200000); // 2 hours from now
      const payload: PostScheduledPayload = {
        postId: "post-5",
        userId,
        signedEvent: {
          id: "event-xyz",
          pubkey: "test-pubkey",
          created_at: Math.floor(Date.now() / 1000),
          kind: 1,
          content: "test",
          tags: [],
          sig: "test-sig",
        },
        scheduledFor: Math.floor(futureDate.getTime() / 1000),
        schemaVersion: "1.0",
      };

      await createOutboxEvent(
        "POST_SCHEDULED",
        "post-5",
        "Post",
        payload,
        futureDate
      );

      // Event with future scheduledFor should not appear in unprocessed events
      const unprocessedEvents = await getUnprocessedOutboxEvents(10);
      const foundEvent = unprocessedEvents.find(
        (e) => e.aggregateId === "post-5"
      );
      expect(foundEvent).toBeUndefined();
    });
  });
});
