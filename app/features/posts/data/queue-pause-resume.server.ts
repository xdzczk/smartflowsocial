import { Prisma } from "@prisma/client";

import { loadNeedsResignItemsForQueue } from "~/features/posts/data/queue-needs-resign.server";
import { ScheduleLongFormPostUseCase } from "~/features/posts/longform/use-cases/schedule-longform-post.use-case.server";
import { toSignedEvent } from "~/features/posts/queue-payload.server";
import {
  convertPrismaQueueTypeToQueueType,
  type QueueType,
} from "~/features/posts/types";
import { getUserTimezone } from "~/features/user";
import { cancelLongFormPostJob, cancelPostJob } from "~/infra/queue";
import { prisma } from "~/lib/prisma.server";
import { fromDate } from "~/lib/temporal";

import { cascadeAttachedReschedule } from "../scheduling/services/attached-followups.server";
import { calculateNextScheduleTime } from "../scheduling/services/schedulers";
import { SchedulePostUseCase } from "../scheduling/use-cases/schedule-post.use-case.server";

type QueueRow = Awaited<
  ReturnType<
    typeof prisma.queueType.findFirst<{
      where: { id: string; userId: string };
    }>
  >
>;

function requireQueue(queue: QueueRow): NonNullable<QueueRow> {
  if (!queue) {
    throw new Error("Queue type not found");
  }
  return queue;
}

function queueSortDate(item: {
  queueHeldOriginalScheduledAtUtc: Date | null;
  nominalScheduledAtUtc: Date | null;
  scheduledAtUtc: Date | null;
  createdAt: Date;
}): number {
  return (
    item.queueHeldOriginalScheduledAtUtc?.getTime() ??
    item.nominalScheduledAtUtc?.getTime() ??
    item.scheduledAtUtc?.getTime() ??
    item.createdAt.getTime()
  );
}

function canReuseSignatureAtSameTime(
  currentScheduledAtUtc: Date | null,
  nextScheduledAtUtc: Date,
  signedEvent: Prisma.JsonValue | null
): boolean {
  return (
    currentScheduledAtUtc?.getTime() === nextScheduledAtUtc.getTime() &&
    toSignedEvent(signedEvent) != null
  );
}

/** Milliseconds the scheduler may drift when probing just before a candidate instant. */
const CADENCE_MATCH_TOLERANCE_MS = 2_000;

/**
 * Returns true when `candidate` is still the next cadence-aligned slot after a probe
 * immediately before it (same logic as picking that slot first vs advancing from now).
 */
async function candidateMatchesQueueCadence(params: {
  queueType: QueueType;
  userId: string;
  userTimezone: string;
  candidate: Date;
}): Promise<boolean> {
  const probe = new Date(
    params.candidate.getTime() - CADENCE_MATCH_TOLERANCE_MS
  );
  const next = await calculateNextScheduleTime({
    queueType: params.queueType,
    userId: params.userId,
    userTimezone: params.userTimezone,
    baseTime: probe,
  });
  return (
    Math.abs(next.getTime() - params.candidate.getTime()) <=
    CADENCE_MATCH_TOLERANCE_MS
  );
}

function originalScheduledIntentUtc(row: {
  scheduledAtUtc: Date | null;
  nominalScheduledAtUtc: Date | null;
  queueHeldOriginalScheduledAtUtc: Date | null;
}): Date | null {
  return (
    row.scheduledAtUtc ??
    row.queueHeldOriginalScheduledAtUtc ??
    row.nominalScheduledAtUtc ??
    null
  );
}

