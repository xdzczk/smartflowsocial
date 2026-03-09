/**
 * Engagement item state data access. Prisma confined to feature repositories/ per architecture.
 */

import type { PrismaClient } from "@prisma/client";

import { prisma } from "~/lib/prisma.server";

const db = prisma as unknown as PrismaClient;

export async function upsertEngagementItemState(
  userId: string,
  eventId: string,
  repliedFromApp: boolean
): Promise<void> {
  await db.engagementItemState.upsert({
    where: {
      userId_eventId: { userId, eventId },
    },
    create: {
      userId,
      eventId,
      state: "HANDLED",
      repliedFromApp,
      updatedAt: new Date(),
    },
    update: {
      state: "HANDLED",
      repliedFromApp,
      updatedAt: new Date(),
    },
  });
}

export async function findEngagementItemStatesByEventIds(
  userId: string,
  eventIds: string[]
): Promise<Array<{ eventId: string; repliedFromApp: boolean }>> {
  return db.engagementItemState.findMany({
    where: {
      userId,
      eventId: { in: eventIds },
    },
    select: { eventId: true, repliedFromApp: true },
  });
}
