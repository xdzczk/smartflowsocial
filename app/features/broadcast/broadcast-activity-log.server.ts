import type { BroadcastEventLogLevel, Prisma } from "@prisma/client";

import { prisma } from "~/lib/prisma.server";

export async function appendBroadcastEventLog(input: {
  campaignId: string;
  level?: BroadcastEventLogLevel;
  eventType: string;
  message: string;
  metadataJson?: Prisma.InputJsonValue;
}): Promise<void> {
  await prisma.broadcastEventLog.create({
    data: {
      campaignId: input.campaignId,
      level: input.level ?? "INFO",
      eventType: input.eventType,
      message: input.message,
      metadataJson: input.metadataJson ?? undefined,
    },
  });
}

export async function listBroadcastEventLogs(campaignId: string, take = 100) {
  return prisma.broadcastEventLog.findMany({
    where: { campaignId },
    orderBy: { createdAt: "desc" },
    take,
  });
}
