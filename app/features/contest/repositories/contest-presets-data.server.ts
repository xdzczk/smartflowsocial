import type { ContestPreset } from "@prisma/client";

import type { Prisma } from "~/features/contest/data/contest-prisma-types.server";
import { prisma } from "~/lib/prisma.server";

export async function createContestPresetRow(
  data: Prisma.ContestPresetCreateInput
): Promise<ContestPreset> {
  return prisma.contestPreset.create({ data });
}

export async function deleteContestPresetRow(
  userId: string,
  id: string
): Promise<void> {
  await prisma.contestPreset.deleteMany({ where: { id, userId } });
}

export async function getContestPresetsByUser(
  userId: string
): Promise<ContestPreset[]> {
  return prisma.contestPreset.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
  });
}

export async function getContestPresetByIdForUser(
  userId: string,
  id: string
): Promise<ContestPreset | null> {
  return prisma.contestPreset.findFirst({ where: { id, userId } });
}

export async function updateContestPresetRow(
  id: string,
  userId: string,
  data: Prisma.ContestPresetUpdateInput
): Promise<ContestPreset> {
  const row = await prisma.contestPreset.findFirst({ where: { id, userId } });
  if (!row) {
    throw new Error("Contest preset not found");
  }
  return prisma.contestPreset.update({
    where: { id },
    data,
  });
}
