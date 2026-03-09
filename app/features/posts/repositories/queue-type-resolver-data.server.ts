/**
 * Queue type resolver data. Prisma confined to feature repositories.
 */

import { prisma } from "~/lib/prisma.server";

export async function findQueueTypeByUserAndName(
  userId: string,
  name: string
): Promise<{ id: string } | null> {
  return prisma.queueType.findFirst({
    where: { userId, name },
    select: { id: true },
  });
}
