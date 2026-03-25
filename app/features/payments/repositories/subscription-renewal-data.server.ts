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
    status?: "CANCELED" | "PAST_DUE" | "UNPAID" | "INACTIVE" | "ACTIVE";
    endDate?: Date;
    renewalFailureCount?: number;
    lastRenewalAttemptAt?: Date | null;
    nextRenewalAttemptAt?: Date | null;
    gracePeriodEndsAt?: Date | null;
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

export async function updateSubscriptionDunningState(
  userId: string,
  data: {
    status: "PAST_DUE" | "UNPAID";
    renewalFailureCount: number;
    lastRenewalAttemptAt: Date;
    nextRenewalAttemptAt: Date | null;
    gracePeriodEndsAt: Date | null;
  }
) {
  return updateSubscription(userId, data);
}
