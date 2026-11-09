/**
 * Prisma access for public marketing stats. Queries stay in this file.
 */

import { prisma } from "~/lib/prisma.server";

import {
  PEOPLE_LIMIT,
  type PublicStats,
  selectPeople,
  type PersonCandidate,
} from "../stats-payload";

const ACTIVE_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;
const PUBLISHED = "PUBLISHED";

interface CountRow {
  n: number | bigint;
}

interface SinceRow {
  since: Date | null;
}

interface OnTimeRow {
  on_time: number | bigint;
  total: number | bigint;
}

interface PersonRow {
  userId: string;
  npub: string;
  nostrProfile: unknown;
  publishedAt: Date;
}

function asNumber(value: number | bigint): number {
  return typeof value === "bigint" ? Number(value) : value;
}

async function countPublished(since: Date | null): Promise<number> {
  const rows = since
    ? await prisma.$queryRaw<CountRow[]>`
        SELECT (
          (SELECT COUNT(*) FROM "Post" WHERE "currentState" = ${PUBLISHED} AND "publishedAt" >= ${since})
          + (SELECT COUNT(*) FROM "LongFormPost" WHERE "currentState" = ${PUBLISHED} AND "publishedAt" >= ${since})
        ) AS n`
    : await prisma.$queryRaw<CountRow[]>`
        SELECT (
          (SELECT COUNT(*) FROM "Post" WHERE "currentState" = ${PUBLISHED})
          + (SELECT COUNT(*) FROM "LongFormPost" WHERE "currentState" = ${PUBLISHED})
        ) AS n`;
  return asNumber(rows[0]?.n ?? 0);
}

export async function queryPublicStats(
  pictureOrigin: string
): Promise<PublicStats> {
  const since = new Date(Date.now() - ACTIVE_WINDOW_MS);

  const [
    publishedTotal,
    published30,
    scheduledNow,
    reposts,
    onTime,
    active,
    running,
    peopleRows,
  ] = await Promise.all([
    countPublished(null),
    countPublished(since),
    prisma.$queryRaw<CountRow[]>`
      SELECT (
        (SELECT COUNT(*) FROM "Post" WHERE "currentState" = 'SCHEDULED')
        + (SELECT COUNT(*) FROM "LongFormPost" WHERE "currentState" = 'SCHEDULED')
      ) AS n`,
    prisma.post.count({
      where: { currentState: PUBLISHED, repost: true },
    }),
    prisma.$queryRaw<OnTimeRow[]>`
      SELECT
        COUNT(*) FILTER (
          WHERE ABS(EXTRACT(EPOCH FROM ("publishedAt" - "scheduledAtUtc"))) <= 600
        ) AS on_time,
        COUNT(*) AS total
      FROM (
        SELECT "publishedAt", "scheduledAtUtc" FROM "Post"
        WHERE "currentState" = ${PUBLISHED} AND "publishedAt" >= ${since} AND "scheduledAtUtc" IS NOT NULL
        UNION ALL
        SELECT "publishedAt", "scheduledAtUtc" FROM "LongFormPost"
        WHERE "currentState" = ${PUBLISHED} AND "publishedAt" >= ${since} AND "scheduledAtUtc" IS NOT NULL
      ) s`,
    prisma.$queryRaw<CountRow[]>`
      SELECT COUNT(*) AS n FROM (
        SELECT "userId" FROM "Post"
        WHERE "currentState" = ${PUBLISHED} AND "publishedAt" >= ${since}
        UNION
        SELECT "userId" FROM "LongFormPost"
        WHERE "currentState" = ${PUBLISHED} AND "publishedAt" >= ${since}
      ) accounts`,
    prisma.$queryRaw<SinceRow[]>`
      SELECT MIN(t) AS since FROM (
        SELECT MIN("publishedAt") AS t FROM "Post" WHERE "currentState" = ${PUBLISHED}
        UNION ALL
        SELECT MIN("publishedAt") FROM "LongFormPost" WHERE "currentState" = ${PUBLISHED}
      ) bounds`,
    prisma.$queryRaw<PersonRow[]>`
      SELECT u."id" AS "userId", u."npub" AS npub, u."nostrProfile" AS "nostrProfile",
             MAX(p."publishedAt") AS "publishedAt"
      FROM "User" u
      JOIN (
        SELECT "userId", "publishedAt" FROM "Post"
        WHERE "currentState" = ${PUBLISHED} AND "publishedAt" >= ${since}
        UNION ALL
        SELECT "userId", "publishedAt" FROM "LongFormPost"
        WHERE "currentState" = ${PUBLISHED} AND "publishedAt" >= ${since}
      ) p ON p."userId" = u."id"
      WHERE u."hideFromLanding" = false
      GROUP BY u."id", u."npub", u."nostrProfile"
      ORDER BY MAX(p."publishedAt") DESC
      LIMIT ${PEOPLE_LIMIT + 32}`,
  ]);

  const onTimeRow = onTime[0];
  const onTimeTotal = asNumber(onTimeRow?.total ?? 0);
  const rate =
    onTimeTotal === 0
      ? null
      : Math.round((asNumber(onTimeRow?.on_time ?? 0) / onTimeTotal) * 1000) /
        1000;

  const candidates: PersonCandidate[] = peopleRows
    .filter((row) => row.publishedAt instanceof Date)
    .map((row) => ({
      userId: row.userId,
      publishedAt: row.publishedAt,
      npub: row.npub,
      profile: row.nostrProfile,
    }));

  const origin = pictureOrigin.replace(/\/$/, "");
  const sinceDate = running[0]?.since ?? null;

  return {
    v: 1,
    generated_at: new Date().toISOString(),
    posts_published_total: publishedTotal,
    posts_published_30d: published30,
    posts_scheduled_now: asNumber(scheduledNow[0]?.n ?? 0),
    reposts_scheduled_total: reposts,
    on_time_rate_30d: rate,
    active_accounts_30d: asNumber(active[0]?.n ?? 0),
    running_since:
      sinceDate instanceof Date ? sinceDate.toISOString().slice(0, 10) : null,
    people: selectPeople(candidates).map((person) => ({
      ...person,
      picture: `${origin}/api/public/avatar/${person.npub}`,
    })),
  };
}

export function saveStatsSnapshot(payload: PublicStats): Promise<unknown> {
  return prisma.publicStatsSnapshot.create({ data: { payload } });
}

export function findAvatarSubject(npub: string) {
  return prisma.user.findUnique({
    where: { npub },
    select: { hideFromLanding: true, nostrProfile: true },
  });
}

export function findLandingPresence(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: {
      npub: true,
      hideFromLanding: true,
      landingNoticeSeenAt: true,
    },
  });
}

export function markLandingNoticeSeen(userId: string) {
  return prisma.user.update({
    where: { id: userId },
    data: { landingNoticeSeenAt: new Date() },
  });
}

export function setLandingVisibility(userId: string, hideFromLanding: boolean) {
  return prisma.user.update({
    where: { id: userId },
    data: { hideFromLanding, landingNoticeSeenAt: new Date() },
  });
}
