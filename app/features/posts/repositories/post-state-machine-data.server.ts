/**
 * Post state machine data (transitions, current state). Prisma confined here.
 */

import { prisma } from "~/lib/prisma.server";

export type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

export function runTransaction<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
  return prisma.$transaction(fn);
}

export async function findPostCurrentState(postId: string, userId: string) {
  const post = await prisma.post.findUnique({
    where: { id: postId, userId },
    select: { currentState: true },
  });
  return post?.currentState ?? null;
}

export async function updatePostInTx(
  tx: Tx,
  postId: string,
  userId: string,
  data: Parameters<typeof prisma.post.update>[0]["data"]
) {
  return tx.post.update({
    where: { id: postId, userId },
    data,
  });
}

export async function createPostStateTransitionInTx(
  tx: Tx,
  postId: string,
  fromState: string,
  toState: string,
  reason: string
) {
  return tx.postStateTransition.create({
    data: { postId, fromState, toState, reason },
  });
}

export async function findPostStateTransitions(postId: string) {
  return prisma.postStateTransition.findMany({
    where: { postId },
    orderBy: { createdAt: "desc" },
  });
}
