/**
 * Giveaway presets data access. Prisma confined to feature repositories.
 */

import type {
  GiveawayPreset,
  Prisma,
} from "~/features/giveaway/data/giveaway-prisma-types.server";
import { prisma } from "~/lib/prisma.server";

export async function createGiveawayPreset(
  data: Prisma.GiveawayPresetCreateInput
): Promise<GiveawayPreset> {
  return prisma.giveawayPreset.create({ data });
}

export async function updateGiveawayPreset(
  id: string,
  userId: string,
  data: Parameters<typeof prisma.giveawayPreset.update>[0]["data"]
): Promise<GiveawayPreset> {
  return prisma.giveawayPreset.update({
    where: { id, userId },
    data,
  });
}

export async function deleteGiveawayPreset(
  id: string,
  userId: string
): Promise<void> {
  await prisma.giveawayPreset.delete({
    where: { id, userId },
  });
}

export async function getGiveawayPresetsByUser(
  userId: string
): Promise<GiveawayPreset[]> {
  return prisma.giveawayPreset.findMany({
    where: { userId },
    orderBy: { createdAt: "asc" },
  });
}

export async function getGiveawayPresetById(
  userId: string,
  id: string
): Promise<GiveawayPreset | null> {
  return prisma.giveawayPreset.findFirst({
    where: { id, userId },
  });
}

export async function findQueueTypeByIdAndUser(
  userId: string,
  queueId: string
): Promise<{ id: string; name: string } | null> {
  return prisma.queueType.findFirst({
    where: { id: queueId, userId },
    select: { id: true, name: true },
  });
}
