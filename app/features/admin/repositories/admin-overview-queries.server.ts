/**
 * Server-only aggregates for Admin Overview tab (time-ranged).
 */

import {
  ReferralEarningStatus,
  SubscriptionStatus,
  PublishRelayAckStatus,
} from "@prisma/client";

import { getReferrersEligibleForPayout } from "~/features/referral/referral-payout.server";
import { prisma } from "~/lib/prisma.server";

import type { RangePreset } from "../metrics/date-range";
import {
  formatDeltaPercent,
  getBoundsForPreset,
  getPreviousPeriodBounds,
} from "../metrics/date-range";
import { PUBLISHING_STUCK_MINUTES } from "../metrics/definitions";

import { getAdminQueueHealthSnapshot } from "./admin-system-health.server";

export interface AdminAlertItem {
  id: string;
  severity: "warning" | "danger";
  message: string;
  href: string;
}

export interface KpiWithDelta {
  current: number;
  previous: number | null;
  deltaPct: number | null;
}

export interface AdminOverviewPageDTO {
  rangePreset: RangePreset;
  generatedAt: string;
  kpis: {
    activePaidUsers: KpiWithDelta;
    newUsers: KpiWithDelta;
    postsPublished: KpiWithDelta & { short: number; long: number };
    publishSuccessRate: number;
    publishSuccessPrev: number | null;
    pendingPayoutSats: number;
    actionRequiredCount: number;
  };
  alerts: AdminAlertItem[];
  publishing: {
    stateMixShort: Array<{ state: string; count: number }>;
    stateMixLong: Array<{ state: string; count: number }>;
    dailyPublishesShort: Array<{ day: string; count: number }>;
    scheduledQueueDepth: number;
    failedShort: number;
    cancelledShort: number;
    avgPublishLatencyMs: number | null;
  };
  users: {
    activeUsersProxy: number;
    signupsInRange: number;
    avgPostsPerActiveUser: number | null;
  };
  referrals: {
    activeSubscriptions: number;
    referralLinks: number;
    pendingSats: number;
    paidInRangeSats: number;
    batchReadyCount: number;
  };
  systemHealth: Awaited<ReturnType<typeof getAdminQueueHealthSnapshot>>;
}

