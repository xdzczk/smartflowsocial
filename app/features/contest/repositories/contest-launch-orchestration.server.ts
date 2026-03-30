/**
 * Linked launch flow: source post publish + contest activation ordering.
 */
import type {
  ContestActivationOrchestrationStatus,
  ContestOrchestrationLaunchMode,
  ContestOrchestrationSourceMode,
  ContestSourcePostPublishStatus,
} from "@prisma/client";

import { toSignedEvent } from "~/features/posts/queue-payload.server";
import { getPostById } from "~/features/posts/server";
import { cancelPostJob, enqueuePostJob } from "~/infra/queue";
import { prisma } from "~/lib/prisma.server";

import {
  appendContestEventLog,
  getContestById,
  launchContest,
} from "../contest-actions.server";

const SCHEDULED_HUB_ORCH_STATUSES = [
  "scheduled",
  "activating",
  "failed",
  "blocked_by_source_failure",
] as const;

const DEFAULT_LAUNCH_FAILED_MESSAGE = "Launch failed";

export async function upsertContestLaunchOrchestration(input: {
  userId: string;
  contestId: string;
  sourceMode: ContestOrchestrationSourceMode;
  launchMode: ContestOrchestrationLaunchMode;
  scheduledFor: Date | null;
  existingSourcePostId: string | null;
  sourcePostId: string | null;
  sourcePostPublishStatus: ContestSourcePostPublishStatus;
  contestActivationStatus: ContestActivationOrchestrationStatus;
  idempotencyKey?: string | null;
}): Promise<void> {
  await prisma.contestLaunchOrchestration.upsert({
    where: { contestId: input.contestId },
    create: {
      userId: input.userId,
      contestId: input.contestId,
      sourceMode: input.sourceMode,
      launchMode: input.launchMode,
      scheduledFor: input.scheduledFor,
      existingSourcePostId: input.existingSourcePostId,
      sourcePostId: input.sourcePostId,
      sourcePostPublishStatus: input.sourcePostPublishStatus,
      contestActivationStatus: input.contestActivationStatus,
      idempotencyKey: input.idempotencyKey ?? undefined,
    },
    update: {
      sourceMode: input.sourceMode,
      launchMode: input.launchMode,
      scheduledFor: input.scheduledFor,
      existingSourcePostId: input.existingSourcePostId,
      sourcePostId: input.sourcePostId,
      sourcePostPublishStatus: input.sourcePostPublishStatus,
      contestActivationStatus: input.contestActivationStatus,
      ...(input.idempotencyKey != null
        ? { idempotencyKey: input.idempotencyKey }
        : {}),
    },
  });
}

export async function findOrchestrationByContestId(contestId: string) {
  return prisma.contestLaunchOrchestration.findUnique({
    where: { contestId },
  });
}

export async function findOrchestrationBySourcePostId(sourcePostId: string) {
  return prisma.contestLaunchOrchestration.findFirst({
    where: { sourcePostId },
  });
}

/**
 * After a scheduled (or immediate) source post publishes, activate the linked contest if applicable.
 */
export async function maybeActivateContestAfterSourcePostPublish(input: {
  postId: string;
  userId: string;
  publishedEventId: string;
}): Promise<{ activated: boolean; contestId?: string }> {
  const orch = await prisma.contestLaunchOrchestration.findFirst({
    where: {
      sourcePostId: input.postId,
      userId: input.userId,
      sourceMode: "new_post",
    },
    include: { contest: true },
  });
  if (!orch) return { activated: false };

  if (orch.contestActivationStatus === "active") {
    return { activated: false, contestId: orch.contestId };
  }

  const contest = orch.contest;
  if (contest.userId !== input.userId) return { activated: false };

  try {
    await prisma.$transaction(async (tx) => {
      await tx.contest.update({
        where: { id: contest.id },
        data: {
          sourceNoteId: input.publishedEventId,
          sourcePostId: input.postId,
        },
      });
      await tx.contestLaunchOrchestration.update({
        where: { id: orch.id },
        data: {
          sourcePostPublishStatus: "published",
          publishedSourceEventId: input.publishedEventId,
          contestActivationStatus: "activating",
        },
      });
    });

    const launched = await launchContest(input.userId, contest.id);
    if (!launched.success) {
      await prisma.contestLaunchOrchestration.update({
        where: { id: orch.id },
        data: {
          contestActivationStatus: "failed",
          lastErrorCode: "launch_failed",
          lastErrorMessage: launched.error ?? DEFAULT_LAUNCH_FAILED_MESSAGE,
        },
      });
      return { activated: false, contestId: contest.id };
    }

    await prisma.contestLaunchOrchestration.update({
      where: { id: orch.id },
      data: {
        contestActivationStatus: "active",
      },
    });
    return { activated: true, contestId: contest.id };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await prisma.contestLaunchOrchestration.update({
      where: { id: orch.id },
      data: {
        contestActivationStatus: "failed",
        lastErrorCode: "activation_error",
        lastErrorMessage: msg,
      },
    });
    return { activated: false, contestId: contest.id };
  }
}

