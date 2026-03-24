import type {
  Contest,
  Prisma,
} from "~/features/contest/data/contest-prisma-types.server";
import { prisma } from "~/lib/prisma.server";

export async function findContestByIdAndUser(
  id: string,
  userId: string
): Promise<Contest | null> {
  return prisma.contest.findFirst({ where: { id, userId } });
}

export async function listContestsByUser(userId: string): Promise<Contest[]> {
  return prisma.contest.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });
}

export async function listContestsByUserWithFilters(
  userId: string,
  options: {
    status?: string;
    metric?: string;
    sort?: "newest" | "ending" | "completed";
  }
): Promise<Contest[]> {
  const where: Prisma.ContestWhereInput = { userId };
  if (options.status && options.status !== "all") {
    where.status = options.status as never;
  }
  if (options.metric && options.metric !== "all") {
    where.rankingMetric = options.metric as never;
  }
  const sort = options.sort ?? "newest";
  if (sort === "ending") {
    return prisma.contest.findMany({
      where,
      orderBy: { contestEndAt: "asc" },
    });
  }
  if (sort === "completed") {
    return prisma.contest.findMany({
      where,
      orderBy: [{ completedAt: "desc" }, { updatedAt: "desc" }],
    });
  }
  return prisma.contest.findMany({
    where,
    orderBy: { createdAt: "desc" },
  });
}

export async function createContest(
  data: Prisma.ContestCreateInput
): Promise<Contest> {
  return prisma.contest.create({ data });
}

export async function updateContest(
  contestId: string,
  data: Prisma.ContestUpdateInput
): Promise<Contest> {
  return prisma.contest.update({ where: { id: contestId }, data });
}

export async function deleteContest(contestId: string): Promise<Contest> {
  return prisma.contest.delete({ where: { id: contestId } });
}
