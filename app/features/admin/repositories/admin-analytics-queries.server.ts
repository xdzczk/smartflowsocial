/**
 * Time series and adoption metrics for Admin Analytics tab + proof-of-work totals.
 */

import {
  GiveawayStatus,
  ReferralEarningStatus,
  SubscriptionStatus,
} from "@prisma/client";

import { prisma } from "~/lib/prisma.server";

import type { RangePreset } from "../metrics/date-range";
import { getBoundsForPreset } from "../metrics/date-range";

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
      where: { status: SubscriptionStatus.ACTIVE },
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
  ]);

  const publishersMultiDay = Number(publishersMultiDayRows[0]?.c ?? 0);
  const secondPublishUsers = Number(secondPublishUsersRows[0]?.c ?? 0);

  const d30 = pub30 + fail30;
  const publishSuccessRate30d =
    d30 === 0 ? 100 : Math.round((pub30 / d30) * 1000) / 10;

  const takeaways: string[] = [];
  if (postsPublished > 0 && newUsers > 0) {
    takeaways.push(
      `Publishing activity: ${postsPublished} short posts published in this window vs ${newUsers} new accounts.`
    );
  }
  if (postsPublished > 0 && postsWithMedia > postsPublished * 0.3) {
    takeaways.push("Media usage represents a solid share of new posts.");
  }
  if (threadSegments > 10) {
    takeaways.push("Thread scheduling is seeing real usage.");
  }
  if (takeaways.length === 0) {
    takeaways.push(
      "Collect more activity to unlock richer insights; ranges with low volume stay intentionally conservative."
    );
  }

  return {
    rangePreset: preset,
    generatedAt: now.toISOString(),
    series: {
      newUsersPerDay: mapDayRows(newUsersPerDayRows),
      postsPublishedPerDay: mapDayRows(postsPublishedPerDayRows),
      subscriptionsStartedPerDay: mapDayRows(subscriptionsStartedPerDayRows),
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
  };
}
