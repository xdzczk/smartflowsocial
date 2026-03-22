/**
 * Time series and adoption metrics for Admin Analytics tab + proof-of-work totals.
 */

import {
  GiveawayStatus,
  ReferralEarningStatus,
  SubscriptionStatus,
} from "@prisma/client";

import { FREE_PLAN_ID } from "~/features/payments/plan-ids";
import { prisma } from "~/lib/prisma.server";

import type { RangePreset } from "../metrics/date-range";
import {
  formatDeltaPercent,
  getBoundsForPreset,
  getPreviousPeriodBounds,
} from "../metrics/date-range";
import type { ProofCardData } from "../proof-card-types";

function proofCardRangeLabel(preset: RangePreset): string {
  switch (preset) {
    case "24h":
      return "Last 24 hours";
    case "7d":
      return "Last 7 days";
    case "30d":
      return "Last 30 days";
    case "90d":
      return "Last 90 days";
    case "all":
      return "All time";
    default:
      return preset;
  }
}

export interface DayCount {
  day: string;
  count: number;
}

export interface AdminAnalyticsPageDTO {
  rangePreset: RangePreset;
  generatedAt: string;
  series: {
    newUsersPerDay: DayCount[];
    postsPublishedPerDay: DayCount[];
    subscriptionsStartedPerDay: DayCount[];
    referredSignupsPerDay: DayCount[];
  };
  totals: {
    newUsers: number;
    postsPublished: number;
    longFormPublished: number;
    /** ACTIVE subscriptions excluding built-in free plan (`planId` free). */
    activeSubscriptions: number;
    referredSignups: number;
  };
  featureAdoption: {
    scheduledReposts: number;
    scheduledQuotes: number;
    threadSegments: number;
    postsWithMedia: number;
    giveawaysLockedOrPaid: number;
  };
  retention: {
    publishersMultiDay: number;
    secondPublishUsers: number;
  };
  proofOfWork: {
    totalPostsPublished: number;
    totalPostsScheduled: number;
    totalLongFormPublished: number;
    totalPublishers: number;
    totalReferralSatsPaid: number;
    publishSuccessRate30d: number;
  };
  takeaways: string[];
  /** Prior-window totals when comparable (not for `all` preset). */
  totalsPrevious: {
    newUsers: number;
    postsPublished: number;
    longFormPublished: number;
    referredSignups: number;
    subscriptionsStarted: number;
  } | null;
  /** Delta % vs prior window; null when not meaningful. */
  deltas: {
    newUsersPct: number | null;
    postsPublishedPct: number | null;
    longFormPublishedPct: number | null;
    referredSignupsPct: number | null;
    subscriptionsStartedPct: number | null;
  } | null;
  /** Curated inputs for public proof-of-work card (scope/type chosen in UI). */
  proofCard: ProofCardData;
}

function mapDayRows(rows: Array<{ d: Date; c: bigint }>): DayCount[] {
  return rows.map((r) => ({
    day: r.d.toISOString().slice(0, 10),
    count: Number(r.c),
  }));
}

