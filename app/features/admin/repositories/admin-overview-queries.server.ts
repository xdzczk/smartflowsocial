/**
 * Server-only aggregates for Admin Overview tab (time-ranged).
 */

import {
  ReferralEarningStatus,
  SubscriptionStatus,
  PublishRelayAckStatus,
} from "@prisma/client";

import { FREE_PLAN_ID } from "~/features/payments/plan-ids";
import { getReferrersEligibleForPayout } from "~/features/referral/referral-payout.server";
import { prisma } from "~/lib/prisma.server";

import type { DateRangeBounds, RangePreset } from "../metrics/date-range";
import {
  formatDeltaPercent,
  getBoundsForPreset,
  getPreviousPeriodBounds,
} from "../metrics/date-range";
import { PUBLISHING_STUCK_MINUTES } from "../metrics/definitions";

import { getMonetizationBundle } from "./admin-monetization-bundle.server";
import { getProductUsageBundle } from "./admin-product-usage-bundle.server";
import { getSignerConnectHealthBundle } from "./admin-signer-connect-bundle.server";
import { getAdminQueueHealthSnapshot } from "./admin-system-health.server";

export type AdminAlertCategory =
  | "business"
  | "publishing"
  | "signer"
  | "infra"
  | "payouts";

export interface AdminAlertItem {
  id: string;
  severity: "warning" | "danger";
  message: string;
  href: string;
  category: AdminAlertCategory;
}

export interface KpiWithDelta {
  current: number;
  previous: number | null;
  deltaPct: number | null;
}

export interface AdminOverviewKpiInsights {
  activePaidUsers: string;
  newUsers: string;
  postsPublished: string;
  publishSuccess: string;
  pendingPayout: string;
  actionRequired: string;
}

export interface AdminOverviewRelayInsight {
  accepted: number;
  failed: number;
  /** % of ACKs that succeeded, or null if no samples */
  ratePct: number | null;
  /** Operator-facing interpretation */
  note: string;
}

export interface AdminOverviewInsights {
  definitions: AdminOverviewKpiInsights;
  kpi: AdminOverviewKpiInsights;
  relay: AdminOverviewRelayInsight;
  publishingNarrative: string;
}

export interface AdminOverviewPageDTO {
  rangePreset: RangePreset;
  generatedAt: string;
  monetization: Awaited<ReturnType<typeof getMonetizationBundle>>;
  signerConnect: Awaited<ReturnType<typeof getSignerConnectHealthBundle>>;
  productUsage: Awaited<ReturnType<typeof getProductUsageBundle>>;
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
    /** All ACTIVE subscription rows (free + paid). */
    activeSubscriptions: number;
    referralLinks: number;
    pendingSats: number;
    paidInRangeSats: number;
    batchReadyCount: number;
  };
  systemHealth: Awaited<ReturnType<typeof getAdminQueueHealthSnapshot>>;
  insights: AdminOverviewInsights;
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

const KPI_DEFINITIONS: AdminOverviewKpiInsights = {
  activePaidUsers:
    "ACTIVE subscriptions whose plan is not the built-in free tier (`planId` ≠ free).",
  newUsers: "Accounts created during the selected time window.",
  postsPublished:
    "Short plus long-form posts that reached PUBLISHED within the selected window.",
  publishSuccess:
    "Published ÷ (published + failed) where failure/success timestamps fall in the range.",
  pendingPayout:
    "Referral commissions still in PENDING (sats waiting for Lightning payout).",
  actionRequired:
    "Number of alert conditions firing right now on this overview (see Alerts).",
};

function overviewRelayNote(
  relayTotal: number,
  relayAccepted: number,
  relayFailed: number
): string {
  if (relayTotal === 0) {
    return "No relay publish acknowledgements in this range  -  ratio is not meaningful yet.";
  }
  const pct = Math.round((relayAccepted / relayTotal) * 1000) / 10;
  return `${relayAccepted} accepted vs ${relayFailed} failed/timeout ACKs (${pct}% OK). Mix varies by user-chosen relays  -  not a pure platform health signal. Overview alerts only if OK rate falls below 25% with enough samples.`;
}

function overviewNewUsersLine(
  prevBounds: DateRangeBounds | null,
  lowVol: boolean,
  newUsers: number,
  prevNewUsers: number
): string {
  if (!prevBounds) {
    return "No prior period for this range preset  -  switch to 7d+ for deltas.";
  }
  if (lowVol) {
    return "Low signup volume  -  treat the delta as directional, not definitive.";
  }
  if (newUsers > prevNewUsers)
    return "Signups accelerated vs the prior window.";
  if (newUsers < prevNewUsers) return "Signups cooled vs the prior window.";
  return "Signups flat vs the prior window.";
}