export async function pauseQueueById(params: {
  userId: string;
  queueTypeId: string;
}) {
  const { userId, queueTypeId } = params;
  requireQueue(
    await prisma.queueType.findFirst({
      where: { id: queueTypeId, userId },
    })
  );

  const now = new Date();
  const [posts, longFormPosts] = await Promise.all([
    prisma.post.findMany({
      where: {
        userId,
        queueTypeId,
        currentState: "SCHEDULED",
        scheduledAtUtc: { gt: now },
        queueHoldStatus: "NONE",
      },
      select: {
        id: true,
        scheduledAtUtc: true,
        nominalScheduledAtUtc: true,
      },
      orderBy: [{ scheduledAtUtc: "asc" }, { createdAt: "asc" }],
    }),
    prisma.longFormPost.findMany({
      where: {
        userId,
        queueTypeId,
        currentState: "SCHEDULED",
        scheduledAtUtc: { gt: now },
        queueHoldStatus: "NONE",
      },
      select: {
        id: true,
        scheduledAtUtc: true,
        nominalScheduledAtUtc: true,
      },
      orderBy: [{ scheduledAtUtc: "asc" }, { createdAt: "asc" }],
    }),
  ]);

  const updatedQueue = await prisma.$transaction(async (tx) => {
    const nextQueue = await tx.queueType.update({
      where: { id: queueTypeId, userId },
      data: {
        status: "PAUSED",
        isEnabled: true,
      },
    });

    for (const post of posts) {
      await tx.post.update({
        where: { id: post.id, userId },
        data: {
          queueHoldStatus: "HELD_BY_QUEUE",
          queueHeldAtUtc: now,
          queueHeldOriginalScheduledAtUtc:
            post.nominalScheduledAtUtc ?? post.scheduledAtUtc,
          queueHeldByQueueTypeId: queueTypeId,
          enqueueIdempotencyKey: null,
        },
      });
    }

    for (const post of longFormPosts) {
      await tx.longFormPost.update({
        where: { id: post.id, userId },
        data: {
          queueHoldStatus: "HELD_BY_QUEUE",
          queueHeldAtUtc: now,
          queueHeldOriginalScheduledAtUtc:
            post.nominalScheduledAtUtc ?? post.scheduledAtUtc,
          queueHeldByQueueTypeId: queueTypeId,
          enqueueIdempotencyKey: null,
        },
      });
    }

    if (posts.length > 0) {
      await tx.outboxEvent.deleteMany({
        where: {
          eventType: "POST_SCHEDULED",
          aggregateType: "Post",
          aggregateId: { in: posts.map((post) => post.id) },
          processedAt: null,
          deadLetteredAt: null,
          processingLockId: null,
        },
      });
    }

    if (longFormPosts.length > 0) {
      await tx.outboxEvent.deleteMany({
        where: {
          eventType: "LONGFORM_SCHEDULED",
          aggregateType: "LongFormPost",
          aggregateId: { in: longFormPosts.map((post) => post.id) },
          processedAt: null,
          deadLetteredAt: null,
          processingLockId: null,
        },
      });
    }

    return nextQueue;
  });

  await Promise.allSettled([
    ...posts.map((post) => cancelPostJob(post.id)),
    ...longFormPosts.map((post) => cancelLongFormPostJob(post.id)),
  ]);

  return {
    queue: updatedQueue,
    pausedPostCount: posts.length,
    pausedLongFormCount: longFormPosts.length,
  };
}

