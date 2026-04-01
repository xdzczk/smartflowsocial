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

// So handlePostDeleteRequested (POST_DELETE_REQUESTED) can call getDeleteSignerSecret() which reads env.NOSTR_NSEC
vi.mock("~/lib/env.server", () => ({
  env: { NOSTR_NSEC: "nsec-test" },
}));

vi.mock("~/infra/outbox/outbox.server", () => ({
  getUnprocessedOutboxEvents: vi.fn(),
  claimOutboxEvent: vi.fn(),
  extendOutboxEventLock: vi.fn(),
  markOutboxEventSucceeded: vi.fn(),
  markOutboxEventFailed: vi.fn(),
  deadLetterOutboxEvent: vi.fn(),
  getOutboxBacklogCounts: vi.fn(),
  getOldestReadyOutboxAgeSeconds: vi.fn(),
}));

// Do not mock outbox-lock.server: worker uses acquireOutboxLock/finalizeOutboxSuccess which
// delegate to claimOutboxEvent/markOutboxEventSucceeded on outbox.server (mocked above).
vi.mock("~/infra/queue/queue-client.server", () => ({
  queueClient: {
    enqueue: vi.fn(),
    cancelByJobId: vi.fn(),
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

vi.mock("~/features/nostr/delete-event.server", () => ({
  buildPostKind5DeleteDraft: vi.fn(),
  buildLongFormKind5DeleteDraft: vi.fn(),
}));

vi.mock("~/features/relays/relay-resolution.server", () => ({
  resolveExecutionRelays: vi.fn(),
}));

vi.mock("~/features/relays/publish-relay-acks.server", () => ({
  persistPublishRelayAcks: vi.fn(),
}));

vi.mock("~/infra/publishers/nostr-publisher.server", () => ({
  getNostrPublisher: vi.fn(),
}));

vi.mock("~/lib/nostr-adapter.server", () => ({
  nostrAdapter: {
    getPublicKey: vi.fn(),
    finalizeEvent: vi.fn(),
  },
}));

vi.mock("~/lib/error-logger.server", () => ({
  logInfo: vi.fn(),
  logError: vi.fn(),
}));

vi.mock("~/lib/metrics/business-metrics.server", () => ({
  recordOutboxEventProcessed: vi.fn(),
  recordOutboxEventRetried: vi.fn(),
  recordOutboxEventDeadLettered: vi.fn(),
  setOutboxBacklog: vi.fn(),
  setOutboxOldestReadyAgeSeconds: vi.fn(),
}));

vi.mock("~/lib/metrics/performance-metrics.server", () => ({
  recordOutboxProcessingDuration: vi.fn(),
  recordOutboxEnqueueToProcessLatency: vi.fn(),
}));

import {
  buildPostKind5DeleteDraft,
  buildLongFormKind5DeleteDraft,
} from "~/features/nostr/delete-event.server";
import { persistPublishRelayAcks } from "~/features/relays/publish-relay-acks.server";
import { resolveExecutionRelays } from "~/features/relays/relay-resolution.server";
import { processOutboxEvents } from "~/infra/outbox/outbox-worker.server";
import {
  getUnprocessedOutboxEvents,
  claimOutboxEvent,
  extendOutboxEventLock,
  markOutboxEventSucceeded,
  markOutboxEventFailed,
  deadLetterOutboxEvent,
  getOutboxBacklogCounts,
  getOldestReadyOutboxAgeSeconds,
} from "~/infra/outbox/outbox.server";
import { getNostrPublisher } from "~/infra/publishers/nostr-publisher.server";
import { queueClient } from "~/infra/queue/queue-client.server";
import { processPayloadWithVersion } from "~/infra/queue/version-handler.server";
import { BRAND_DELETE_REASON } from "~/lib/brand";
import {
  recordOutboxEventProcessed,
  recordOutboxEventRetried,
  recordOutboxEventDeadLettered,
} from "~/lib/metrics/business-metrics.server";
import { nostrAdapter } from "~/lib/nostr-adapter.server";

const ANY_DATE = expect.any(Date) as unknown as Date;
const ANY_STRING = expect.any(String) as unknown as string;
const stringContaining = (value: string): string =>
  expect.stringContaining(value) as unknown as string;

describe("Outbox Worker", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env["NOSTR_NSEC"] = "nsec-test";
    (claimOutboxEvent as ReturnType<typeof vi.fn>).mockResolvedValue({
      lockId: "lock-1",
      expiresAt: new Date(Date.now() + 30000),
    });
    (markOutboxEventSucceeded as ReturnType<typeof vi.fn>).mockResolvedValue(
      true
    );
    (markOutboxEventFailed as ReturnType<typeof vi.fn>).mockResolvedValue(true);
    (deadLetterOutboxEvent as ReturnType<typeof vi.fn>).mockResolvedValue(true);
    (extendOutboxEventLock as ReturnType<typeof vi.fn>).mockResolvedValue({
      lockId: "lock-1",
      expiresAt: new Date(Date.now() + 30000),
    });
    (getOutboxBacklogCounts as ReturnType<typeof vi.fn>).mockResolvedValue({
      pending: 0,
      ready: 0,
      deadLettered: 0,
    });
    (
      getOldestReadyOutboxAgeSeconds as ReturnType<typeof vi.fn>
    ).mockResolvedValue(0);
    (buildPostKind5DeleteDraft as ReturnType<typeof vi.fn>).mockReturnValue({
      expectedPubkey: "pubkey-1",
      unsignedEvent: {
        kind: 5,
        content: BRAND_DELETE_REASON,
        created_at: 1234567890,
        tags: [["e", "event-1"]],
      },
    });
    (buildLongFormKind5DeleteDraft as ReturnType<typeof vi.fn>).mockReturnValue(
      {
        expectedPubkey: "pubkey-1",
        unsignedEvent: {
          kind: 5,
          content: BRAND_DELETE_REASON,
          created_at: 1234567890,
          tags: [["a", "30023:pub:d"]],
        },
      }
    );
    (resolveExecutionRelays as ReturnType<typeof vi.fn>).mockResolvedValue([
      "wss://relay.example.com",
    ]);
    (persistPublishRelayAcks as ReturnType<typeof vi.fn>).mockResolvedValue(
      undefined
    );
    (nostrAdapter.getPublicKey as ReturnType<typeof vi.fn>).mockReturnValue(
      "pubkey-1"
    );
    (nostrAdapter.finalizeEvent as ReturnType<typeof vi.fn>).mockReturnValue({
      id: "delete-event-1",
      pubkey: "pubkey-1",
      created_at: 1234567890,
      kind: 5,
      tags: [["e", "event-1"]],
      content: BRAND_DELETE_REASON,
      sig: "sig-1",
    });
    (getNostrPublisher as ReturnType<typeof vi.fn>).mockReturnValue({
      publish: vi.fn().mockResolvedValue({
        results: [{ relay: "wss://relay.example.com", ok: true }],
      }),
    });
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
        attempts: 0,
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
      expect(markOutboxEventSucceeded).toHaveBeenCalledWith(
        expect.objectContaining({ eventId: "event-1", lockId: "lock-1" })
      );
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
        attempts: 0,
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
      expect(markOutboxEventSucceeded).toHaveBeenCalled();
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
        attempts: 0,
      };

      (
        getUnprocessedOutboxEvents as ReturnType<typeof vi.fn>
      ).mockResolvedValue([mockEvent]);
      (queueClient.cancelByJobId as ReturnType<typeof vi.fn>).mockResolvedValue(
        true
      );

      const result = await processOutboxEvents();

      expect(result.processed).toBe(1);
      expect(result.errors).toBe(0);
      expect(queueClient.cancelByJobId).toHaveBeenCalledWith(
        "scheduled-posts",
        "post-1"
      );
      expect(markOutboxEventSucceeded).toHaveBeenCalled();
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
        attempts: 0,
      };

      (
        getUnprocessedOutboxEvents as ReturnType<typeof vi.fn>
      ).mockResolvedValue([mockEvent]);
      (queueClient.cancelByJobId as ReturnType<typeof vi.fn>).mockResolvedValue(
        true
      );

      const result = await processOutboxEvents();

      expect(result.processed).toBe(1);
      expect(result.errors).toBe(0);
      expect(queueClient.cancelByJobId).toHaveBeenCalledWith(
        "scheduled-longform-posts",
        "longform-1"
      );
      expect(markOutboxEventSucceeded).toHaveBeenCalled();
    });

    it("should process POST_DELETE_REQUESTED event successfully", async () => {
      const mockEvent = {
        id: "event-delete-1",
        eventType: "POST_DELETE_REQUESTED" as const,
        aggregateId: "post-1",
        aggregateType: "Post",
        payload: {
          postId: "post-1",
          userId: "user-1",
          originalEventId: "nostr-event-1",
          originalEventPubkey: "pubkey-1",
          schemaVersion: "1.0",
        },
        scheduledFor: null,
        correlationId: "corr-delete-1",
        createdAt: new Date(),
        processedAt: null,
        processingError: null,
        attempts: 0,
      };
      (
        getUnprocessedOutboxEvents as ReturnType<typeof vi.fn>
      ).mockResolvedValue([mockEvent]);

      const result = await processOutboxEvents();

      expect(result.processed).toBe(1);
      expect(result.errors).toBe(0);
      expect(buildPostKind5DeleteDraft).toHaveBeenCalled();
      expect(resolveExecutionRelays).toHaveBeenCalledWith("user-1");
      const publisher = (getNostrPublisher as ReturnType<typeof vi.fn>).mock
        .results[0]?.value as { publish: ReturnType<typeof vi.fn> };
      expect(publisher.publish).toHaveBeenCalled();
      expect(persistPublishRelayAcks).toHaveBeenCalledWith(
        expect.objectContaining({
          publishAttemptId: "delete:post-1:nostr-event-1",
          userId: "user-1",
          eventId: "delete-event-1",
        })
      );
      expect(markOutboxEventSucceeded).toHaveBeenCalledWith(
        expect.objectContaining({ eventId: "event-delete-1", lockId: "lock-1" })
      );
    });

    it("should dead-letter non-retryable delete signer mismatch", async () => {
      (nostrAdapter.getPublicKey as ReturnType<typeof vi.fn>).mockReturnValue(
        "different-pubkey"
      );
      const mockEvent = {
        id: "event-delete-2",
        eventType: "POST_DELETE_REQUESTED" as const,
        aggregateId: "post-2",
        aggregateType: "Post",
        payload: {
          postId: "post-2",
          userId: "user-1",
          originalEventId: "nostr-event-2",
          originalEventPubkey: "pubkey-1",
          schemaVersion: "1.0",
        },
        scheduledFor: null,
        correlationId: null,
        createdAt: new Date(),
        processedAt: null,
        processingError: null,
        attempts: 0,
      };
      (
        getUnprocessedOutboxEvents as ReturnType<typeof vi.fn>
      ).mockResolvedValue([mockEvent]);

      const result = await processOutboxEvents();

      expect(result.processed).toBe(0);
      expect(result.errors).toBe(1);
      expect(deadLetterOutboxEvent).toHaveBeenCalledWith(
        expect.objectContaining({ eventId: "event-delete-2", lockId: "lock-1" })
      );
      expect(recordOutboxEventDeadLettered).toHaveBeenCalledWith(
        "POST_DELETE_REQUESTED",
        "non_retryable"
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
        attempts: 0,
      };

      (
        getUnprocessedOutboxEvents as ReturnType<typeof vi.fn>
      ).mockResolvedValue([mockEvent]);
      const { updateReadModels } =
        await import("~/infra/outbox/read-model-worker.server");
      // Mock updateReadModels to resolve successfully (it's called with void, so errors are non-blocking)
      (updateReadModels as ReturnType<typeof vi.fn>).mockResolvedValue(
        undefined
      );

      const result = await processOutboxEvents();

      // POST_CREATED is handled by read model worker, not the main outbox worker
      // The outbox worker should call updateReadModels for read model events
      expect(updateReadModels).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: "POST_CREATED",
          aggregateId: "post-1",
        })
      );
      // POST_CREATED events are processed (marked as processed) but don't enqueue jobs
      expect(result.processed).toBe(1);
      expect(result.errors).toBe(0);
      expect(markOutboxEventSucceeded).toHaveBeenCalledWith(
        expect.objectContaining({ eventId: "event-5", lockId: "lock-1" })
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
        attempts: 0,
      };

      (
        getUnprocessedOutboxEvents as ReturnType<typeof vi.fn>
      ).mockResolvedValue([mockEvent]);
      (processPayloadWithVersion as ReturnType<typeof vi.fn>).mockReturnValue({
        success: false,
        error: "Invalid payload",
      });

      const result = await processOutboxEvents();

      expect(result.processed).toBe(0);
      expect(result.errors).toBe(1);
      expect(deadLetterOutboxEvent).toHaveBeenCalledWith(
        expect.objectContaining({ eventId: "event-6", lockId: "lock-1" })
      );
      expect(recordOutboxEventDeadLettered).toHaveBeenCalledWith(
        "POST_SCHEDULED",
        "non_retryable"
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
        attempts: 0,
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

      const result = await processOutboxEvents();

      expect(result.processed).toBe(0);
      expect(result.errors).toBe(1);
      expect(markOutboxEventFailed).toHaveBeenCalledWith(
        expect.objectContaining({
          eventId: "event-7",
          lockId: "lock-1",
          errorMessage: ANY_STRING,
          nextAttemptAt: ANY_DATE,
        })
      );
      expect(recordOutboxEventRetried).toHaveBeenCalledWith("POST_SCHEDULED");
    });

    it("should dead-letter when max outbox attempts reached", async () => {
      const mockEvent = {
        id: "event-max",
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
        attempts: 4, // next failure => 5 => maxAttempts
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

      await processOutboxEvents();

      expect(deadLetterOutboxEvent).toHaveBeenCalledWith(
        expect.objectContaining({ eventId: "event-max", lockId: "lock-1" })
      );
      expect(recordOutboxEventDeadLettered).toHaveBeenCalledWith(
        "POST_SCHEDULED",
        "max_attempts"
      );
    });

    it("should treat deterministic jobId collision as idempotent success", async () => {
      const mockEvent = {
        id: "event-dup",
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
        attempts: 0,
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
        error: "Job already exists",
      });

      const result = await processOutboxEvents();

      expect(result.processed).toBe(1);
      expect(result.errors).toBe(0);
      expect(markOutboxEventSucceeded).toHaveBeenCalledWith(
        expect.objectContaining({ eventId: "event-dup", lockId: "lock-1" })
      );
      expect(deadLetterOutboxEvent).not.toHaveBeenCalled();
    });

    it("should retry on transient failure and succeed on a later run", async () => {
      const baseEvent = {
        id: "event-retry",
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

      (processPayloadWithVersion as ReturnType<typeof vi.fn>).mockReturnValue({
        success: true,
        payload: baseEvent.payload,
        version: "1.0",
      });

      // First run fails => schedules retry
      (
        getUnprocessedOutboxEvents as ReturnType<typeof vi.fn>
      ).mockResolvedValueOnce([{ ...baseEvent, attempts: 0 }]);
      (queueClient.enqueue as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        success: false,
        error: "Queue full",
      });

      const first = await processOutboxEvents();
      expect(first.processed).toBe(0);
      expect(first.errors).toBe(1);
      expect(markOutboxEventFailed).toHaveBeenCalled();

      // Second run succeeds
      (
        getUnprocessedOutboxEvents as ReturnType<typeof vi.fn>
      ).mockResolvedValueOnce([{ ...baseEvent, attempts: 1 }]);
      (queueClient.enqueue as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        success: true,
      });

      const second = await processOutboxEvents();
      expect(second.processed).toBe(1);
      expect(second.errors).toBe(0);
      expect(markOutboxEventSucceeded).toHaveBeenCalled();
    });

    it("should only allow one concurrent claim to enqueue a given event", async () => {
      const mockEvent = {
        id: "event-concurrent",
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
        attempts: 0,
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

      // Only the first claim succeeds; all subsequent claims fail.
      let claimed = false;
      (claimOutboxEvent as ReturnType<typeof vi.fn>).mockImplementation(() => {
        if (claimed) return null;
        claimed = true;
        return { lockId: "lock-1", expiresAt: new Date(Date.now() + 30000) };
      });

      await Promise.all([processOutboxEvents(), processOutboxEvents()]);

      expect(queueClient.enqueue).toHaveBeenCalledTimes(1);
      expect(markOutboxEventSucceeded).toHaveBeenCalledTimes(1);
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
          attempts: 0,
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
          attempts: 0,
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
      (queueClient.cancelByJobId as ReturnType<typeof vi.fn>).mockResolvedValue(
        true
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
        attempts: 0,
      };

      (
        getUnprocessedOutboxEvents as ReturnType<typeof vi.fn>
      ).mockResolvedValue([mockEvent]);
      const result = await processOutboxEvents();

      expect(result.processed).toBe(0);
      expect(result.errors).toBe(1);
      expect(deadLetterOutboxEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          eventId: "event-8",
          lockId: "lock-1",
          errorMessage: stringContaining("Unknown event type"),
        })
      );
      expect(recordOutboxEventDeadLettered).toHaveBeenCalled();
    });
  });
});
