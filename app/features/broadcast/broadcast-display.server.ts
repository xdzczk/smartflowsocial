import type { BroadcastCampaignStatus } from "@prisma/client";

import { prisma } from "~/lib/prisma.server";

export async function listBroadcastCampaignsByUser(
  userId: string,
  options?: { status?: BroadcastCampaignStatus }
) {
  return prisma.broadcastCampaign.findMany({
    where: {
      userId,
      ...(options?.status ? { status: options.status } : {}),
    },
    orderBy: { updatedAt: "desc" },
    include: {
      _count: { select: { recipients: true } },
    },
  });
}

export async function getBroadcastCampaignForUser(
  campaignId: string,
  userId: string
) {
  return prisma.broadcastCampaign.findFirst({
    where: { id: campaignId, userId },
    include: {
      recipients: {
        orderBy: { createdAt: "asc" },
      },
      eventLogs: {
        orderBy: { createdAt: "desc" },
        take: 50,
      },
    },
  });
}

export async function listSuppressionsByUser(userId: string) {
  return prisma.broadcastSuppression.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });
}
