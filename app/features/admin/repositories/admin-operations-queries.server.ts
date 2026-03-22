/**
 * Failures, dead letters, and queue-focused data for Admin Operations tab.
 */

import { PublishRelayAckStatus, ReferralEarningStatus } from "@prisma/client";

import { getOutboxBacklogCounts } from "~/infra/outbox/outbox.server";
import { getQueueInstance } from "~/infra/queue/queue-client.server";
import type { QueueType } from "~/infra/queue/queue-types";
import { prisma } from "~/lib/prisma.server";

import type { RangePreset } from "../metrics/date-range";
import { getBoundsForPreset } from "../metrics/date-range";
import { PUBLISHING_STUCK_MINUTES } from "../metrics/definitions";

import { getSignerConnectHealthBundle } from "./admin-signer-connect-bundle.server";

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

export interface OperationalSummary {
  headline: string;
  /** Rows surfaced in the tables below (capped). */
  failedPublishSampleCount: number;
  deadLetterSampleCount: number;
  failedPayoutCount: number;
  stuckPublishing: number;
  outboxDeadLettered: number;
  oldestUnresolvedIso: string | null;
  nextStep: string;
}

export interface FailureReasonRollup {
  reason: string;
  count: number;
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
  operationalSummary: OperationalSummary;
  failuresByReason: FailureReasonRollup[];
  relayAcks: {
    accepted: number;
    failed: number;
    ratePct: number | null;
  };
  signerConnect: Awaited<ReturnType<typeof getSignerConnectHealthBundle>>;
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

  const [
    shortFailed,
    longFailed,
    deadLetters,
    failedPayouts,
    stuckPublishing,
    relayAgg,
  ] = await Promise.all([
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
    prisma.post.count({
      where: {
        currentState: "PUBLISHING",
        OR: [
          {
            publishingStartedAt: {
              lt: new Date(
                now.getTime() - PUBLISHING_STUCK_MINUTES * 60 * 1000
              ),
            },
          },
          {
            AND: [
              { publishingStartedAt: null },
              {
                updatedAt: {
                  lt: new Date(
                    now.getTime() - PUBLISHING_STUCK_MINUTES * 60 * 1000
                  ),
                },
              },
            ],
          },
        ],
      },
    }),
    prisma.publishRelayAck.groupBy({
      by: ["status"],
      where: {
        createdAt: { gte: from, lt: to },
      },
      _count: { _all: true },
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

  const reasonCount = new Map<string, number>();
  for (const p of failedPosts) {
    const r = p.reason.trim() || "Unknown";
    reasonCount.set(r, (reasonCount.get(r) ?? 0) + 1);
  }
  const failuresByReason: FailureReasonRollup[] = [...reasonCount.entries()]
    .map(([reason, count]) => ({ reason, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 12);

  const relayAccepted =
    relayAgg.find((r) => r.status === PublishRelayAckStatus.ACCEPTED)?._count
      ._all ?? 0;
  const relayFailed =
    (relayAgg.find((r) => r.status === PublishRelayAckStatus.FAILED)?._count
      ._all ?? 0) +
    (relayAgg.find((r) => r.status === PublishRelayAckStatus.TIMEOUT)?._count
      ._all ?? 0);
  const relayTotal = relayAccepted + relayFailed;
  const relayRatePct =
    relayTotal === 0
      ? null
      : Math.round((relayAccepted / relayTotal) * 1000) / 10;

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

  const failedPayoutRows = failedPayouts.map((e) => ({
    id: e.id,
    referrerNpub: e.referrerNpub,
    commissionSats: e.commissionSats,
    payoutFailureReason: e.payoutFailureReason,
    createdAt: e.createdAt.toISOString(),
  }));

  const oldestCandidates = [
    ...failedPosts.map((p) => p.updatedAt),
    ...dlRows.map((r) => r.createdAt),
    ...failedPayoutRows.map((e) => e.createdAt),
  ];
  const oldestUnresolvedIso =
    oldestCandidates.length === 0
      ? null
      : oldestCandidates.reduce((a, b) => (a < b ? a : b));

  const queueFailedTotal = queueDepths.reduce((s, q) => s + q.failed, 0);
  const outboxDl = outbox?.deadLettered ?? 0;

  let headline: string;
  if (
    failedPosts.length === 0 &&
    dlRows.length === 0 &&
    failedPayoutRows.length === 0 &&
    stuckPublishing === 0 &&
    outboxDl === 0 &&
    queueFailedTotal === 0
  ) {
    headline =
      "No failed publishes, dead letters, or payout failures in sampled tables — queues look quiet.";
  } else {
    const bits: string[] = [];
    if (stuckPublishing > 0) {
      bits.push(`${stuckPublishing} stuck in publishing`);
    }
    if (outboxDl > 0) {
      bits.push(`${outboxDl} outbox dead-letter row(s)`);
    }
    if (failedPosts.length > 0) {
      bits.push(`${failedPosts.length} failed publish row(s) (sample)`);
    }
    if (dlRows.length > 0) {
      bits.push(`${dlRows.length} dead-letter job(s) (sample)`);
    }
    if (failedPayoutRows.length > 0) {
      bits.push(`${failedPayoutRows.length} failed payout(s)`);
    }
    if (queueFailedTotal > 0) {
      bits.push(`${queueFailedTotal} failed job(s) across Bull queues`);
    }
    headline = bits.join(" · ");
  }

  let nextStep: string;
  if (dlRows.length > 0) {
    nextStep =
      "Start with dead letters: confirm root cause, then replay with scripts/replay-queue-dead-letter.ts when safe.";
  } else if (stuckPublishing > 0) {
    nextStep =
      "Inspect stuck publishing rows in the product DB or retry from the scheduler when the signer/relay issue is resolved.";
  } else if (failedPosts.length > 0) {
    nextStep =
      "Group failures by reason (below), then fix upstream (relay, keys, content) before bulk retry.";
  } else if (failedPayoutRows.length > 0) {
    nextStep =
      "Retry failed referral payouts after verifying LNURL destinations and wallet connectivity.";
  } else {
    nextStep =
      "Keep monitoring queue failed counts; expand range if incidents look intermittent.";
  }

  const operationalSummary: OperationalSummary = {
    headline,
    failedPublishSampleCount: failedPosts.length,
    deadLetterSampleCount: dlRows.length,
    failedPayoutCount: failedPayoutRows.length,
    stuckPublishing,
    outboxDeadLettered: outboxDl,
    oldestUnresolvedIso,
    nextStep,
  };

  const signerConnect = await getSignerConnectHealthBundle({ from, to });

  return {
    rangePreset: preset,
    generatedAt: now.toISOString(),
    failedPosts: failedPosts.slice(0, 100),
    deadLetters: dlRows,
    failedPayouts: failedPayoutRows,
    queueDepths,
    queueError,
    outbox,
    operationalSummary,
    failuresByReason,
    relayAcks: {
      accepted: relayAccepted,
      failed: relayFailed,
      ratePct: relayRatePct,
    },
    signerConnect,
  };
}