function overviewPostsLine(
  prevBounds: DateRangeBounds | null,
  lowPostVol: boolean,
  postsTotal: number,
  prevPostsTotal: number
): string {
  if (!prevBounds) {
    return "No prior period for comparison.";
  }
  if (lowPostVol) {
    return "Low publish volume  -  swings are noisy.";
  }
  if (postsTotal > prevPostsTotal) {
    return "Publishing volume is up vs the prior window.";
  }
  if (postsTotal < prevPostsTotal) {
    return "Publishing volume is down vs the prior window.";
  }
  return "Publishing steady vs the prior window.";
}

function overviewMixLine(pubShort: number, pubLong: number): string {
  if (pubLong > pubShort) {
    return "Long-form is carrying a large share of output this window.";
  }
  if (pubLong === 0 && pubShort > 0) {
    return "All published output is short-form in this window.";
  }
  return "Short-form dominates by count; long-form adds depth.";
}

function overviewPubSuccessLine(
  publishSuccessPrev: number | null,
  publishSuccessRate: number
): string {
  if (publishSuccessPrev === null) {
    return "Compares publishes vs failures with timestamps in the range.";
  }
  if (publishSuccessRate >= publishSuccessPrev) {
    return "Success rate improved or held vs the prior window.";
  }
  return "Success rate slipped vs the prior window  -  check Operations for failures.";
}

function overviewQueueDepthLine(scheduledQueueDepth: number): string {
  if (scheduledQueueDepth > 50) {
    return `Queue depth is elevated (${scheduledQueueDepth} scheduled/publishing)  -  expect longer time-to-publish.`;
  }
  if (scheduledQueueDepth > 0) {
    return `Queue depth looks normal (${scheduledQueueDepth} scheduled/publishing).`;
  }
  return "Nothing waiting in schedule queues.";
}

function buildOverviewInsights(args: {
  preset: RangePreset;
  prevBounds: DateRangeBounds | null;
  newUsers: number;
  prevNewUsers: number;
  postsTotal: number;
  prevPostsTotal: number;
  pubShort: number;
  pubLong: number;
  relayAccepted: number;
  relayFailed: number;
  scheduledQueueDepth: number;
  publishSuccessRate: number;
  publishSuccessPrev: number | null;
  pendingPayoutSats: number;
  actionRequiredCount: number;
  activePaidUsers: number;
}): AdminOverviewInsights {
  const {
    preset,
    prevBounds,
    newUsers,
    prevNewUsers,
    postsTotal,
    prevPostsTotal,
    pubShort,
    pubLong,
    relayAccepted,
    relayFailed,
    scheduledQueueDepth,
    publishSuccessRate,
    publishSuccessPrev,
    pendingPayoutSats,
    actionRequiredCount,
    activePaidUsers,
  } = args;

  const relayTotal = relayAccepted + relayFailed;
  const relayRatePct =
    relayTotal === 0
      ? null
      : Math.round((relayAccepted / relayTotal) * 1000) / 10;

  const relayNote = overviewRelayNote(relayTotal, relayAccepted, relayFailed);

  const lowVol =
    prevBounds !== null && newUsers + prevNewUsers < 8 && preset !== "all";
  const lowPostVol =
    prevBounds !== null && postsTotal + prevPostsTotal < 8 && preset !== "all";

  const newUsersLine = overviewNewUsersLine(
    prevBounds,
    lowVol,
    newUsers,
    prevNewUsers
  );

  const postsLine = overviewPostsLine(
    prevBounds,
    lowPostVol,
    postsTotal,
    prevPostsTotal
  );

  const mixLine = overviewMixLine(pubShort, pubLong);

  const pubSuccessLine = overviewPubSuccessLine(
    publishSuccessPrev,
    publishSuccessRate
  );

  const payoutLine =
    pendingPayoutSats === 0
      ? "Nothing queued for payout right now."
      : "Referral commissions are waiting  -  confirm LNURL setup before batch runs.";

  const actionLine =
    actionRequiredCount === 0
      ? "No open alerts  -  still scan Operations for backlog."
      : `${actionRequiredCount} alert(s) need review  -  start with Operations.`;

  const paidBaseLine = `Paid subscriber base: ${activePaidUsers} active seat(s).`;

  const publishingNarrative = [
    overviewQueueDepthLine(scheduledQueueDepth),
    mixLine,
  ].join(" ");

  return {
    definitions: KPI_DEFINITIONS,
    kpi: {
      activePaidUsers: paidBaseLine,
      newUsers: newUsersLine,
      postsPublished: `${postsLine} ${pubShort} short · ${pubLong} long.`,
      publishSuccess: pubSuccessLine,
      pendingPayout: payoutLine,
      actionRequired: actionLine,
    },
    relay: {
      accepted: relayAccepted,
      failed: relayFailed,
      ratePct: relayRatePct,
      note: relayNote,
    },
    publishingNarrative,
  };
}

