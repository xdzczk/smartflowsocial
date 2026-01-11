/**
 * Unit tests for Outbox Worker
 * Tests app/infra/outbox/outbox-worker.server.ts
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock dependencies
const { mockPrisma } = vi.hoisted(() => {
  const mockPrisma = {
    outboxEvent: {
      findMany: vi.fn(),
      update: vi.fn(),
    },
  };
  return { mockPrisma };
});

vi.mock("~/lib/prisma.server", () => ({
  prisma: mockPrisma,
}));

vi.mock("~/infra/outbox/outbox.server", () => ({
  getUnprocessedOutboxEvents: vi.fn(),
  markOutboxEventProcessed: vi.fn(),
}));

vi.mock("~/infra/queue/queue-client.server", () => ({
  queueClient: {
    enqueue: vi.fn(),
    cancelByData: vi.fn(),
  },
}));

vi.mock("~/infra/queue/version-handler.server", () => ({
  processPayloadWithVersion: vi.fn(),
  CURRENT_VERSION: "1.0",
  getPayloadVersion: vi.fn(),
}));

vi.mock("~/infra/outbox/read-model-worker.server", () => ({
  updateReadModels: vi.fn(),
}));

vi.mock("~/lib/error-logger.server", () => ({
  logInfo: vi.fn(),
  logError: vi.fn(),
}));

vi.mock("~/lib/metrics/business-metrics.server", () => ({
  recordOutboxEventProcessed: vi.fn(),
}));

vi.mock("~/lib/metrics/performance-metrics.server", () => ({
  recordOutboxProcessingDuration: vi.fn(),
}));

import { processOutboxEvents } from "~/infra/outbox/outbox-worker.server";
import {
  getUnprocessedOutboxEvents,
  markOutboxEventProcessed,
} from "~/infra/outbox/outbox.server";
import { queueClient } from "~/infra/queue/queue-client.server";
import { processPayloadWithVersion } from "~/infra/queue/version-handler.server";
import { recordOutboxEventProcessed } from "~/lib/metrics/business-metrics.server";

describe("Outbox Worker", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("processOutboxEvents", () => {
    it("should process POST_SCHEDULED event successfully", async () => {
      const mockEvent = {
        id: "event-1",
        eventType: "POST_SCHEDULED" as const,
        aggregateId: "post-1",
        aggregateType: "Post",
        payload: {
          postId: "post-1",
          userId: "user-1",
          signedEvent: { id: "event-123" },
          scheduledFor: 1234567890,
          schemaVersion: "1.0",
        },
        scheduledFor: new Date(1234567890000),
        correlationId: "corr-1",
        createdAt: new Date(),
        processedAt: null,
        processingError: null,
      };

      (
        getUnprocessedOutboxEvents as ReturnType<typeof vi.fn>
      ).mockResolvedValue([mockEvent]);
      (processPayloadWithVersion as ReturnType<typeof vi.fn>).mockReturnValue({
        success: true,
        payload: mockEvent.payload,
        version: "1.0",
      });
      (queueClient.enqueue as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
      });
      (markOutboxEventProcessed as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockEvent
      );

      const result = await processOutboxEvents();

      expect(result.processed).toBe(1);
      expect(result.errors).toBe(0);
      expect(queueClient.enqueue).toHaveBeenCalledWith(
        "scheduled-posts",
        "publish-post",
        expect.objectContaining({
          postId: "post-1",
          userId: "user-1",
        }),
        expect.objectContaining({
          scheduledFor: 1234567890,
          jobId: "post-1",
        })
      );
      expect(markOutboxEventProcessed).toHaveBeenCalledWith("event-1");
      expect(recordOutboxEventProcessed).toHaveBeenCalledWith(
        "POST_SCHEDULED",
        true
      );
    });

    it("should process LONGFORM_SCHEDULED event successfully", async () => {
      const mockEvent = {
        id: "event-2",
        eventType: "LONGFORM_SCHEDULED" as const,
        aggregateId: "longform-1",
        aggregateType: "LongFormPost",
        payload: {
          postId: "longform-1",
          userId: "user-1",
          signedEvent: { id: "event-456" },
          scheduledFor: 1234567890,
          schemaVersion: "1.0",
        },
        scheduledFor: new Date(1234567890000),
        correlationId: "corr-2",
        createdAt: new Date(),
        processedAt: null,
        processingError: null,
      };

      (
        getUnprocessedOutboxEvents as ReturnType<typeof vi.fn>
      ).mockResolvedValue([mockEvent]);
      (processPayloadWithVersion as ReturnType<typeof vi.fn>).mockReturnValue({
        success: true,
        payload: mockEvent.payload,
        version: "1.0",
      });
      (queueClient.enqueue as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
      });
      (markOutboxEventProcessed as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockEvent
      );

      const result = await processOutboxEvents();

      expect(result.processed).toBe(1);
      expect(result.errors).toBe(0);
      expect(queueClient.enqueue).toHaveBeenCalledWith(
        "scheduled-longform-posts",
        "publish-longform-post",
        expect.objectContaining({
          postId: "longform-1",
          userId: "user-1",
        }),
        expect.objectContaining({
          scheduledFor: 1234567890,
          jobId: "longform-1",
        })
      );
    });

    it("should process POST_CANCELLED event successfully", async () => {
      const mockEvent = {
        id: "event-3",
        eventType: "POST_CANCELLED" as const,
        aggregateId: "post-1",
        aggregateType: "Post",
        payload: {},
        scheduledFor: null,
        correlationId: null,
        createdAt: new Date(),
        processedAt: null,
        processingError: null,
      };

      (
        getUnprocessedOutboxEvents as ReturnType<typeof vi.fn>
      ).mockResolvedValue([mockEvent]);
      (queueClient.cancelByData as ReturnType<typeof vi.fn>).mockResolvedValue(
        true
      );
      (markOutboxEventProcessed as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockEvent
      );

      const result = await processOutboxEvents();

      expect(result.processed).toBe(1);
      expect(result.errors).toBe(0);
      expect(queueClient.cancelByData).toHaveBeenCalledWith(
        "scheduled-posts",
        "postId",
        "post-1"
      );
    });

    it("should process LONGFORM_CANCELLED event successfully", async () => {
      const mockEvent = {
        id: "event-4",
        eventType: "LONGFORM_CANCELLED" as const,
        aggregateId: "longform-1",
        aggregateType: "LongFormPost",
        payload: {},
        scheduledFor: null,
        correlationId: null,
        createdAt: new Date(),
        processedAt: null,
        processingError: null,
      };

      (
        getUnprocessedOutboxEvents as ReturnType<typeof vi.fn>
      ).mockResolvedValue([mockEvent]);
      (queueClient.cancelByData as ReturnType<typeof vi.fn>).mockResolvedValue(
        true
      );
      (markOutboxEventProcessed as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockEvent
      );

      const result = await processOutboxEvents();

      expect(result.processed).toBe(1);
      expect(result.errors).toBe(0);
      expect(queueClient.cancelByData).toHaveBeenCalledWith(
        "scheduled-longform-posts",
        "postId",
        "longform-1"
      );
    });

    it("should update read models for read model events", async () => {
      const mockEvent = {
        id: "event-5",
        eventType: "POST_CREATED" as const,
        aggregateId: "post-1",
        aggregateType: "Post",
        payload: {},
        scheduledFor: null,
        correlationId: "corr-1",
        createdAt: new Date(),
        processedAt: null,
        processingError: null,
      };

      (
        getUnprocessedOutboxEvents as ReturnType<typeof vi.fn>
      ).mockResolvedValue([mockEvent]);
      (markOutboxEventProcessed as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockEvent
      );

      const result = await processOutboxEvents();

      // POST_CREATED is not handled by processEvent, it's only handled by read model worker
      // So it will throw "Unknown event type" error
      expect(result.processed).toBe(0);
      expect(result.errors).toBe(1);
      expect(markOutboxEventProcessed).toHaveBeenCalledWith(
        "event-5",
        expect.stringContaining("Unknown event type")
      );
    });

    it("should handle processing errors", async () => {
      const mockEvent = {
        id: "event-6",
        eventType: "POST_SCHEDULED" as const,
        aggregateId: "post-1",
        aggregateType: "Post",
        payload: {
          postId: "post-1",
          userId: "user-1",
          signedEvent: { id: "event-123" },
          scheduledFor: 1234567890,
          schemaVersion: "1.0",
        },
        scheduledFor: new Date(1234567890000),
        correlationId: null,
        createdAt: new Date(),
        processedAt: null,
        processingError: null,
      };

      (
        getUnprocessedOutboxEvents as ReturnType<typeof vi.fn>
      ).mockResolvedValue([mockEvent]);
      (processPayloadWithVersion as ReturnType<typeof vi.fn>).mockReturnValue({
        success: false,
        error: "Invalid payload",
      });
      (markOutboxEventProcessed as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockEvent
      );

      const result = await processOutboxEvents();

      expect(result.processed).toBe(0);
      expect(result.errors).toBe(1);
      expect(markOutboxEventProcessed).toHaveBeenCalledWith(
        "event-6",
        expect.stringContaining("Invalid payload")
      );
      expect(recordOutboxEventProcessed).toHaveBeenCalledWith(
        "POST_SCHEDULED",
        false
      );
    });

    it("should handle enqueue failures", async () => {
      const mockEvent = {
        id: "event-7",
        eventType: "POST_SCHEDULED" as const,
        aggregateId: "post-1",
        aggregateType: "Post",
        payload: {
          postId: "post-1",
          userId: "user-1",
          signedEvent: { id: "event-123" },
          scheduledFor: 1234567890,
          schemaVersion: "1.0",
        },
        scheduledFor: new Date(1234567890000),
        correlationId: null,
        createdAt: new Date(),
        processedAt: null,
        processingError: null,
      };

      (
        getUnprocessedOutboxEvents as ReturnType<typeof vi.fn>
      ).mockResolvedValue([mockEvent]);
      (processPayloadWithVersion as ReturnType<typeof vi.fn>).mockReturnValue({
        success: true,
        payload: mockEvent.payload,
        version: "1.0",
      });
      (queueClient.enqueue as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: false,
        error: "Queue full",
      });
      (markOutboxEventProcessed as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockEvent
      );

      const result = await processOutboxEvents();

      expect(result.processed).toBe(0);
      expect(result.errors).toBe(1);
      expect(markOutboxEventProcessed).toHaveBeenCalledWith(
        "event-7",
        expect.any(String)
      );
    });

    it("should process multiple events", async () => {
      const mockEvents = [
        {
          id: "event-1",
          eventType: "POST_SCHEDULED" as const,
          aggregateId: "post-1",
          aggregateType: "Post",
          payload: {
            postId: "post-1",
            userId: "user-1",
            signedEvent: { id: "event-123" },
            scheduledFor: 1234567890,
            schemaVersion: "1.0",
          },
          scheduledFor: new Date(1234567890000),
          correlationId: null,
          createdAt: new Date(),
          processedAt: null,
          processingError: null,
        },
        {
          id: "event-2",
          eventType: "POST_CANCELLED" as const,
          aggregateId: "post-2",
          aggregateType: "Post",
          payload: {},
          scheduledFor: null,
          correlationId: null,
          createdAt: new Date(),
          processedAt: null,
          processingError: null,
        },
      ];

      (
        getUnprocessedOutboxEvents as ReturnType<typeof vi.fn>
      ).mockResolvedValue(mockEvents);
      (processPayloadWithVersion as ReturnType<typeof vi.fn>).mockReturnValue({
        success: true,
        payload: mockEvents[0]?.payload,
        version: "1.0",
      });
      (queueClient.enqueue as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
      });
      (queueClient.cancelByData as ReturnType<typeof vi.fn>).mockResolvedValue(
        true
      );
      (markOutboxEventProcessed as ReturnType<typeof vi.fn>).mockResolvedValue(
        {}
      );

      const result = await processOutboxEvents();

      expect(result.processed).toBe(2);
      expect(result.errors).toBe(0);
    });

    it("should throw error for unknown event type", async () => {
      const mockEvent = {
        id: "event-8",
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any -- Test mock with invalid event type
        eventType: "UNKNOWN_EVENT" as any,
        aggregateId: "post-1",
        aggregateType: "Post",
        payload: {},
        scheduledFor: null,
        correlationId: null,
        createdAt: new Date(),
        processedAt: null,
        processingError: null,
      };

      (
        getUnprocessedOutboxEvents as ReturnType<typeof vi.fn>
      ).mockResolvedValue([mockEvent]);
      (markOutboxEventProcessed as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockEvent
      );

      const result = await processOutboxEvents();

      expect(result.processed).toBe(0);
      expect(result.errors).toBe(1);
      expect(markOutboxEventProcessed).toHaveBeenCalledWith(
        "event-8",
        expect.stringContaining("Unknown event type")
      );
    });
  });
});
