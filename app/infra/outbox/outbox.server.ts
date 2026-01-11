/**
 * Outbox Pattern Implementation
 *
 * Provides transactional outbox pattern for reliable job enqueueing.
 * Ensures that domain changes and job enqueueing are atomic.
 */

import { Prisma } from "@prisma/client";

import type { SignedEvent } from "~/features/nostr/types";
import { prisma } from "~/lib/prisma.server";

export type OutboxEventType =
  | "POST_SCHEDULED"
  | "LONGFORM_SCHEDULED"
  | "POST_CANCELLED"
  | "LONGFORM_CANCELLED";

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

/**
 * Create an outbox event within a transaction
 * Use this within prisma.$transaction() to ensure atomicity
 */
export async function createOutboxEvent(
  eventType: OutboxEventType,
  aggregateId: string,
  aggregateType: "Post" | "LongFormPost",
  payload: PostScheduledPayload | LongFormPostScheduledPayload | unknown,
  scheduledFor?: Date,
  idempotencyKey?: string,
  correlationId?: string
) {
  return prisma.outboxEvent.create({
    data: {
      eventType,
      aggregateId,
      aggregateType,
      payload: payload as Prisma.InputJsonValue,
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
  payload: PostScheduledPayload | LongFormPostScheduledPayload | unknown,
  scheduledFor?: Date,
  idempotencyKey?: string,
  correlationId?: string
) {
  return tx.outboxEvent.create({
    data: {
      eventType,
      aggregateId,
      aggregateType,
      payload: payload as Prisma.InputJsonValue,
      scheduledFor,
      idempotencyKey,
      correlationId,
    },
  });
}

/**
 * Get unprocessed outbox events
 */
export async function getUnprocessedOutboxEvents(limit = 50) {
  return prisma.outboxEvent.findMany({
    where: {
      processedAt: null,
      OR: [
        { scheduledFor: null },
        { scheduledFor: { lte: new Date() } },
      ],
    },
    take: limit,
    orderBy: { createdAt: "asc" },
  });
}

/**
 * Mark an outbox event as processed
 */
export async function markOutboxEventProcessed(
  eventId: string,
  error?: string
) {
  return prisma.outboxEvent.update({
    where: { id: eventId },
    data: {
      processedAt: new Date(),
      processingError: error || null,
    },
  });
}
