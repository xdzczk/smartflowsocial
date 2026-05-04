/**
 * LongFormPost and LongFormPostStateTransition data. Prisma confined here.
 */

import type { Prisma as PrismaClient } from "@prisma/client";

import type { Prisma } from "~/features/posts/data/posts-prisma-types.server";
import { createOutboxEventInTransaction } from "~/infra/outbox/outbox.server";
import type { LongFormPostScheduledPayload } from "~/infra/outbox/outbox.server";
import { isPrismaUniqueViolationOnFields } from "~/lib/prisma-unique-violation.server";
import { prisma } from "~/lib/prisma.server";

export type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

export function runTransaction<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
  return prisma.$transaction(fn);
}

export async function findLongFormPostById(id: string, userId?: string) {
  const where = userId ? { id, userId } : { id };
  return prisma.longFormPost.findUnique({
    where,
    select: { currentState: true },
  });
}

export async function findLongFormPostFull(id: string, userId: string) {
  return prisma.longFormPost.findUnique({
    where: { id, userId },
  });
}

/** Generic findUnique for queue-handlers and other callers that need custom include/select. */
export function findLongFormPostUnique(
  where: { id: string; userId?: string },
  options?: { include?: object; select?: object }
) {
  const whereClause =
    where.userId !== undefined
      ? { id: where.id, userId: where.userId }
      : { id: where.id };
  return prisma.longFormPost.findUnique({
    where: whereClause,
    ...options,
  });
}

export async function updateLongFormPost(
  postId: string,
  userId: string,
  data: Parameters<typeof prisma.longFormPost.update>[0]["data"]
) {
  return prisma.longFormPost.update({
    where: { id: postId, userId },
    data,
  });
}

export async function updateLongFormPostInTx(
  tx: Tx,
  postId: string,
  userId: string,
  data: Parameters<typeof prisma.longFormPost.update>[0]["data"]
) {
  return tx.longFormPost.update({
    where: { id: postId, userId },
    data,
  });
}

export async function createLongFormPostStateTransitionInTx(
  tx: Tx,
  longFormPostId: string,
  fromState: string,
  toState: string,
  reason: string
) {
  return tx.longFormPostStateTransition.create({
    data: { longFormPostId, fromState, toState, reason },
  });
}

export async function findLongFormPostStateTransitions(longFormPostId: string) {
  return prisma.longFormPostStateTransition.findMany({
    where: { longFormPostId },
    orderBy: { createdAt: "desc" },
  });
}

export async function findManyLongFormPosts(
  where: Prisma.LongFormPostWhereInput,
  options?: {
    select?: Prisma.LongFormPostSelect;
    take?: number;
  }
) {
  return prisma.longFormPost.findMany({
    where,
    ...(options?.select && { select: options.select }),
    ...(options?.take != null && { take: options.take }),
  });
}

export async function runCreateScheduledLongFormPostInTransaction(
  data: Parameters<typeof prisma.longFormPost.create>[0]["data"],
  outboxParams: {
    payload: Omit<LongFormPostScheduledPayload, "postId">;
    scheduledAtUtc: Date;
    scheduledForUnix: number;
  }
) {
  const { generateEnqueueIdempotencyKey } =
    await import("~/lib/idempotency.server");
  return prisma.$transaction(async (tx) => {
    const post = await tx.longFormPost.create({ data });
    const payload: LongFormPostScheduledPayload = {
      ...outboxParams.payload,
      postId: post.id,
    };
    const eventId =
      typeof outboxParams.payload.signedEvent.id === "string"
        ? outboxParams.payload.signedEvent.id
        : undefined;
    const enqueueIdempotencyKey = generateEnqueueIdempotencyKey(
      post.id,
      outboxParams.scheduledForUnix,
      eventId
    );
    await createOutboxEventInTransaction(
      tx as PrismaClient.TransactionClient,
      "LONGFORM_SCHEDULED",
      post.id,
      "LongFormPost",
      payload,
      outboxParams.scheduledAtUtc,
      enqueueIdempotencyKey
    );
    return post;
  });
}

export async function runScheduleLongFormPostInTransaction(
  postId: string,
  userId: string,
  data: {
    scheduledAtUtc: Date;
    nominalScheduledAtUtc?: Date | null;
    enqueueIdempotencyKey: string;
    signedEvent?: unknown;
  },
  fromState: string,
  toState: string,
  reason: string,
  outboxParams: {
    payload: LongFormPostScheduledPayload;
    scheduledAtUtc: Date;
    enqueueIdempotencyKey: string;
    correlationId?: string | null;
  }
) {
  await prisma.$transaction(async (tx) => {
    await tx.outboxEvent.deleteMany({
      where: {
        eventType: "LONGFORM_SCHEDULED",
        aggregateId: postId,
        aggregateType: "LongFormPost",
        processedAt: null,
        deadLetteredAt: null,
        processingLockId: null,
      },
    });

    await tx.longFormPost.update({
      where: { id: postId, userId },
      data: {
        scheduledAtUtc: data.scheduledAtUtc,
        ...(data.nominalScheduledAtUtc != null
          ? { nominalScheduledAtUtc: data.nominalScheduledAtUtc }
          : {}),
        enqueueIdempotencyKey: data.enqueueIdempotencyKey,
        currentState: "SCHEDULED",
        signedEvent: data.signedEvent as Prisma.InputJsonValue,
        queueHoldStatus: "NONE",
        queueHeldAtUtc: null,
        queueHeldOriginalScheduledAtUtc: null,
        queueHeldByQueueTypeId: null,
      },
    });
    await tx.longFormPostStateTransition.create({
      data: { longFormPostId: postId, fromState, toState, reason },
    });
    try {
      await createOutboxEventInTransaction(
        tx as PrismaClient.TransactionClient,
        "LONGFORM_SCHEDULED",
        postId,
        "LongFormPost",
        outboxParams.payload,
        outboxParams.scheduledAtUtc,
        outboxParams.enqueueIdempotencyKey,
        outboxParams.correlationId ?? undefined
      );
    } catch (error) {
      if (!isPrismaUniqueViolationOnFields(error, ["idempotencyKey"])) {
        throw error;
      }
    }
  });
}
