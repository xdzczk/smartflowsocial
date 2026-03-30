/* eslint-disable no-restricted-imports -- Contest v1 domain scaffolding will be hardened in follow-up cleanup. */
import { prisma } from "~/lib/prisma.server";

import type { Contest } from "./data/contest-prisma-types.server";
import {
  findContestByIdAndUser,
  findContestByIdPublic,
  listContestsByUser,
  listContestsByUserWithFilters,
} from "./repositories/contest-actions-data.server";

export async function getContestById(
  id: string,
  userId: string
): Promise<Contest | null> {
  return findContestByIdAndUser(id, userId);
}

export async function getContestByIdPublic(
  id: string
): Promise<Contest | null> {
  return findContestByIdPublic(id);
}

export async function getContestKpiCounts(
  userId: string
): Promise<Partial<Record<string, number>>> {
  const rows = await prisma.contest.groupBy({
    by: ["status"],
    where: { userId },
    _count: { _all: true },
  });
  const map: Partial<Record<string, number>> = {};
  for (const r of rows) {
    map[r.status] = r._count._all;
  }
  return map;
}

export async function getContestEntryCounts(
  userId: string,
  contestIds: string[]
): Promise<Record<string, number>> {
  if (contestIds.length === 0) return {};
  const rows = await prisma.contestEntry.groupBy({
    by: ["contestId"],
    where: {
      contestId: { in: contestIds },
      contest: { userId },
    },
    _count: { _all: true },
  });
  const map: Record<string, number> = {};
  for (const row of rows) {
    map[row.contestId] = row._count._all;
  }
  return map;
}

export async function listContests(userId: string): Promise<Contest[]> {
  return listContestsByUser(userId);
}

export async function listContestsFiltered(
  userId: string,
  filters: {
    status?: string;
    metric?: string;
    sort?: "newest" | "ending" | "completed";
  }
): Promise<Contest[]> {
  return listContestsByUserWithFilters(userId, filters);
}

/** First image URL per post id for contest index thumbnails. */
export async function getContestSourcePostThumbnails(
  userId: string,
  postIds: string[]
): Promise<Record<string, string | null>> {
  if (postIds.length === 0) return {};
  const posts = await prisma.post.findMany({
    where: { userId, id: { in: postIds } },
    select: { id: true, fileUrl: true },
  });
  const out: Record<string, string | null> = {};
  for (const p of posts) {
    const first = p.fileUrl[0]?.trim();
    out[p.id] = first && first.length > 0 ? first : null;
  }
  return out;
}
/* eslint-enable no-restricted-imports */