export async function getAdminOverviewPageData(
  preset: RangePreset,
  now: Date = new Date()
): Promise<AdminOverviewPageDTO> {
  const bounds = getBoundsForPreset(preset, now);
  const prevBounds = getPreviousPeriodBounds(bounds, now);

  const [
    activePaidUsers,
    activeSubscriptionsAll,
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
      where: {
        status: SubscriptionStatus.ACTIVE,
        NOT: { planId: FREE_PLAN_ID },
      },
    }),
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
      category: "publishing",
    });
  }
  if (deadLetter24h > 0) {
    alerts.push({
      id: "dead-letter",
      severity: "danger",
      message: `${deadLetter24h} dead-letter queue entr${deadLetter24h === 1 ? "y" : "ies"} in the last 24 hours`,
      href: "/dashboard/admin/operations?focus=deadletter",
      category: "infra",
    });
  }
  if (stuckPublishing > 0) {
    alerts.push({
      id: "stuck-publishing",
      severity: "warning",
      message: `${stuckPublishing} post(s) stuck in publishing (${PUBLISHING_STUCK_MINUTES}+ min)`,
      href: "/dashboard/admin/operations?focus=stuck",
      category: "publishing",
    });
  }
  const RELAY_ALERT_MIN_SAMPLES = 20;
  if (
    relayTotal >= RELAY_ALERT_MIN_SAMPLES &&
    relayAccepted / relayTotal < 0.25
  ) {
    alerts.push({
      id: "relay-severe",
      severity: "warning",
      message: `Relay ACK success very low (~${Math.round((relayAccepted / relayTotal) * 100)}% OK in range, ${relayTotal} samples)  -  check Operations relay section`,
      href: "/dashboard/admin/operations?focus=relay",
      category: "publishing",
    });
  }

  const avgPostsPerActiveUser =
    activePublishers === 0 ? null : postsTotal / activePublishers;

  const [systemHealth, monetization, signerConnect, productUsage] =
    await Promise.all([
      getAdminQueueHealthSnapshot(),
      getMonetizationBundle(preset, now),
      getSignerConnectHealthBundle(bounds),
      getProductUsageBundle(bounds, now),
    ]);

  if (
    signerConnect.reconnectFailuresInRange >= 3 &&
    signerConnect.reconnectAttemptsInRange >= 3
  ) {
    alerts.push({
      id: "signer-reconnect-failures",
      severity: "warning",
      message: `Remote signer reconnect failures in range (${signerConnect.reconnectFailuresInRange} of ${signerConnect.reconnectAttemptsInRange} attempts; ${signerConnect.distinctUsersWithFailureInRange} user(s))`,
      href: "/dashboard/admin/analytics#signer-connect",
      category: "signer",
    });
  }

  if (
    monetization.netSubscriptionFlowInRange < 0 &&
    preset !== "all" &&
    monetization.subscriptionsCanceledInRange >= 2
  ) {
    alerts.push({
      id: "net-subs-down",
      severity: "warning",
      message: `Paid subscription cancellations (${monetization.subscriptionsCanceledInRange}) outpaced new paid starts (${monetization.subscriptionsStartedInRange}) in this window`,
      href: "/dashboard/admin/analytics#monetization",
      category: "business",
    });
  }

  const actionRequiredCount = alerts.length;

  const insights = buildOverviewInsights({
    preset,
    prevBounds,
    newUsers,
    prevNewUsers,
    postsTotal,
    prevPostsTotal,
    pubShort,
    pubLong,
    relayAccepted,
    relayFailed,
    scheduledQueueDepth,
    publishSuccessRate,
    publishSuccessPrev,
    pendingPayoutSats,
    actionRequiredCount,
    activePaidUsers,
  });

  return {
    rangePreset: preset,
    generatedAt: now.toISOString(),
    monetization,
    signerConnect,
    productUsage,
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
      activeSubscriptions: activeSubscriptionsAll,
      referralLinks: referralLinkCount,
      pendingSats: pendingPayoutSats,
      paidInRangeSats,
      batchReadyCount: eligibleReferrers.length,
    },
    systemHealth,
    insights,
  };
}
