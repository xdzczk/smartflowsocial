/**
 * Giveaway display data access (queue name resolution). Prisma confined here.
 */

import { prisma } from "~/lib/prisma.server";

export async function findQueueTypeNameByIdAndUser(
  userId: string,
  queueId: string
): Promise<string | null> {
  const row = await prisma.queueType.findFirst({
    where: { id: queueId, userId },
    select: { name: true },
  });
  return row?.name ?? null;
}

export async function findQueueTypesByIdsAndUser(
  userId: string,
  queueIds: string[]
): Promise<Array<{ id: string; name: string }>> {
  if (queueIds.length === 0) return [];
  return prisma.queueType.findMany({
    where: { id: { in: queueIds }, userId },
    select: { id: true, name: true },
  });
}