/**
 * Cron/post-checker: launch contests that used an existing published post and were scheduled.
 */
export async function processDueScheduledContestLaunches(): Promise<{
  processed: number;
}> {
  const now = new Date();
  const rows = await prisma.contestLaunchOrchestration.findMany({
    where: {
      launchMode: "schedule",
      sourceMode: "existing_post",
      contestActivationStatus: "scheduled",
      scheduledFor: { lte: now },
    },
    include: { contest: true },
  });

  let processed = 0;
  for (const orch of rows) {
    const contest = orch.contest;
    if (contest.status !== "SCHEDULED_LAUNCH") continue;

    const sourcePost = contest.sourcePostId
      ? await getPostById({ id: contest.sourcePostId, userId: orch.userId })
      : null;
    const noteId = sourcePost?.nostrEventId?.trim() ?? "";
    if (!sourcePost || !noteId) {
      await prisma.contestLaunchOrchestration.update({
        where: { id: orch.id },
        data: {
          contestActivationStatus: "failed",
          lastErrorCode: "source_missing",
          lastErrorMessage:
            "Source post missing or unpublished at scheduled time.",
        },
      });
      continue;
    }

    if (contest.sourceNoteId !== noteId) {
      await prisma.contest.update({
        where: { id: contest.id },
        data: { sourceNoteId: noteId },
      });
    }

    await prisma.contestLaunchOrchestration.update({
      where: { id: orch.id },
      data: { contestActivationStatus: "activating" },
    });

    const launched = await launchContest(orch.userId, contest.id);
    if (launched.success) {
      await prisma.contestLaunchOrchestration.update({
        where: { id: orch.id },
        data: {
          contestActivationStatus: "active",
          sourcePostPublishStatus: "not_needed",
        },
      });
      processed++;
    } else {
      await prisma.contestLaunchOrchestration.update({
        where: { id: orch.id },
        data: {
          contestActivationStatus: "failed",
          lastErrorCode: "launch_failed",
          lastErrorMessage: launched.error ?? DEFAULT_LAUNCH_FAILED_MESSAGE,
        },
      });
    }
  }

  return { processed };
}

export async function markSourcePublishFailed(
  contestId: string,
  message: string
) {
  await prisma.contestLaunchOrchestration.updateMany({
    where: { contestId },
    data: {
      sourcePostPublishStatus: "failed",
      contestActivationStatus: "blocked_by_source_failure",
      lastErrorCode: "source_publish_failed",
      lastErrorMessage: message,
    },
  });
}

/**
 * Retry launch after a failed / blocked orchestration: sync source note from the linked post when possible, then launch.
 */
export async function retryContestLaunchOrchestration(
  userId: string,
  contestId: string
): Promise<{ success: boolean; error?: string }> {
  const contest = await getContestById(contestId, userId);
  if (!contest) return { success: false, error: "Contest not found" };
  const orch = await findOrchestrationByContestId(contestId);
  if (!orch)
    return {
      success: false,
      error: "No launch orchestration for this contest",
    };

  if (contest.status !== "DRAFT" && contest.status !== "SCHEDULED_LAUNCH") {
    return {
      success: false,
      error: "Contest is not in a recoverable pre-launch state",
    };
  }

  const postId = orch.sourcePostId ?? contest.sourcePostId ?? undefined;
  if (postId) {
    const post = await getPostById({ id: postId, userId });
    const noteId = post?.nostrEventId?.trim() ?? "";
    if (noteId) {
      await prisma.contest.update({
        where: { id: contestId },
        data: { sourceNoteId: noteId, sourcePostId: postId },
      });
      await prisma.contestLaunchOrchestration.update({
        where: { id: orch.id },
        data: {
          sourcePostPublishStatus: "published",
          publishedSourceEventId: noteId,
          lastErrorCode: null,
          lastErrorMessage: null,
        },
      });
    }
  }

  const fresh = await getContestById(contestId, userId);
  const noteReady = fresh?.sourceNoteId?.trim() ?? "";
  if (!noteReady) {
    return {
      success: false,
      error:
        "Source note is not available yet. Publish or fix the source post, then try again.",
    };
  }

  await prisma.contestLaunchOrchestration.update({
    where: { id: orch.id },
    data: {
      contestActivationStatus: "activating",
      lastErrorCode: null,
      lastErrorMessage: null,
    },
  });

  const launched = await launchContest(userId, contestId);
  if (!launched.success) {
    await prisma.contestLaunchOrchestration.update({
      where: { id: orch.id },
      data: {
        contestActivationStatus: "failed",
        lastErrorCode: "launch_failed",
        lastErrorMessage: launched.error ?? DEFAULT_LAUNCH_FAILED_MESSAGE,
      },
    });
    return launched;
  }

  await prisma.contestLaunchOrchestration.update({
    where: { id: orch.id },
    data: { contestActivationStatus: "active" },
  });

  await appendContestEventLog(
    userId,
    contestId,
    "contest_launch_retry",
    "Contest launched after retry"
  );

  return { success: true };
}

