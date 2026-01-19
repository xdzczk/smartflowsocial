/**
 * Outbox Pattern Implementation
 *
 * Provides transactional outbox pattern for reliable job enqueueing.
 * Ensures that domain changes and job enqueueing are atomic.
 */

import { randomUUID } from "node:crypto";

import type { Prisma } from "@prisma/client";

import type { SignedEvent } from "~/features/nostr/types";
import { prisma } from "~/lib/prisma.server";

export type OutboxEventType =
  | "POST_SCHEDULED"
  | "LONGFORM_SCHEDULED"
  | "POST_CANCELLED"
  | "LONGFORM_CANCELLED"
  // Read model events
  | "POST_CREATED"
  | "POST_UPDATED"
  | "POST_PUBLISHED"
  | "POST_DELETED"
  | "LONGFORM_CREATED"
  | "LONGFORM_UPDATED"
  | "LONGFORM_PUBLISHED"
  | "LONGFORM_DELETED";

export interface PostScheduledPayload {
  postId: string;
  userId: string;
  signedEvent: SignedEvent;
  scheduledFor: number; // Unix timestamp in seconds
  schemaVersion: string;
  correlationId?: string; // For request tracking
}

export interface LongFormPostScheduledPayload {
  postId: string;
  userId: string;
  signedEvent: SignedEvent;
  scheduledFor: number;
  schemaVersion: string;
  correlationId?: string; // For request tracking
}

export interface OutboxProcessingLock {
  lockId: string;
  expiresAt: Date;
}

export const DEFAULT_OUTBOX_LOCK_TTL_MS = 30_000;

/**
 * Create an outbox event within a transaction
 * Use this within prisma.$transaction() to ensure atomicity
 */
export async function createOutboxEvent(
  eventType: OutboxEventType,
  aggregateId: string,
  aggregateType: "Post" | "LongFormPost",
  payload: PostScheduledPayload | LongFormPostScheduledPayload,
  scheduledFor?: Date,
  idempotencyKey?: string,
  correlationId?: string
) {
  return prisma.outboxEvent.create({
    data: {
      eventType,
      aggregateId,
      aggregateType,
      payload: payload as unknown as Prisma.InputJsonValue,
      scheduledFor,
      idempotencyKey,
      correlationId,
    },
  });
}

/**
 * Create an outbox event within an existing transaction
 */
export async function createOutboxEventInTransaction(
  tx: Prisma.TransactionClient,
  eventType: OutboxEventType,
  aggregateId: string,
  aggregateType: "Post" | "LongFormPost",
  payload: PostScheduledPayload | LongFormPostScheduledPayload,
  scheduledFor?: Date,
  idempotencyKey?: string,
  correlationId?: string
) {
  return tx.outboxEvent.create({
    data: {
      eventType,
      aggregateId,
      aggregateType,
      payload: payload as unknown as Prisma.InputJsonValue,
      scheduledFor,
      idempotencyKey,
      correlationId,
    },
  });
}

/**
 * Get unprocessed outbox events
 */
export async function getUnprocessedOutboxEvents(
  limit = 50,
  now: Date = new Date(),
  options?: { correlationId?: string }
) {
  return prisma.outboxEvent.findMany({
    where: {
      ...(options?.correlationId
        ? { correlationId: options.correlationId }
        : {}),
      processedAt: null,
      deadLetteredAt: null,
      OR: [{ scheduledFor: null }, { scheduledFor: { lte: now } }],
      AND: [
        {
          OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: now } }],
        },
        {
          OR: [
            { processingLockExpiresAt: null },
            { processingLockExpiresAt: { lt: now } },
          ],
        },
      ],
    },
    take: limit,
    orderBy: { createdAt: "asc" },
  });
}

/**
 * Claim an outbox event for processing (DB-backed lock).
 *
 * Returns a lock token that must be provided to finalize processing.
 */
export async function claimOutboxEvent(input: {
  eventId: string;
  ttlMs?: number;
  now?: Date;
}): Promise<OutboxProcessingLock | null> {
  const now = input.now ?? new Date();
  const ttlMs = input.ttlMs ?? DEFAULT_OUTBOX_LOCK_TTL_MS;
  const lockId = randomUUID();
  const expiresAt = new Date(now.getTime() + ttlMs);

  const updated = await prisma.outboxEvent.updateMany({
    where: {
      id: input.eventId,
      processedAt: null,
      deadLetteredAt: null,
      OR: [{ scheduledFor: null }, { scheduledFor: { lte: now } }],
      AND: [
        {
          OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: now } }],
        },
        {
          OR: [
            { processingLockExpiresAt: null },
            { processingLockExpiresAt: { lt: now } },
          ],
        },
      ],
    },
    data: {
      processingLockId: lockId,
      processingLockExpiresAt: expiresAt,
    },
  });

  if (updated.count !== 1) return null;
  return { lockId, expiresAt };
}

export async function markOutboxEventSucceeded(input: {
  eventId: string;
  lockId: string;
  now?: Date;
}): Promise<boolean> {
  const now = input.now ?? new Date();
  const updated = await prisma.outboxEvent.updateMany({
    where: {
      id: input.eventId,
      processingLockId: input.lockId,
    },
    data: {
      processedAt: now,
      processingError: null,
      lastError: null,
      nextAttemptAt: null,
      deadLetteredAt: null,
      processingLockId: null,
      processingLockExpiresAt: null,
    },
  });
  return updated.count === 1;
}

export async function markOutboxEventFailed(input: {
  eventId: string;
  lockId: string;
  errorMessage: string;
  nextAttemptAt: Date;
  now?: Date;
}): Promise<boolean> {
  const now = input.now ?? new Date();
  const updated = await prisma.outboxEvent.updateMany({
    where: {
      id: input.eventId,
      processingLockId: input.lockId,
      processedAt: null,
      deadLetteredAt: null,
    },
    data: {
      attempts: { increment: 1 },
      lastAttemptAt: now,
      nextAttemptAt: input.nextAttemptAt,
      lastError: input.errorMessage,
      // Keep legacy field aligned for backward compatibility / dashboards.
      processingError: input.errorMessage,
      processingLockId: null,
      processingLockExpiresAt: null,
    },
  });
  return updated.count === 1;
}

export async function deadLetterOutboxEvent(input: {
  eventId: string;
  lockId: string;
  errorMessage: string;
  now?: Date;
}): Promise<boolean> {
  const now = input.now ?? new Date();
  const updated = await prisma.outboxEvent.updateMany({
    where: {
      id: input.eventId,
      processingLockId: input.lockId,
      processedAt: null,
    },
    data: {
      attempts: { increment: 1 },
      deadLetteredAt: now,
      lastAttemptAt: now,
      lastError: input.errorMessage,
      processingError: input.errorMessage,
      nextAttemptAt: null,
      processingLockId: null,
      processingLockExpiresAt: null,
    },
  });
  return updated.count === 1;
}

export async function getOutboxBacklogCounts(now: Date = new Date()): Promise<{
  pending: number;
  ready: number;
  deadLettered: number;
}> {
  const [pending, ready, deadLettered] = await Promise.all([
    prisma.outboxEvent.count({
      where: { processedAt: null, deadLetteredAt: null },
    }),
    prisma.outboxEvent.count({
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
    }),
    prisma.outboxEvent.count({
      where: { deadLetteredAt: { not: null } },
    }),
  ]);

  return { pending, ready, deadLettered };
}
