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
