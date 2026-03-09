/**
 * Subscription renewal data access. Prisma usage for renewal cron confined here.
 */

import { prisma } from "~/lib/prisma.server";

export async function findPlanById(planId: string) {
  return prisma.plan.findUnique({
    where: { id: planId },
  });
}

async function updateSubscription(
  userId: string,
  data: {
    cancelAtPeriodEnd?: boolean;
    metadata?: object;
    status?: "CANCELED";
    endDate?: Date;
  }
) {
  return prisma.subscription.update({
    where: { userId },
    data,
  });
}

export async function updateSubscriptionCancelAtPeriodEndAndMetadata(
  userId: string,
  data: { cancelAtPeriodEnd: boolean; metadata: object }
) {
  return updateSubscription(userId, data);
}

export async function updateSubscriptionToCanceled(
  userId: string,
  data: { status: "CANCELED"; endDate: Date; cancelAtPeriodEnd: boolean }
) {
  return updateSubscription(userId, data);
}
