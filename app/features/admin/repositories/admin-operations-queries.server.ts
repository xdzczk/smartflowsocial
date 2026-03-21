/**
 * Failures, dead letters, and queue-focused data for Admin Operations tab.
 */

import { ReferralEarningStatus } from "@prisma/client";

import { getOutboxBacklogCounts } from "~/infra/outbox/outbox.server";
import { getQueueInstance } from "~/infra/queue/queue-client.server";
import type { QueueType } from "~/infra/queue/queue-types";
import { prisma } from "~/lib/prisma.server";

import type { RangePreset } from "../metrics/date-range";
import { getBoundsForPreset } from "../metrics/date-range";

export interface FailedPostRow {
  id: string;
  kind: "short" | "long";
  userId: string;
  npub: string;
  updatedAt: string;
  reason: string;
}

export interface DeadLetterRow {
  id: string;
  queueType: string;
  jobId: string;
  error: string;
  createdAt: string;
  postId: string | null;
}

export interface QueueDepthRow {
  queue: QueueType;
  waiting: number;
  active: number;
  failed: number;
  delayed: number;
}

export interface AdminOperationsPageDTO {
  rangePreset: RangePreset;
  generatedAt: string;
  failedPosts: FailedPostRow[];
  deadLetters: DeadLetterRow[];
  failedPayouts: Array<{
    id: string;
    referrerNpub: string;
    commissionSats: number;
    payoutFailureReason: string | null;
    createdAt: string;
  }>;
  queueDepths: QueueDepthRow[];
  queueError: string | null;
  outbox: {
    pending: number;
    ready: number;
    deadLettered: number;
  } | null;
}

const QUEUES: QueueType[] = [
  "scheduled-posts",
  "scheduled-longform-posts",
  "post-checker",
];

export async function getAdminOperationsPageData(
  preset: RangePreset,
  now: Date = new Date()
): Promise<AdminOperationsPageDTO> {
  const { from, to } = getBoundsForPreset(preset, now);

  const [shortFailed, longFailed, deadLetters, failedPayouts] =
    await Promise.all([
      prisma.post.findMany({
        where: {
          currentState: "FAILED",
          updatedAt: { gte: from, lt: to },
        },
        orderBy: { updatedAt: "desc" },
        take: 100,
        select: {
          id: true,
          userId: true,
          updatedAt: true,
          user: { select: { npub: true } },
          stateTransitions: {
            orderBy: { createdAt: "desc" },
            take: 1,
            select: { reason: true },
          },
        },
      }),
      prisma.longFormPost.findMany({
        where: {
          currentState: "FAILED",
          updatedAt: { gte: from, lt: to },
        },
        orderBy: { updatedAt: "desc" },
        take: 100,
        select: {
          id: true,
          userId: true,
          updatedAt: true,
          user: { select: { npub: true } },
          stateTransitions: {
            orderBy: { createdAt: "desc" },
            take: 1,
            select: { reason: true },
          },
        },
      }),
      prisma.deadLetterJob.findMany({
        where: { createdAt: { gte: from, lt: to } },
        orderBy: { createdAt: "desc" },
        take: 100,
      }),
      prisma.referralEarning.findMany({
        where: {
          status: ReferralEarningStatus.FAILED,
          createdAt: { gte: from, lt: to },
        },
        orderBy: { createdAt: "desc" },
        take: 50,
        select: {
          id: true,
          referrerNpub: true,
          commissionSats: true,
          payoutFailureReason: true,
          createdAt: true,
        },
      }),
    ]);

  const failedPosts: FailedPostRow[] = [
    ...shortFailed.map((p) => ({
      id: p.id,
      kind: "short" as const,
      userId: p.userId,
      npub: p.user.npub,
      updatedAt: p.updatedAt.toISOString(),
      reason: p.stateTransitions[0]?.reason ?? "Unknown",
    })),
    ...longFailed.map((p) => ({
      id: p.id,
      kind: "long" as const,
      userId: p.userId,
      npub: p.user.npub,
      updatedAt: p.updatedAt.toISOString(),
      reason: p.stateTransitions[0]?.reason ?? "Unknown",
    })),
  ].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  const dlRows: DeadLetterRow[] = deadLetters.map((d) => {
    const jobData = d.jobData as { postId?: string } | null;
    return {
      id: d.id,
      queueType: d.queueType,
      jobId: d.jobId,
      error: d.error,
      createdAt: d.createdAt.toISOString(),
      postId: typeof jobData?.postId === "string" ? jobData.postId : null,
    };
  });

  let queueDepths: QueueDepthRow[] = [];
  let queueError: string | null = null;
  try {
    for (const q of QUEUES) {
      const queue = getQueueInstance(q);
      const c = await queue.getJobCounts(
        "waiting",
        "active",
        "failed",
        "delayed"
      );
      queueDepths.push({
        queue: q,
        waiting: c["waiting"] ?? 0,
        active: c["active"] ?? 0,
        failed: c["failed"] ?? 0,
        delayed: c["delayed"] ?? 0,
      });
    }
  } catch (e) {
    queueError = e instanceof Error ? e.message : "Redis unavailable";
    queueDepths = [];
  }

  let outbox: AdminOperationsPageDTO["outbox"] = null;
  try {
    const o = await getOutboxBacklogCounts(now);
    outbox = {
      pending: o.pending,
      ready: o.ready,
      deadLettered: o.deadLettered,
    };
  } catch {
    outbox = null;
  }

  return {
    rangePreset: preset,
    generatedAt: now.toISOString(),
    failedPosts: failedPosts.slice(0, 100),
    deadLetters: dlRows,
    failedPayouts: failedPayouts.map((e) => ({
      id: e.id,
      referrerNpub: e.referrerNpub,
      commissionSats: e.commissionSats,
      payoutFailureReason: e.payoutFailureReason,
      createdAt: e.createdAt.toISOString(),
    })),
    queueDepths,
    queueError,
    outbox,
  };
}
