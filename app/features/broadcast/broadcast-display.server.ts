import type {
  BroadcastAudienceType,
  BroadcastCampaignStatus,
  BroadcastDeliveryMode,
  BroadcastRecipientStatus,
  Prisma,
} from "@prisma/client";

import { prisma } from "~/lib/prisma.server";

export async function listBroadcastCampaignsByUser(
  userId: string,
  options?: { status?: BroadcastCampaignStatus }
) {
  return prisma.broadcastCampaign.findMany({
    where: {
      userId,
      archivedAt: null,
      ...(options?.status ? { status: options.status } : {}),
    },
    orderBy: { updatedAt: "desc" },
    include: {
      _count: { select: { recipients: true } },
    },
  });
}

export interface BroadcastIndexFilters {
  search?: string;
  status?: BroadcastCampaignStatus | "IN_FLIGHT" | "NEEDS_ATTENTION";
  /** Summary card: drafts + awaiting signature */
  draftsBucket?: boolean;
  audienceType?: BroadcastAudienceType;
  deliveryMode?: BroadcastDeliveryMode;
  dateFrom?: Date;
  dateTo?: Date;
  includeArchived?: boolean;
}

function buildIndexWhere(
  userId: string,
  filters: BroadcastIndexFilters
): Prisma.BroadcastCampaignWhereInput {
  const where: Prisma.BroadcastCampaignWhereInput = { userId };

  if (!filters.includeArchived) {
    where.archivedAt = null;
  }

  if (filters.search?.trim()) {
    const q = filters.search.trim();
    where.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { messageBody: { contains: q, mode: "insensitive" } },
    ];
  }

  if (filters.draftsBucket) {
    where.status = "DRAFT";
  } else if (filters.status === "IN_FLIGHT") {
    where.status = {
      in: ["AWAITING_SIGNATURE", "QUEUED", "SENDING", "PAUSED"],
    };
  } else if (filters.status === "NEEDS_ATTENTION") {
    where.status = { in: ["FAILED", "COMPLETED_WITH_FAILURES", "CANCELLED"] };
  } else if (filters.status) {
    where.status = filters.status;
  }

  if (filters.audienceType) {
    where.audienceType = filters.audienceType;
  }

  if (filters.deliveryMode) {
    where.deliveryMode = filters.deliveryMode;
  }

  if (filters.dateFrom || filters.dateTo) {
    where.updatedAt = {};
    if (filters.dateFrom) {
      where.updatedAt.gte = filters.dateFrom;
    }
    if (filters.dateTo) {
      where.updatedAt.lte = filters.dateTo;
    }
  }

  return where;
}

export async function listBroadcastCampaignsForIndex(
  userId: string,
  filters: BroadcastIndexFilters
) {
  const where = buildIndexWhere(userId, filters);
  return prisma.broadcastCampaign.findMany({
    where,
    orderBy: { updatedAt: "desc" },
    include: {
      _count: { select: { recipients: true } },
    },
  });
}

export interface BroadcastDashboardSummary {
  drafts: number;
  scheduled: number;
  inProgress: number;
  completed: number;
  attention: number;
}

export async function getBroadcastDashboardSummary(
  userId: string
): Promise<BroadcastDashboardSummary> {
  const rows = await prisma.broadcastCampaign.groupBy({
    by: ["status"],
    where: { userId, archivedAt: null },
    _count: { _all: true },
  });

  const count = (s: BroadcastCampaignStatus) =>
    rows.find((r) => r.status === s)?._count._all ?? 0;

  return {
    drafts: count("DRAFT"),
    scheduled: count("SCHEDULED"),
    inProgress:
      count("AWAITING_SIGNATURE") +
      count("QUEUED") +
      count("SENDING") +
      count("PAUSED"),
    completed: count("COMPLETED"),
    attention:
      count("FAILED") + count("COMPLETED_WITH_FAILURES") + count("CANCELLED"),
  };
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

export interface RecipientListFilters {
  status?: string;
  search?: string;
  take?: number;
  skip?: number;
}

export async function getBroadcastCampaignForUserWithRecipientSlice(
  campaignId: string,
  userId: string,
  recipientFilters: RecipientListFilters
) {
  const campaign = await prisma.broadcastCampaign.findFirst({
    where: { id: campaignId, userId },
    include: {
      eventLogs: {
        orderBy: { createdAt: "desc" },
        take: 50,
      },
    },
  });
  if (!campaign) return null;

  const take = Math.min(Math.max(recipientFilters.take ?? 100, 1), 500);
  const skip = Math.max(recipientFilters.skip ?? 0, 0);

  const recipientWhere: Prisma.BroadcastRecipientWhereInput = {
    campaignId,
  };
  if (
    recipientFilters.status &&
    recipientFilters.status !== "ALL" &&
    recipientFilters.status !== ""
  ) {
    recipientWhere.status = recipientFilters.status as BroadcastRecipientStatus;
  }
  if (recipientFilters.search?.trim()) {
    const q = recipientFilters.search.trim().toLowerCase();
    recipientWhere.recipientPubkey = { contains: q };
  }

  const [recipients, recipientTotal, aggregates] = await Promise.all([
    prisma.broadcastRecipient.findMany({
      where: recipientWhere,
      orderBy: { createdAt: "asc" },
      take,
      skip,
    }),
    prisma.broadcastRecipient.count({ where: recipientWhere }),
    prisma.broadcastRecipient.groupBy({
      by: ["failureCode"],
      where: {
        campaignId,
        status: "FAILED",
        failureCode: { not: null },
      },
      _count: { _all: true },
    }),
  ]);

  const deliverySplit = await prisma.broadcastRecipient.groupBy({
    by: ["deliveryMethodUsed"],
    where: { campaignId, status: "SENT" },
    _count: { _all: true },
  });

  const retrySum = await prisma.broadcastRecipient.aggregate({
    where: { campaignId },
    _sum: { attemptCount: true },
  });

  return {
    campaign,
    recipients,
    recipientTotal,
    failureByCode: aggregates,
    deliverySplit,
    retrySum: retrySum._sum.attemptCount ?? 0,
  };
}

export async function listSuppressionsByUser(userId: string) {
  return prisma.broadcastSuppression.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });
}

export async function countRecentBroadcastRecipientsForUser(
  userId: string,
  since: Date
): Promise<number> {
  return prisma.broadcastRecipient.count({
    where: {
      sentAt: { gte: since },
      campaign: { userId },
    },
  });
}

export async function countActiveBroadcastCampaignsForUser(
  userId: string
): Promise<number> {
  return prisma.broadcastCampaign.count({
    where: {
      userId,
      archivedAt: null,
      status: {
        in: ["SCHEDULED", "QUEUED", "SENDING", "PAUSED"],
      },
    },
  });
}
