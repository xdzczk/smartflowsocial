/**
 * Giveaway actions data access. All prisma usage for giveaway CRUD/lifecycle confined here.
 */

import type {
  Prisma,
  Giveaway,
} from "~/features/giveaway/data/giveaway-prisma-types.server";
import { prisma } from "~/lib/prisma.server";

export async function findGiveawayByIdAndUser(
  id: string,
  userId: string
): Promise<Giveaway | null> {
  return prisma.giveaway.findFirst({
    where: { id, userId },
  });
}

export async function createGiveaway(
  userId: string,
  data: Prisma.GiveawayCreateInput
): Promise<Giveaway> {
  return prisma.giveaway.create({ data });
}

export async function updateGiveaway(
  giveawayId: string,
  data: Prisma.GiveawayUpdateInput
): Promise<Giveaway> {
  return prisma.giveaway.update({
    where: { id: giveawayId },
    data,
  });
}

export async function deleteGiveawayById(
  giveawayId: string
): Promise<Giveaway> {
  return prisma.giveaway.delete({
    where: { id: giveawayId },
  });
}

export async function listGiveawaysByUser(
  userId: string,
  options?: { status?: Giveaway["status"] }
): Promise<Giveaway[]> {
  return prisma.giveaway.findMany({
    where: {
      userId,
      ...(options?.status !== undefined && { status: options.status }),
    },
    orderBy: { createdAt: "desc" },
  });
}
