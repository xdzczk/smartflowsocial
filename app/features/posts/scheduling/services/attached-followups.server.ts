/* eslint-disable-next-line no-restricted-imports -- Scheduling service needs Prisma primitives for JSON null updates. */
import { Prisma } from "@prisma/client";

import { cancelPostJob } from "~/infra/queue/queue-operations.server";
/* eslint-disable-next-line no-restricted-imports -- Scheduling service performs transactionally consistent follow-up cascades. */
import { prisma } from "~/lib/prisma.server";

type TxClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

interface AttachedNode {
  id: string;
  parentScheduledActionId: string | null;
  scheduledAtUtc: Date | null;
  followUpTimingMode: "offset_from_parent" | "fixed_datetime" | null;
  followUpOffsetSeconds: number | null;
  currentState: string;
}

async function collectAttachedDescendants(
  tx: TxClient,
  rootId: string,
  userId: string
): Promise<AttachedNode[]> {
  const collected: AttachedNode[] = [];
  let frontier = [rootId];
  while (frontier.length > 0) {
    const children = await tx.post.findMany({
      where: {
        userId,
        dependencyMode: "attached",
        parentScheduledActionId: { in: frontier },
      },
      select: {
        id: true,
        parentScheduledActionId: true,
        scheduledAtUtc: true,
        followUpTimingMode: true,
        followUpOffsetSeconds: true,
        currentState: true,
      },
    });
    if (children.length === 0) break;
    collected.push(...children);
    frontier = children.map((child) => child.id);
  }
  return collected;
}

export async function cascadeDeleteAttachedFollowups(input: {
  rootPostId: string;
  userId: string;
}): Promise<string[]> {
  const descendantIds = await prisma.$transaction(async (tx) => {
    const descendants = await collectAttachedDescendants(
      tx,
      input.rootPostId,
      input.userId
    );
    if (descendants.length === 0) return [] as string[];
    const ids = descendants.map((item) => item.id);
    await tx.post.deleteMany({
      where: {
        userId: input.userId,
        id: { in: ids },
      },
    });
    return ids;
  });

  await Promise.all(descendantIds.map((id) => cancelPostJob(id)));
  return descendantIds;
}

/**
 * Remove a scheduled post that can no longer be published (e.g. engagement
 * conditions not met). Clears schedule metadata so it disappears from Scheduled.
 */
export async function discardScheduledPost(input: {
  postId: string;
  userId: string;
  reason: string;
}): Promise<boolean> {
  const post = await prisma.post.findFirst({
    where: { id: input.postId, userId: input.userId },
    select: { currentState: true },
  });
  if (post?.currentState !== "SCHEDULED") {
    return false;
  }

  await prisma.$transaction(async (tx) => {
    await tx.post.update({
      where: { id: input.postId, userId: input.userId },
      data: {
        scheduledAtUtc: null,
        signingState: "invalidated",
        signedEvent: Prisma.DbNull,
        nostrEvent: Prisma.DbNull,
        signedChildEventId: null,
      },
    });
    await tx.postStateTransition.create({
      data: {
        postId: input.postId,
        fromState: post.currentState,
        toState: "CANCELLED",
        reason: input.reason,
      },
    });
    await tx.post.update({
      where: { id: input.postId, userId: input.userId },
      data: { currentState: "CANCELLED" },
    });
  });

  await cancelPostJob(input.postId);
  return true;
}

export async function cascadeCancelAttachedFollowups(input: {
  rootPostId: string;
  userId: string;
  targetState: "CANCELLED" | "DRAFT";
  reason: string;
}): Promise<string[]> {
  const descendantIds = await prisma.$transaction(async (tx) => {
    const descendants = await collectAttachedDescendants(
      tx,
      input.rootPostId,
      input.userId
    );
    if (descendants.length === 0) return [] as string[];

    const ids = descendants.map((item) => item.id);
    await tx.post.updateMany({
      where: { userId: input.userId, id: { in: ids } },
      data: {
        scheduledAtUtc: null,
        signingState: "invalidated",
        signedEvent: Prisma.DbNull,
        nostrEvent: Prisma.DbNull,
        signedChildEventId: null,
      },
    });
    await tx.postStateTransition.createMany({
      data: descendants.map((node) => ({
        postId: node.id,
        fromState: node.currentState,
        toState: input.targetState,
        reason: input.reason,
      })),
    });
    await tx.post.updateMany({
      where: { userId: input.userId, id: { in: ids } },
      data: { currentState: input.targetState },
    });
    return ids;
  });

  await Promise.all(descendantIds.map((id) => cancelPostJob(id)));
  return descendantIds;
}

export async function cascadeAttachedReschedule(input: {
  rootPostId: string;
  userId: string;
  parentScheduledAtUtc: Date;
}): Promise<string[]> {
  return prisma.$transaction(async (tx) => {
    const descendants = await collectAttachedDescendants(
      tx,
      input.rootPostId,
      input.userId
    );
    if (descendants.length === 0) return [];

    const scheduleById = new Map<string, Date>();
    scheduleById.set(input.rootPostId, input.parentScheduledAtUtc);

    for (const node of descendants) {
      const parentTime =
        (node.parentScheduledActionId
          ? scheduleById.get(node.parentScheduledActionId)
          : null) ?? input.parentScheduledAtUtc;
      const existingTime = node.scheduledAtUtc ?? parentTime;
      let nextTime = existingTime;

      if (node.followUpTimingMode === "offset_from_parent") {
        const offsetSeconds = node.followUpOffsetSeconds ?? 0;
        nextTime = new Date(parentTime.getTime() + offsetSeconds * 1000);
      } else if (existingTime < parentTime) {
        nextTime = parentTime;
      }

      if (nextTime < parentTime) {
        nextTime = parentTime;
      }

      scheduleById.set(node.id, nextTime);
      await tx.post.update({
        where: { id: node.id, userId: input.userId },
        data: {
          scheduledAtUtc: nextTime,
          signingState: "stale",
        },
      });
    }

    return descendants.map((node) => node.id);
  });
}

export async function resyncAttachedChildrenAfterParentMutation(input: {
  parentPostId: string;
  userId: string;
  parentPredictedEventId: string | null;
}): Promise<string[]> {
  const directChildren = await prisma.post.findMany({
    where: {
      userId: input.userId,
      dependencyMode: "attached",
      parentScheduledActionId: input.parentPostId,
    },
    select: { id: true, signedEvent: true },
  });

  if (directChildren.length === 0) return [];

  await prisma.$transaction(async (tx) => {
    for (const child of directChildren) {
      const hasSignedPayload =
        child.signedEvent != null &&
        typeof child.signedEvent === "object" &&
        !Array.isArray(child.signedEvent);
      await tx.post.update({
        where: { id: child.id, userId: input.userId },
        data: {
          expectedParentEventId: input.parentPredictedEventId,
          signingState:
            input.parentPredictedEventId && hasSignedPayload
              ? "stale"
              : "invalidated",
        },
      });
    }
  });

  return directChildren.map((child) => child.id);
}
