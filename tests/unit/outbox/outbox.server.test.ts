/**
 * Unit tests for Outbox Server Functions
 * Tests app/infra/outbox/outbox.server.ts
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock dependencies
const { mockPrisma } = vi.hoisted(() => {
  const mockPrisma = {
    outboxEvent: {
      create: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      updateMany: vi.fn(),
      count: vi.fn(),
    },
  };
  return { mockPrisma };
});

vi.mock("node:crypto", () => ({
  randomUUID: () => "lock-1",
}));

vi.mock("~/lib/prisma.server", () => ({
  prisma: mockPrisma,
}));

import {
  createOutboxEvent,
  createOutboxEventInTransaction,
  getUnprocessedOutboxEvents,
  claimOutboxEvent,
  extendOutboxEventLock,
  markOutboxEventSucceeded,
  markOutboxEventFailed,
  deadLetterOutboxEvent,
  getOutboxBacklogCounts,
  getOldestReadyOutboxAgeSeconds,
  replayDeadLetteredOutboxEvent,
  type PostScheduledPayload,
} from "~/infra/outbox/outbox.server";
import { prisma } from "~/lib/prisma.server";

const ANY_DATE = expect.any(Date) as unknown as Date;
const objectContainingRecord = (value: Record<string, unknown>) =>
  expect.objectContaining(value) as unknown as Record<string, unknown>;

describe("Outbox Server Functions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("createOutboxEvent", () => {
    it("should create an outbox event successfully", async () => {
      const mockEvent = {
        id: "event-1",
        eventType: "POST_SCHEDULED" as const,
        aggregateId: "post-1",
        aggregateType: "Post" as const,
        payload: {
          postId: "post-1",
          userId: "user-1",
          signedEvent: { id: "event-123" },
          scheduledFor: 1234567890,
          schemaVersion: "1.0",
        },
        scheduledFor: new Date(1234567890000),
        idempotencyKey: "key-1",
        correlationId: "corr-1",
        createdAt: new Date(),
        processedAt: null,
        processingError: null,
      };

      (prisma.outboxEvent.create as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockEvent
      );

      const payload: PostScheduledPayload = {
        postId: "post-1",
        userId: "user-1",
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any -- Test mock with partial signed event
        signedEvent: { id: "event-123" } as any,
        scheduledFor: 1234567890,
        schemaVersion: "1.0",
      };

      const result = await createOutboxEvent(
        "POST_SCHEDULED",
        "post-1",
        "Post",
        payload,
        new Date(1234567890000),
        "key-1",
        "corr-1"
      );

      expect(result).toEqual(mockEvent);
      expect(prisma.outboxEvent.create).toHaveBeenCalledWith({
        data: {
          eventType: "POST_SCHEDULED",
          aggregateId: "post-1",
          aggregateType: "Post",
          payload: payload,
          scheduledFor: new Date(1234567890000),
          idempotencyKey: "key-1",
          correlationId: "corr-1",
        },
      });
    });

    it("should create event without optional fields", async () => {
      const mockEvent = {
        id: "event-1",
        eventType: "POST_SCHEDULED" as const,
        aggregateId: "post-1",
        aggregateType: "Post" as const,
        payload: { postId: "post-1" },
        scheduledFor: null,
        idempotencyKey: null,
        correlationId: null,
        createdAt: new Date(),
        processedAt: null,
        processingError: null,
      };

      (prisma.outboxEvent.create as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockEvent
      );

      const result = await createOutboxEvent(
        "POST_SCHEDULED",
        "post-1",
        "Post",
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- Test mock with partial payload
        { postId: "post-1" } as PostScheduledPayload
      );

      expect(result).toEqual(mockEvent);
      expect(prisma.outboxEvent.create).toHaveBeenCalledWith({
        data: {
          eventType: "POST_SCHEDULED",
          aggregateId: "post-1",
          aggregateType: "Post",
          payload: { postId: "post-1" },
          scheduledFor: undefined,
          idempotencyKey: undefined,
          correlationId: undefined,
        },
      });
    });
  });

  describe("createOutboxEventInTransaction", () => {
    it("should create an outbox event in transaction", async () => {
      const mockTx = {
        outboxEvent: {
          create: vi.fn(),
        },
      };

      const mockEvent = {
        id: "event-1",
        eventType: "POST_SCHEDULED" as const,
        aggregateId: "post-1",
        aggregateType: "Post" as const,
        payload: { postId: "post-1" },
        scheduledFor: null,
        idempotencyKey: null,
        correlationId: null,
        createdAt: new Date(),
        processedAt: null,
        processingError: null,
      };

      (mockTx.outboxEvent.create as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockEvent
      );

      const payload: PostScheduledPayload = {
        postId: "post-1",
        userId: "user-1",
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any -- Test mock with partial signed event
        signedEvent: { id: "event-123" } as any,
        scheduledFor: 1234567890,
        schemaVersion: "1.0",
      };

      const result = await createOutboxEventInTransaction(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Test mock transaction
        mockTx as any,
        "POST_SCHEDULED",
        "post-1",
        "Post",
        payload,
        new Date(1234567890000),
        "key-1",
        "corr-1"
      );

      expect(result).toEqual(mockEvent);
      expect(mockTx.outboxEvent.create).toHaveBeenCalledWith({
        data: {
          eventType: "POST_SCHEDULED",
          aggregateId: "post-1",
          aggregateType: "Post",
          payload: payload,
          scheduledFor: new Date(1234567890000),
          idempotencyKey: "key-1",
          correlationId: "corr-1",
        },
      });
    });
  });

  describe("getUnprocessedOutboxEvents", () => {
    it("should get unprocessed events", async () => {
      const now = new Date("2024-01-01T12:00:00Z");
      const mockEvents = [
        {
          id: "event-1",
          eventType: "POST_SCHEDULED" as const,
          aggregateId: "post-1",
          aggregateType: "Post" as const,
          payload: { postId: "post-1" },
          scheduledFor: null,
          processedAt: null,
          deadLetteredAt: null,
          createdAt: new Date("2024-01-01T10:00:00Z"),
        },
        {
          id: "event-2",
          eventType: "POST_SCHEDULED" as const,
          aggregateId: "post-2",
          aggregateType: "Post" as const,
          payload: { postId: "post-2" },
          scheduledFor: new Date("2024-01-01T11:00:00Z"),
          processedAt: null,
          deadLetteredAt: null,
          createdAt: new Date("2024-01-01T10:30:00Z"),
        },
      ];

      (
        prisma.outboxEvent.findMany as ReturnType<typeof vi.fn>
      ).mockResolvedValue(mockEvents);

      const result = await getUnprocessedOutboxEvents(50, now);

      expect(result).toEqual(mockEvents);
      expect(prisma.outboxEvent.findMany).toHaveBeenCalledWith({
        where: {
          processedAt: null,
          deadLetteredAt: null,
          OR: [{ scheduledFor: null }, { scheduledFor: { lte: now } }],
          AND: [
            { OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: now } }] },
            {
              OR: [
                { processingLockExpiresAt: null },
                { processingLockExpiresAt: { lt: now } },
              ],
            },
          ],
        },
        take: 50,
        orderBy: { createdAt: "asc" },
      });
    });

    it("should use default limit if not provided", async () => {
      (
        prisma.outboxEvent.findMany as ReturnType<typeof vi.fn>
      ).mockResolvedValue([]);

      await getUnprocessedOutboxEvents();

      expect(prisma.outboxEvent.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 50,
        })
      );
    });
  });

  describe("claimOutboxEvent", () => {
    it("should claim event when eligible", async () => {
      (
        prisma.outboxEvent.updateMany as ReturnType<typeof vi.fn>
      ).mockResolvedValue({ count: 1 });

      const now = new Date("2024-01-01T12:00:00Z");
      const result = await claimOutboxEvent({
        eventId: "event-1",
        now,
        ttlMs: 1000,
      });

      expect(result).toEqual({
        lockId: "lock-1",
        expiresAt: new Date(now.getTime() + 1000),
      });
      expect(prisma.outboxEvent.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: objectContainingRecord({
            id: "event-1",
            processedAt: null,
            deadLetteredAt: null,
          }),
          data: objectContainingRecord({
            processingLockId: "lock-1",
            processingLockExpiresAt: ANY_DATE,
          }),
        })
      );
    });

    it("should return null when claim fails", async () => {
      (
        prisma.outboxEvent.updateMany as ReturnType<typeof vi.fn>
      ).mockResolvedValue({ count: 0 });
      const result = await claimOutboxEvent({ eventId: "event-1" });
      expect(result).toBeNull();
    });
  });

  describe("markOutboxEventSucceeded", () => {
    it("should mark event as processed and clear retry/lock fields", async () => {
      (
        prisma.outboxEvent.updateMany as ReturnType<typeof vi.fn>
      ).mockResolvedValue({ count: 1 });

      const ok = await markOutboxEventSucceeded({
        eventId: "event-1",
        lockId: "lock-1",
      });
      expect(ok).toBe(true);
      expect(prisma.outboxEvent.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "event-1", processingLockId: "lock-1" },
          data: objectContainingRecord({
            processedAt: ANY_DATE,
            processingError: null,
            lastError: null,
            nextAttemptAt: null,
            deadLetteredAt: null,
            processingLockId: null,
            processingLockExpiresAt: null,
          }),
        })
      );
    });
  });

  describe("extendOutboxEventLock", () => {
    it("should extend lock when lock ownership matches", async () => {
      (
        prisma.outboxEvent.updateMany as ReturnType<typeof vi.fn>
      ).mockResolvedValue({ count: 1 });
      const now = new Date("2024-01-01T12:00:00Z");
      const lock = await extendOutboxEventLock({
        eventId: "event-1",
        lockId: "lock-1",
        ttlMs: 10_000,
        now,
      });
      expect(lock).toEqual({
        lockId: "lock-1",
        expiresAt: new Date("2024-01-01T12:00:10.000Z"),
      });
    });
  });

  describe("markOutboxEventFailed", () => {
    it("should increment attempts and schedule nextAttemptAt", async () => {
      (
        prisma.outboxEvent.updateMany as ReturnType<typeof vi.fn>
      ).mockResolvedValue({ count: 1 });

      const now = new Date("2024-01-01T12:00:00Z");
      const nextAttemptAt = new Date("2024-01-01T12:00:05Z");
      const ok = await markOutboxEventFailed({
        eventId: "event-1",
        lockId: "lock-1",
        errorMessage: "Queue full",
        nextAttemptAt,
        now,
      });
      expect(ok).toBe(true);
      expect(prisma.outboxEvent.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: objectContainingRecord({
            id: "event-1",
            processingLockId: "lock-1",
            processedAt: null,
            deadLetteredAt: null,
          }),
          data: objectContainingRecord({
            attempts: { increment: 1 },
            lastAttemptAt: now,
            nextAttemptAt,
            lastError: "Queue full",
            processingError: "Queue full",
            processingLockId: null,
            processingLockExpiresAt: null,
          }),
        })
      );
    });
  });

  describe("deadLetterOutboxEvent", () => {
    it("should dead-letter and increment attempts", async () => {
      (
        prisma.outboxEvent.updateMany as ReturnType<typeof vi.fn>
      ).mockResolvedValue({ count: 1 });

      const ok = await deadLetterOutboxEvent({
        eventId: "event-1",
        lockId: "lock-1",
        errorMessage: "Invalid payload",
      });
      expect(ok).toBe(true);
      expect(prisma.outboxEvent.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: objectContainingRecord({
            id: "event-1",
            processingLockId: "lock-1",
            processedAt: null,
          }),
          data: objectContainingRecord({
            attempts: { increment: 1 },
            deadLetteredAt: ANY_DATE,
            lastError: "Invalid payload",
            processingError: "Invalid payload",
            nextAttemptAt: null,
            processingLockId: null,
            processingLockExpiresAt: null,
          }),
        })
      );
    });
  });

  describe("getOutboxBacklogCounts", () => {
    it("should return pending/ready/dead-letter counts", async () => {
      (prisma.outboxEvent.count as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce(10)
        .mockResolvedValueOnce(3)
        .mockResolvedValueOnce(2);

      const result = await getOutboxBacklogCounts(
        new Date("2024-01-01T12:00:00Z")
      );
      expect(result).toEqual({ pending: 10, ready: 3, deadLettered: 2 });
      expect(prisma.outboxEvent.count).toHaveBeenCalledTimes(3);
    });
  });

  describe("getOldestReadyOutboxAgeSeconds", () => {
    it("should return zero when no ready events", async () => {
      (
        prisma.outboxEvent.findFirst as ReturnType<typeof vi.fn>
      ).mockResolvedValue(null);
      const age = await getOldestReadyOutboxAgeSeconds(
        new Date("2024-01-01T12:00:00Z")
      );
      expect(age).toBe(0);
    });

    it("should return positive age for oldest ready event", async () => {
      (
        prisma.outboxEvent.findFirst as ReturnType<typeof vi.fn>
      ).mockResolvedValue({
        createdAt: new Date("2024-01-01T11:59:30Z"),
      });
      const age = await getOldestReadyOutboxAgeSeconds(
        new Date("2024-01-01T12:00:00Z")
      );
      expect(age).toBe(30);
    });
  });

  describe("replayDeadLetteredOutboxEvent", () => {
    it("should clear dead-letter markers for replay", async () => {
      (
        prisma.outboxEvent.updateMany as ReturnType<typeof vi.fn>
      ).mockResolvedValue({ count: 1 });
      const replayed = await replayDeadLetteredOutboxEvent("event-1");
      expect(replayed).toBe(true);
      expect(prisma.outboxEvent.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            id: "event-1",
            deadLetteredAt: { not: null },
            processedAt: null,
          },
          data: objectContainingRecord({
            deadLetteredAt: null,
            attempts: 0,
            lastError: null,
            nextAttemptAt: null,
          }),
        })
      );
    });
  });
});