/**
 * Move a scheduled contest launch (and linked scheduled post when source is new_post) to a new time.
 */
export async function rescheduleContestLaunchOrchestration(
  userId: string,
  contestId: string,
  scheduledFor: Date
): Promise<{ success: boolean; error?: string }> {
  if (scheduledFor.getTime() <= Date.now()) {
    return { success: false, error: "Pick a time in the future." };
  }
  const contest = await getContestById(contestId, userId);
  if (!contest) return { success: false, error: "Contest not found" };
  if (contest.status !== "SCHEDULED_LAUNCH") {
    return {
      success: false,
      error: "Only scheduled-launch contests can be rescheduled here.",
    };
  }
  const orch = await findOrchestrationByContestId(contestId);
  if (orch?.launchMode !== "schedule") {
    return { success: false, error: "Not a scheduled launch." };
  }

  await prisma.contestLaunchOrchestration.update({
    where: { id: orch.id },
    data: {
      scheduledFor,
      contestActivationStatus: "scheduled",
      lastErrorCode: null,
      lastErrorMessage: null,
    },
  });

  await prisma.contest.update({
    where: { id: contestId },
    data: { contestStartAt: scheduledFor },
  });

  if (orch.sourceMode === "new_post" && orch.sourcePostId) {
    const post = await getPostById({ id: orch.sourcePostId, userId });
    if (!post) {
      return { success: false, error: "Source post not found." };
    }
    if (post.currentState === "SCHEDULED") {
      const signed = toSignedEvent(post.signedEvent);
      await prisma.post.update({
        where: { id: orch.sourcePostId, userId },
        data: { scheduledAtUtc: scheduledFor, updatedAt: new Date() },
      });
      if (signed) {
        await cancelPostJob(orch.sourcePostId);
        const unix = Math.floor(scheduledFor.getTime() / 1000);
        await enqueuePostJob(orch.sourcePostId, userId, signed, unix);
      }
    }
  }

  await appendContestEventLog(
    userId,
    contestId,
    "contest_launch_rescheduled",
    `Scheduled launch moved to ${scheduledFor.toISOString()}`
  );

  return { success: true };
}

export interface ScheduledContestLaunchRow {
  id: string;
  contestId: string;
  title: string;
  scheduledFor: string | null;
  sourceMode: string;
  contestActivationStatus: string;
}

/** Upcoming scheduled contest activations (dashboard Scheduled hub). */
export async function getScheduledContestLaunchesForUser(
  userId: string,
  options?: { fromUtc?: Date; toUtc?: Date }
): Promise<ScheduledContestLaunchRow[]> {
  const scheduledForFilter: { gte?: Date; lte?: Date } = {};
  if (options?.fromUtc) scheduledForFilter.gte = options.fromUtc;
  if (options?.toUtc) scheduledForFilter.lte = options.toUtc;

  const rows = await prisma.contestLaunchOrchestration.findMany({
    where: {
      userId,
      launchMode: "schedule",
      contest: { status: "SCHEDULED_LAUNCH" },
      contestActivationStatus: {
        in: [...SCHEDULED_HUB_ORCH_STATUSES],
      },
      scheduledFor: {
        not: null,
        ...(Object.keys(scheduledForFilter).length > 0
          ? scheduledForFilter
          : {}),
      },
    },
    include: {
      contest: { select: { id: true, title: true } },
    },
    orderBy: { scheduledFor: "asc" },
  });

  return rows.map((r) => ({
    id: r.id,
    contestId: r.contestId,
    // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing -- Empty title should fall back to default label
    title: r.contest.title?.trim() || `Contest ${r.contestId.slice(0, 8)}`,
    scheduledFor: r.scheduledFor?.toISOString() ?? null,
    sourceMode: r.sourceMode,
    contestActivationStatus: r.contestActivationStatus,
  }));
}
