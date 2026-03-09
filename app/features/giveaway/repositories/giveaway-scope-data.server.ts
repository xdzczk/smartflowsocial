/**
 * Giveaway scope data access (queue resolution for scope). Prisma confined here.
 */

import { prisma } from "~/lib/prisma.server";

export async function findQueueTypeByIdAndUser(
  userId: string,
  queueId: string
): Promise<{ id: string } | null> {
  return prisma.queueType.findFirst({
    where: { id: queueId, userId },
    select: { id: true },
  });
}

export async function findQueueTypeFullByIdAndUser(
  userId: string,
  queueId: string
) {
  return prisma.queueType.findFirst({
    where: { id: queueId, userId },
  });
}