export async function getAdminAnalyticsPageData(
  preset: RangePreset,
  now: Date = new Date()
): Promise<AdminAnalyticsPageDTO> {
  const { from, to } = getBoundsForPreset(preset, now);

  const [
    newUsersPerDayRows,
    postsPublishedPerDayRows,
    subscriptionsStartedPerDayRows,
    referredSignupsPerDayRows,
    newUsers,
    postsPublished,
    longFormPublished,
    activeSubscriptions,
    referredSignups,
    scheduledReposts,
    scheduledQuotes,
    threadSegments,
    postsWithMedia,
    giveawaysLockedOrPaid,
    publishersMultiDayRows,
    secondPublishUsersRows,
    totalPostsPublished,
    totalPostsScheduled,
    totalLongFormPublished,
    totalPublishers,
    totalReferralSatsPaid,
    pub30,
    fail30,
    publishersInRangeRows,
    failedReferralPayouts30d,
  ] = await Promise.all([
    prisma.$queryRaw<Array<{ d: Date; c: bigint }>>`
      SELECT date_trunc('day', "createdAt") AS d, COUNT(*)::bigint AS c
      FROM "User"
      WHERE "createdAt" >= ${from} AND "createdAt" < ${to}
      GROUP BY 1 ORDER BY 1 ASC
    `,
    prisma.$queryRaw<Array<{ d: Date; c: bigint }>>`
      SELECT date_trunc('day', "publishedAt") AS d, COUNT(*)::bigint AS c
      FROM "Post"
      WHERE "currentState" = 'PUBLISHED'
        AND "publishedAt" IS NOT NULL
        AND "publishedAt" >= ${from} AND "publishedAt" < ${to}
      GROUP BY 1 ORDER BY 1 ASC
    `,
    prisma.$queryRaw<Array<{ d: Date; c: bigint }>>`
      SELECT date_trunc('day', "createdAt") AS d, COUNT(*)::bigint AS c
      FROM "Subscription"
      WHERE "createdAt" >= ${from} AND "createdAt" < ${to}
      GROUP BY 1 ORDER BY 1 ASC
    `,
    prisma.$queryRaw<Array<{ d: Date; c: bigint }>>`
      SELECT date_trunc('day', "created_at") AS d, COUNT(*)::bigint AS c
      FROM "Referral"
      WHERE "created_at" >= ${from} AND "created_at" < ${to}
      GROUP BY 1 ORDER BY 1 ASC
    `,
    prisma.user.count({ where: { createdAt: { gte: from, lt: to } } }),
    prisma.post.count({
      where: {
        currentState: "PUBLISHED",
        publishedAt: { gte: from, lt: to },
      },
    }),
    prisma.longFormPost.count({
      where: {
        currentState: "PUBLISHED",
        publishedAt: { gte: from, lt: to },
      },
    }),
    prisma.subscription.count({
      where: {
        status: SubscriptionStatus.ACTIVE,
        NOT: { planId: FREE_PLAN_ID },
      },
    }),
    prisma.referral.count({
      where: { createdAt: { gte: from, lt: to } },
    }),
    prisma.post.count({
      where: {
        repost: true,
        createdAt: { gte: from, lt: to },
      },
    }),
    prisma.post.count({
      where: {
        isQuotedPost: true,
        createdAt: { gte: from, lt: to },
      },
    }),
    prisma.post.count({
      where: {
        NOT: { threadGroupId: null },
        createdAt: { gte: from, lt: to },
      },
    }),
    prisma.post.count({
      where: {
        createdAt: { gte: from, lt: to },
        fileUrl: { isEmpty: false },
      },
    }),
    prisma.giveaway.count({
      where: {
        updatedAt: { gte: from, lt: to },
        status: { in: [GiveawayStatus.LOCKED, GiveawayStatus.PAID_OUT] },
      },
    }),
    prisma.$queryRaw<Array<{ c: bigint }>>`
      SELECT COUNT(*)::bigint AS c
      FROM (
        SELECT "userId"
        FROM "Post"
        WHERE "currentState" = 'PUBLISHED'
          AND "publishedAt" >= ${from} AND "publishedAt" < ${to}
        GROUP BY "userId"
        HAVING COUNT(DISTINCT ("publishedAt"::date)) >= 2
      ) s
    `,
    prisma.$queryRaw<Array<{ c: bigint }>>`
      SELECT COUNT(*)::bigint AS c
      FROM (
        SELECT "userId"
        FROM "Post"
        WHERE "currentState" = 'PUBLISHED'
        GROUP BY "userId"
        HAVING COUNT(*) >= 2
      ) s
    `,
    prisma.post.count({ where: { currentState: "PUBLISHED" } }),
    prisma.post.count({ where: { currentState: "SCHEDULED" } }),
    prisma.longFormPost.count({ where: { currentState: "PUBLISHED" } }),
    prisma.post
      .findMany({
        where: { currentState: "PUBLISHED" },
        select: { userId: true },
        distinct: ["userId"],
      })
      .then((rows) => rows.length),
    prisma.referralEarning
      .aggregate({
        where: { status: ReferralEarningStatus.PAID },
        _sum: { commissionSats: true },
      })
      .then((a) => a._sum.commissionSats ?? 0),
    prisma.post.count({
      where: {
        currentState: "PUBLISHED",
        publishedAt: {
          gte: new Date(now.getTime() - 30 * 86400000),
          lt: now,
        },
      },
    }),
    prisma.post.count({
      where: {
        currentState: "FAILED",
        updatedAt: {
          gte: new Date(now.getTime() - 30 * 86400000),
          lt: now,
        },
      },
    }),
    prisma.$queryRaw<Array<{ c: bigint }>>`
      SELECT COUNT(DISTINCT uid)::bigint AS c
      FROM (
        SELECT "userId" AS uid
        FROM "Post"
        WHERE "currentState" = 'PUBLISHED'
          AND "publishedAt" IS NOT NULL
          AND "publishedAt" >= ${from}
          AND "publishedAt" < ${to}
        UNION
        SELECT "userId" AS uid
        FROM "LongFormPost"
        WHERE "currentState" = 'PUBLISHED'
          AND "publishedAt" IS NOT NULL
          AND "publishedAt" >= ${from}
          AND "publishedAt" < ${to}
      ) s
    `,
    prisma.referralEarning.count({
      where: {
        status: ReferralEarningStatus.FAILED,
        createdAt: {
          gte: new Date(now.getTime() - 30 * 86400000),
          lt: now,
        },
      },
    }),
  ]);

  const publishersMultiDay = Number(publishersMultiDayRows[0]?.c ?? 0);
  const secondPublishUsers = Number(secondPublishUsersRows[0]?.c ?? 0);

  const d30 = pub30 + fail30;
  const publishSuccessRate30d =
    d30 === 0 ? 100 : Math.round((pub30 / d30) * 1000) / 10;

  const subscriptionsSeries = mapDayRows(subscriptionsStartedPerDayRows);
  const subsStartedTotal = subscriptionsSeries.reduce((s, r) => s + r.count, 0);

  const bounds = { from, to };
  const prevBounds = getPreviousPeriodBounds(bounds, now);
  const canCompare = preset !== "all" && prevBounds !== null;

  let totalsPrevious: AdminAnalyticsPageDTO["totalsPrevious"] = null;
  let deltas: AdminAnalyticsPageDTO["deltas"] = null;

  if (canCompare) {
    const pf = prevBounds.from;
    const pt = prevBounds.to;
    const [
      prevNewUsers,
      prevPostsPublished,
      prevLongForm,
      prevReferred,
      prevSubs,
    ] = await Promise.all([
      prisma.user.count({
        where: { createdAt: { gte: pf, lt: pt } },
      }),
      prisma.post.count({
        where: {
          currentState: "PUBLISHED",
          publishedAt: { gte: pf, lt: pt },
        },
      }),
      prisma.longFormPost.count({
        where: {
          currentState: "PUBLISHED",
          publishedAt: { gte: pf, lt: pt },
        },
      }),
      prisma.referral.count({
        where: { createdAt: { gte: pf, lt: pt } },
      }),
      prisma.subscription.count({
        where: { createdAt: { gte: pf, lt: pt } },
      }),
    ]);

    totalsPrevious = {
      newUsers: prevNewUsers,
      postsPublished: prevPostsPublished,
      longFormPublished: prevLongForm,
      referredSignups: prevReferred,
      subscriptionsStarted: prevSubs,
    };

    deltas = {
      newUsersPct: formatDeltaPercent(newUsers, prevNewUsers),
      postsPublishedPct: formatDeltaPercent(postsPublished, prevPostsPublished),
      longFormPublishedPct: formatDeltaPercent(longFormPublished, prevLongForm),
      referredSignupsPct: formatDeltaPercent(referredSignups, prevReferred),
      subscriptionsStartedPct: formatDeltaPercent(subsStartedTotal, prevSubs),
    };
  }

  const postsByDay = mapDayRows(postsPublishedPerDayRows).map((x) => x.count);
  const medianDayPosts =
    postsByDay.length === 0
      ? 0
      : ([...postsByDay].sort((a, b) => a - b)[
          Math.floor(postsByDay.length / 2)
        ] ?? 0);
  const maxDayPosts = postsByDay.length === 0 ? 0 : Math.max(...postsByDay);

  const takeaways: string[] = [];
  if (postsPublished > 0 && newUsers > 0) {
    takeaways.push(
      `Publishing: ${postsPublished} short posts in window vs ${newUsers} new accounts.`
    );
  }
  if (postsPublished > 0 && postsWithMedia > postsPublished * 0.3) {
    takeaways.push("Media usage represents a solid share of posts in range.");
  }
  if (threadSegments > 10) {
    takeaways.push("Thread scheduling is seeing real usage.");
  }
  if (postsByDay.length >= 3 && maxDayPosts > Math.max(3, medianDayPosts * 2)) {
    takeaways.push(
      `At least one day spiked well above the typical daily publish level (max ${maxDayPosts} vs median ${medianDayPosts}).`
    );
  }
  if (canCompare && newUsers + (totalsPrevious?.newUsers ?? 0) < 6) {
    takeaways.push(
      "Low signup volume in current and prior windows — treat period-over-period deltas as directional only."
    );
  }
  if (takeaways.length === 0) {
    takeaways.push(
      "Collect more activity to unlock richer insights; ranges with low volume stay intentionally conservative."
    );
  }

  const publishersInRange = Number(publishersInRangeRows[0]?.c ?? 0);

  const proofCard: ProofCardData = {
    rangePreset: preset,
    rangeLabel: proofCardRangeLabel(preset),
    generatedAt: now.toISOString(),
    allTime: {
      postsPublished: totalPostsPublished,
      longFormPublished: totalLongFormPublished,
      creatorsEverPublished: totalPublishers,
      postsScheduled: totalPostsScheduled,
      referralSatsPaid: totalReferralSatsPaid,
    },
    inRange: {
      postsPublished,
      longFormPublished,
      referredSignups,
      postsWithMedia,
      publishersInRange,
      scheduledReposts,
      giveawaysLockedOrPaid,
    },
    last30d: {
      publishSuccessRate: publishSuccessRate30d,
      successfulShortPublishes: pub30,
      failedShortPublishes: fail30,
    },
    reliability30d: {
      failedReferralPayouts: failedReferralPayouts30d,
    },
  };

  return {
    rangePreset: preset,
    generatedAt: now.toISOString(),
    series: {
      newUsersPerDay: mapDayRows(newUsersPerDayRows),
      postsPublishedPerDay: mapDayRows(postsPublishedPerDayRows),
      subscriptionsStartedPerDay: subscriptionsSeries,
      referredSignupsPerDay: mapDayRows(referredSignupsPerDayRows),
    },
    totals: {
      newUsers,
      postsPublished,
      longFormPublished,
      activeSubscriptions,
      referredSignups,
    },
    featureAdoption: {
      scheduledReposts,
      scheduledQuotes,
      threadSegments,
      postsWithMedia,
      giveawaysLockedOrPaid,
    },
    retention: {
      publishersMultiDay,
      secondPublishUsers,
    },
    proofOfWork: {
      totalPostsPublished,
      totalPostsScheduled,
      totalLongFormPublished,
      totalPublishers,
      totalReferralSatsPaid,
      publishSuccessRate30d,
    },
    takeaways,
    totalsPrevious,
    deltas,
    proofCard,
  };
}