function dayUtc(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function startOfUtcDay(d: Date): Date {
  const x = new Date(d.getTime());
  x.setUTCHours(0, 0, 0, 0);
  return x;
}

async function countNewUsers(from: Date, to: Date): Promise<number> {
  return prisma.user.count({
    where: { createdAt: { gte: from, lt: to } },
  });
}

async function countPublishedShort(from: Date, to: Date): Promise<number> {
  return prisma.post.count({
    where: {
      currentState: "PUBLISHED",
      publishedAt: { gte: from, lt: to },
    },
  });
}

async function countPublishedLong(from: Date, to: Date): Promise<number> {
  return prisma.longFormPost.count({
    where: {
      currentState: "PUBLISHED",
      publishedAt: { gte: from, lt: to },
    },
  });
}

async function countFailedShortInRange(from: Date, to: Date): Promise<number> {
  return prisma.post.count({
    where: {
      currentState: "FAILED",
      updatedAt: { gte: from, lt: to },
    },
  });
}

async function countFailedLongInRange(from: Date, to: Date): Promise<number> {
  return prisma.longFormPost.count({
    where: {
      currentState: "FAILED",
      updatedAt: { gte: from, lt: to },
    },
  });
}

async function distinctPublishersInRange(
  from: Date,
  to: Date
): Promise<number> {
  const [a, b] = await Promise.all([
    prisma.post.findMany({
      where: {
        currentState: "PUBLISHED",
        publishedAt: { gte: from, lt: to },
      },
      select: { userId: true },
      distinct: ["userId"],
    }),
    prisma.longFormPost.findMany({
      where: {
        currentState: "PUBLISHED",
        publishedAt: { gte: from, lt: to },
      },
      select: { userId: true },
      distinct: ["userId"],
    }),
  ]);
  const set = new Set<string>();
  for (const r of a) set.add(r.userId);
  for (const r of b) set.add(r.userId);
  return set.size;
}

async function avgPublishLatencyShort(
  from: Date,
  to: Date
): Promise<number | null> {
  const rows = await prisma.post.findMany({
    where: {
      currentState: "PUBLISHED",
      publishedAt: { gte: from, lt: to },
      publishingStartedAt: { not: null },
    },
    select: { publishedAt: true, publishingStartedAt: true },
    take: 10_000,
  });
  if (rows.length === 0) return null;
  let sum = 0;
  let n = 0;
  for (const r of rows) {
    if (!r.publishedAt || !r.publishingStartedAt) continue;
    sum += r.publishedAt.getTime() - r.publishingStartedAt.getTime();
    n += 1;
  }
  return n === 0 ? null : Math.round(sum / n);
}

async function dailyPublishCountsShort(
  endDay: Date,
  numDays: number
): Promise<Array<{ day: string; count: number }>> {
  const out: Array<{ day: string; count: number }> = [];
  for (let i = numDays - 1; i >= 0; i--) {
    const day = new Date(endDay.getTime());
    day.setUTCDate(day.getUTCDate() - i);
    const start = startOfUtcDay(day);
    const end = new Date(start.getTime());
    end.setUTCDate(end.getUTCDate() + 1);
    const count = await prisma.post.count({
      where: {
        currentState: "PUBLISHED",
        publishedAt: { gte: start, lt: end },
      },
    });
    out.push({ day: dayUtc(start), count });
  }
  return out;
}

function successRate(published: number, failed: number): number {
  const d = published + failed;
  if (d === 0) return 100;
  return Math.round((published / d) * 1000) / 10;
}

export async function getAdminOverviewPageData(
  preset: RangePreset,
  now: Date = new Date()
): Promise<AdminOverviewPageDTO> {
  const bounds = getBoundsForPreset(preset, now);
  const prevBounds = getPreviousPeriodBounds(bounds, now);

  const [
    activePaidUsers,
    newUsers,
    pubShort,
    pubLong,
    failShort,
    failLong,
    prevNewUsers,
    prevPubShort,
    prevPubLong,
    prevFailShort,
    prevFailLong,
    pendingAgg,
    referralLinkCount,
    paidInRangeAgg,
    postsGrouped,
    longGrouped,
    eligibleReferrers,
    activePublishers,
    deadLetter24h,
    stuckPublishing,
    relayAgg,
  ] = await Promise.all([
    prisma.subscription.count({
      where: { status: SubscriptionStatus.ACTIVE },
    }),
    countNewUsers(bounds.from, bounds.to),
    countPublishedShort(bounds.from, bounds.to),
    countPublishedLong(bounds.from, bounds.to),
    countFailedShortInRange(bounds.from, bounds.to),
    countFailedLongInRange(bounds.from, bounds.to),
    prevBounds
      ? countNewUsers(prevBounds.from, prevBounds.to)
      : Promise.resolve(0),
    prevBounds ? countPublishedShort(prevBounds.from, prevBounds.to) : 0,
    prevBounds ? countPublishedLong(prevBounds.from, prevBounds.to) : 0,
    prevBounds ? countFailedShortInRange(prevBounds.from, prevBounds.to) : 0,
    prevBounds ? countFailedLongInRange(prevBounds.from, prevBounds.to) : 0,
    prisma.referralEarning.aggregate({
      where: { status: ReferralEarningStatus.PENDING },
      _sum: { commissionSats: true },
    }),
    prisma.referral.count(),
    prisma.referralEarning.aggregate({
      where: {
        status: ReferralEarningStatus.PAID,
        paidAt: { gte: bounds.from, lt: bounds.to },
      },
      _sum: { commissionSats: true },
    }),
    prisma.post.groupBy({
      by: ["currentState"],
      _count: { _all: true },
    }),
    prisma.longFormPost.groupBy({
      by: ["currentState"],
      _count: { _all: true },
    }),
    getReferrersEligibleForPayout(),
    distinctPublishersInRange(bounds.from, bounds.to),
    prisma.deadLetterJob.count({
      where: {
        createdAt: {
          gte: new Date(now.getTime() - 24 * 60 * 60 * 1000),
          lt: now,
        },
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
        createdAt: { gte: bounds.from, lt: bounds.to },
      },
      _count: { _all: true },
    }),
  ]);

  const scheduledQueueDepth =
    (postsGrouped.find((r) => r.currentState === "SCHEDULED")?._count._all ??
      0) +
    (longGrouped.find((r) => r.currentState === "SCHEDULED")?._count._all ?? 0);

  const failedShortTotal =
    postsGrouped.find((r) => r.currentState === "FAILED")?._count._all ?? 0;
  const cancelledShortTotal =
    postsGrouped.find((r) => r.currentState === "CANCELLED")?._count._all ?? 0;

  const stateMixShort = [...postsGrouped]
    .map((r) => ({ state: r.currentState, count: r._count._all }))
    .sort((a, b) => b.count - a.count);
  const stateMixLong = [...longGrouped]
    .map((r) => ({ state: r.currentState, count: r._count._all }))
    .sort((a, b) => b.count - a.count);

  const dailyPublishesShort = await dailyPublishCountsShort(now, 7);

  const avgPublishLatencyMs = await avgPublishLatencyShort(
    bounds.from,
    bounds.to
  );

  const postsTotal = pubShort + pubLong;
  const failsTotal = failShort + failLong;
  const prevPostsTotal = prevPubShort + prevPubLong;
  const prevFailsTotal = prevFailShort + prevFailLong;

  const publishSuccessRate = successRate(postsTotal, failsTotal);
  const publishSuccessPrev =
    prevBounds === null ? null : successRate(prevPostsTotal, prevFailsTotal);

  const pendingPayoutSats = pendingAgg._sum.commissionSats ?? 0;
  const paidInRangeSats = paidInRangeAgg._sum.commissionSats ?? 0;

  const failed24hShort = await prisma.post.count({
    where: {
      currentState: "FAILED",
      updatedAt: {
        gte: new Date(now.getTime() - 24 * 60 * 60 * 1000),
        lt: now,
      },
    },
  });
  const failed24hLong = await prisma.longFormPost.count({
    where: {
      currentState: "FAILED",
      updatedAt: {
        gte: new Date(now.getTime() - 24 * 60 * 60 * 1000),
        lt: now,
      },
    },
  });

  const relayAccepted =
    relayAgg.find((r) => r.status === PublishRelayAckStatus.ACCEPTED)?._count
      ._all ?? 0;
  const relayFailed =
    (relayAgg.find((r) => r.status === PublishRelayAckStatus.FAILED)?._count
      ._all ?? 0) +
    (relayAgg.find((r) => r.status === PublishRelayAckStatus.TIMEOUT)?._count
      ._all ?? 0);
  const relayTotal = relayAccepted + relayFailed;

  const alerts: AdminAlertItem[] = [];
  if (failed24hShort + failed24hLong > 0) {
    alerts.push({
      id: "failed-publish-24h",
      severity: "danger",
      message: `${failed24hShort + failed24hLong} failed publish job(s) in the last 24 hours`,
      href: "/dashboard/admin/operations?focus=failures",
    });
  }
  if (deadLetter24h > 0) {
    alerts.push({
      id: "dead-letter",
      severity: "danger",
      message: `${deadLetter24h} dead-letter queue entr${deadLetter24h === 1 ? "y" : "ies"} in the last 24 hours`,
      href: "/dashboard/admin/operations?focus=deadletter",
    });
  }
  if (stuckPublishing > 0) {
    alerts.push({
      id: "stuck-publishing",
      severity: "warning",
      message: `${stuckPublishing} post(s) stuck in publishing (${PUBLISHING_STUCK_MINUTES}+ min)`,
      href: "/dashboard/admin/operations?focus=stuck",
    });
  }
  if (relayTotal > 0 && relayFailed / relayTotal > 0.15) {
    alerts.push({
      id: "relay-degraded",
      severity: "warning",
      message: `Relay publish success degraded (~${Math.round((relayAccepted / relayTotal) * 100)}% OK in range)`,
      href: "/dashboard/admin/operations?focus=relay",
    });
  }

  const actionRequiredCount = alerts.length;

  const avgPostsPerActiveUser =
    activePublishers === 0 ? null : postsTotal / activePublishers;

  const systemHealth = await getAdminQueueHealthSnapshot(bounds, {
    relayAccepted,
    relayFailed,
  });

  return {
    rangePreset: preset,
    generatedAt: now.toISOString(),
    kpis: {
      activePaidUsers: {
        current: activePaidUsers,
        previous: null,
        deltaPct: null,
      },
      newUsers: {
        current: newUsers,
        previous: prevBounds ? prevNewUsers : null,
        deltaPct: prevBounds
          ? formatDeltaPercent(newUsers, prevNewUsers)
          : null,
      },
      postsPublished: {
        current: postsTotal,
        short: pubShort,
        long: pubLong,
        previous: prevBounds ? prevPostsTotal : null,
        deltaPct: prevBounds
          ? formatDeltaPercent(postsTotal, prevPostsTotal)
          : null,
      },
      publishSuccessRate,
      publishSuccessPrev,
      pendingPayoutSats,
      actionRequiredCount,
    },
    alerts,
    publishing: {
      stateMixShort,
      stateMixLong,
      dailyPublishesShort,
      scheduledQueueDepth,
      failedShort: failedShortTotal,
      cancelledShort: cancelledShortTotal,
      avgPublishLatencyMs,
    },
    users: {
      activeUsersProxy: activePublishers,
      signupsInRange: newUsers,
      avgPostsPerActiveUser,
    },
    referrals: {
      activeSubscriptions: activePaidUsers,
      referralLinks: referralLinkCount,
      pendingSats: pendingPayoutSats,
      paidInRangeSats,
      batchReadyCount: eligibleReferrers.length,
    },
    systemHealth,
  };
}
