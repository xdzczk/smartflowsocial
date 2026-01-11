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
      update: vi.fn(),
    },
  };
  return { mockPrisma };
});

vi.mock("~/lib/prisma.server", () => ({
  prisma: mockPrisma,
}));

import {
  createOutboxEvent,
  createOutboxEventInTransaction,
  getUnprocessedOutboxEvents,
  markOutboxEventProcessed,
  type PostScheduledPayload,
} from "~/infra/outbox/outbox.server";
import { prisma } from "~/lib/prisma.server";

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
      const mockEvents = [
        {
          id: "event-1",
          eventType: "POST_SCHEDULED" as const,
          aggregateId: "post-1",
          aggregateType: "Post" as const,
          payload: { postId: "post-1" },
          scheduledFor: null,
          processedAt: null,
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
          createdAt: new Date("2024-01-01T10:30:00Z"),
        },
      ];

      (
        prisma.outboxEvent.findMany as ReturnType<typeof vi.fn>
      ).mockResolvedValue(mockEvents);

      const result = await getUnprocessedOutboxEvents(50);

      expect(result).toEqual(mockEvents);
      expect(prisma.outboxEvent.findMany).toHaveBeenCalledWith({
        where: {
          processedAt: null,
          OR: [
            { scheduledFor: null },
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- Jest expect matchers have complex types
            { scheduledFor: { lte: expect.any(Date) } },
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

  describe("markOutboxEventProcessed", () => {
    it("should mark event as processed without error", async () => {
      const mockEvent = {
        id: "event-1",
        processedAt: new Date(),
        processingError: null,
      };

      (prisma.outboxEvent.update as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockEvent
      );

      const result = await markOutboxEventProcessed("event-1");

      expect(result).toEqual(mockEvent);
      expect(prisma.outboxEvent.update).toHaveBeenCalledWith({
        where: { id: "event-1" },
        data: {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- Jest expect matchers have complex types
          processedAt: expect.any(Date),
          processingError: null,
        },
      });
    });

    it("should mark event as processed with error", async () => {
      const mockEvent = {
        id: "event-1",
        processedAt: new Date(),
        processingError: "Failed to process",
      };

      (prisma.outboxEvent.update as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockEvent
      );

      const result = await markOutboxEventProcessed(
        "event-1",
        "Failed to process"
      );

      expect(result).toEqual(mockEvent);
      expect(prisma.outboxEvent.update).toHaveBeenCalledWith({
        where: { id: "event-1" },
        data: {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- Jest expect matchers have complex types
          processedAt: expect.any(Date),
          processingError: "Failed to process",
        },
      });
    });
  });
});
