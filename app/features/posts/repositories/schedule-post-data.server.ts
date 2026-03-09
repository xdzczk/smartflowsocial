/**
 * Schedule post transaction. Prisma confined to feature repositories.
 */

import type { Prisma } from "~/features/posts/data/posts-prisma-types.server";
import { prisma } from "~/lib/prisma.server";

export type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

export function runTransaction<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
  return prisma.$transaction(fn);
}

export async function schedulePostInTx(
  tx: Tx,
  postId: string,
  data: {
    scheduledAtUtc: Date;
    nominalScheduledAtUtc?: Date | null;
    enqueueIdempotencyKey: string;
    signedEvent?: unknown;
  },
  fromState: string,
  toState: string,
  reason: string
): Promise<void> {
  await tx.post.update({
    where: { id: postId },
    data: {
      scheduledAtUtc: data.scheduledAtUtc,
      ...(data.nominalScheduledAtUtc != null
        ? { nominalScheduledAtUtc: data.nominalScheduledAtUtc }
        : {}),
      enqueueIdempotencyKey: data.enqueueIdempotencyKey,
      currentState: "SCHEDULED",
      signedEvent: data.signedEvent as Prisma.InputJsonValue,
    },
  });
  await tx.postStateTransition.create({
    data: {
      postId,
      fromState,
      toState,
      reason,
    },
  });
}