export async function resumeQueueById(params: {
  userId: string;
  queueTypeId: string;
}) {
  const { userId, queueTypeId } = params;
  const queue = requireQueue(
    await prisma.queueType.findFirst({
      where: { id: queueTypeId, userId },
    })
  );
  const queueForScheduling = convertPrismaQueueTypeToQueueType(queue);
  if (!queueForScheduling) {
    throw new Error("Queue type could not be normalized");
  }

  const [posts, longFormPosts, userTimezoneRaw] = await Promise.all([
    prisma.post.findMany({
      where: {
        userId,
        queueTypeId,
        currentState: "SCHEDULED",
        queueHoldStatus: "HELD_BY_QUEUE",
      },
      select: {
        id: true,
        userId: true,
        scheduledAtUtc: true,
        nominalScheduledAtUtc: true,
        queueHeldOriginalScheduledAtUtc: true,
        createdAt: true,
        signedEvent: true,
        dependencyMode: true,
        parentScheduledActionId: true,
      },
    }),
    prisma.longFormPost.findMany({
      where: {
        userId,
        queueTypeId,
        currentState: "SCHEDULED",
        queueHoldStatus: "HELD_BY_QUEUE",
      },
      select: {
        id: true,
        userId: true,
        scheduledAtUtc: true,
        nominalScheduledAtUtc: true,
        queueHeldOriginalScheduledAtUtc: true,
        createdAt: true,
        signedEvent: true,
      },
    }),
    getUserTimezone(userId),
  ]);

  const updatedQueue = await prisma.queueType.update({
    where: { id: queueTypeId, userId },
    data: {
      status: "ACTIVE",
      isEnabled: true,
    },
  });

  const orderedItems = [
    ...posts
      .filter((post) => {
        if (post.dependencyMode !== "attached") return true;
        return (
          post.parentScheduledActionId == null ||
          !posts.some(
            (candidate) => candidate.id === post.parentScheduledActionId
          )
        );
      })
      .map((post) => ({ kind: "post" as const, row: post })),
    ...longFormPosts.map((post) => ({ kind: "longform" as const, row: post })),
  ].sort((a, b) => {
    const diff = queueSortDate(a.row) - queueSortDate(b.row);
    if (diff !== 0) return diff;
    if (a.row.createdAt.getTime() !== b.row.createdAt.getTime()) {
      return a.row.createdAt.getTime() - b.row.createdAt.getTime();
    }
    return a.row.id.localeCompare(b.row.id);
  });

  const resumeAnchor = new Date();
  let cursorBase = resumeAnchor;
  const userTimezone = userTimezoneRaw ?? "UTC";
  const postScheduleUseCase = new SchedulePostUseCase();
  const longFormScheduleUseCase = new ScheduleLongFormPostUseCase();
  let resumedCount = 0;

  const markAttachedDescendantsForResign = async (
    rootPostId: string,
    parentScheduledAtUtc: Date
  ) => {
    const descendantIds = await cascadeAttachedReschedule({
      rootPostId,
      userId,
      parentScheduledAtUtc,
    });
    if (descendantIds.length === 0) return 0;
    await prisma.post.updateMany({
      where: { userId, id: { in: descendantIds } },
      data: {
        queueHoldStatus: "NEEDS_RESIGN_AFTER_QUEUE_RESUME",
        queueHeldAtUtc: null,
        queueHeldOriginalScheduledAtUtc: null,
        queueHeldByQueueTypeId: queueTypeId,
        signedEvent: Prisma.DbNull,
        nostrEvent: Prisma.DbNull,
        nostrEventId: null,
        enqueueIdempotencyKey: null,
        signedChildEventId: null,
        expectedParentEventId: null,
        signingState: "stale",
      },
    });
    return descendantIds.length;
  };

  if (orderedItems.length > 0) {
    await prisma.$transaction(async (tx) => {
      await tx.outboxEvent.deleteMany({
        where: {
          OR: [
            {
              eventType: "POST_SCHEDULED",
              aggregateType: "Post",
              aggregateId: { in: posts.map((post) => post.id) },
              processedAt: null,
              deadLetteredAt: null,
            },
            {
              eventType: "LONGFORM_SCHEDULED",
              aggregateType: "LongFormPost",
              aggregateId: { in: longFormPosts.map((post) => post.id) },
              processedAt: null,
              deadLetteredAt: null,
            },
          ],
        },
      });
    });
  }

  for (const item of orderedItems) {
    const row = item.row;
    const earliestAllowed = new Date(
      Math.max(resumeAnchor.getTime(), cursorBase.getTime())
    );
    const originalIntent = originalScheduledIntentUtc(row);

    let nextScheduledAtUtc: Date;

    const canReuseAtOriginalTime =
      originalIntent != null &&
      originalIntent.getTime() >= earliestAllowed.getTime() &&
      canReuseSignatureAtSameTime(
        row.scheduledAtUtc,
        originalIntent,
        row.signedEvent
      );

    if (canReuseAtOriginalTime) {
      const stillOnCadence = await candidateMatchesQueueCadence({
        queueType: queueForScheduling,
        userId,
        userTimezone,
        candidate: originalIntent,
      });
      nextScheduledAtUtc = stillOnCadence
        ? originalIntent
        : await calculateNextScheduleTime({
            queueType: queueForScheduling,
            userId,
            userTimezone,
            baseTime: cursorBase,
          });
    } else {
      nextScheduledAtUtc = await calculateNextScheduleTime({
        queueType: queueForScheduling,
        userId,
        userTimezone,
        baseTime: cursorBase,
      });
    }

    cursorBase = new Date(nextScheduledAtUtc.getTime() + 1000);

    const signedEvent = toSignedEvent(item.row.signedEvent);
    const shouldReuseSignature = canReuseSignatureAtSameTime(
      item.row.scheduledAtUtc,
      nextScheduledAtUtc,
      item.row.signedEvent
    );

    if (item.kind === "post" && signedEvent && shouldReuseSignature) {
      const scheduledAtUtc = fromDate(nextScheduledAtUtc, "UTC");
      await postScheduleUseCase.execute({
        postId: item.row.id,
        userId,
        scheduledAtUtc,
        nominalScheduledAtUtc: scheduledAtUtc,
        signedEvent,
      });
      await prisma.post.update({
        where: { id: item.row.id, userId },
        data: {
          queueHoldStatus: "NONE",
          queueHeldAtUtc: null,
          queueHeldOriginalScheduledAtUtc: null,
          queueHeldByQueueTypeId: null,
        },
      });
      resumedCount++;
      await markAttachedDescendantsForResign(item.row.id, nextScheduledAtUtc);
      continue;
    }

    if (item.kind === "longform" && signedEvent && shouldReuseSignature) {
      const scheduledAtUtc = fromDate(nextScheduledAtUtc, "UTC");
      await longFormScheduleUseCase.execute({
        postId: item.row.id,
        userId,
        scheduledAtUtc,
        nominalScheduledAtUtc: scheduledAtUtc,
        signedEvent,
      });
      await prisma.longFormPost.update({
        where: { id: item.row.id, userId },
        data: {
          queueHoldStatus: "NONE",
          queueHeldAtUtc: null,
          queueHeldOriginalScheduledAtUtc: null,
          queueHeldByQueueTypeId: null,
        },
      });
      resumedCount++;
      continue;
    }

    if (item.kind === "post") {
      await prisma.post.update({
        where: { id: item.row.id, userId },
        data: {
          scheduledAtUtc: nextScheduledAtUtc,
          nominalScheduledAtUtc: nextScheduledAtUtc,
          signedEvent: Prisma.DbNull,
          nostrEvent: Prisma.DbNull,
          nostrEventId: null,
          enqueueIdempotencyKey: null,
          queueHoldStatus: "NEEDS_RESIGN_AFTER_QUEUE_RESUME",
          queueHeldAtUtc: null,
          queueHeldOriginalScheduledAtUtc: nextScheduledAtUtc,
          queueHeldByQueueTypeId: queueTypeId,
        },
      });
      await markAttachedDescendantsForResign(item.row.id, nextScheduledAtUtc);
      continue;
    }

    await prisma.longFormPost.update({
      where: { id: item.row.id, userId },
      data: {
        scheduledAtUtc: nextScheduledAtUtc,
        nominalScheduledAtUtc: nextScheduledAtUtc,
        signedEvent: Prisma.DbNull,
        nostrEvent: Prisma.DbNull,
        nostrEventId: null,
        enqueueIdempotencyKey: null,
        queueHoldStatus: "NEEDS_RESIGN_AFTER_QUEUE_RESUME",
        queueHeldAtUtc: null,
        queueHeldOriginalScheduledAtUtc: nextScheduledAtUtc,
        queueHeldByQueueTypeId: queueTypeId,
      },
    });
  }

  /** Same pipeline as GET /api/queue-needs-resign — avoids mismatch vs raw prisma counts. */
  const needsResignSnapshot = await loadNeedsResignItemsForQueue(
    userId,
    queueTypeId
  );
  const needsResignCount =
    "error" in needsResignSnapshot ? 0 : needsResignSnapshot.items.length;

  return {
    queue: updatedQueue,
    resumedCount,
    needsResignCount,
  };
}
