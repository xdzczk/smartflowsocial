/**
 * Read queries for contest detail page (Prisma in repositories per eslint rules).
 */

import { prisma } from "~/lib/prisma.server";

export async function findContestWinnersWithEntries(contestId: string) {
  return prisma.contestWinner.findMany({
    where: { contestId },
    include: { entry: true },
    orderBy: [{ isAlternate: "asc" }, { rank: "asc" }],
  });
}

export async function findContestEntriesForDetail(
  contestId: string,
  options: { includeExcluded: boolean }
) {
  return prisma.contestEntry.findMany({
    where: {
      contestId,
      ...(options.includeExcluded ? {} : { isExcluded: false }),
    },
    orderBy: [{ rank: "asc" }, { score: "desc" }],
    take: 200,
  });
}

export async function findLatestContestSnapshot(contestId: string) {
  return prisma.contestSnapshot.findFirst({
    where: { contestId },
    orderBy: { snapshotAt: "desc" },
  });
}

export async function findContestEventLogs(contestId: string, take = 100) {
  return prisma.contestEventLog.findMany({
    where: { contestId },
    orderBy: { createdAt: "desc" },
    take,
  });
}

export async function countContestsByUserAndStatus(
  userId: string,
  status: string
) {
  return prisma.contest.count({
    where: { userId, status: status as never },
  });
}
