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

const RENEWAL_CLAIM_MS = 20 * 60 * 1000;
const RENEWAL_LOCK_NAMESPACE = 884422;

function renewalAdvisoryKey(userId: string): number {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = (Math.imul(hash, 31) + userId.charCodeAt(i)) | 0;
  }
  return hash;
}

function renewalLockKey(userId: string): bigint {
  const userKey = BigInt(renewalAdvisoryKey(userId) >>> 0);
  return BigInt(RENEWAL_LOCK_NAMESPACE) * 4294967296n + userKey;
}

/**
 * Claims one renewal attempt for this subscriber. The advisory lock stops two
 * workers from passing the check together. `nextRenewalAttemptAt` keeps the
 * claim after the transaction commits, so a second sweep will not create
 * another invoice while this one is in flight.
 */
export async function claimSubscriptionRenewalAttempt(
  userId: string,
  now: Date
): Promise<boolean> {
  const claimUntil = new Date(now.getTime() + RENEWAL_CLAIM_MS);
  const lockKey = renewalLockKey(userId);
  return prisma.$transaction(async (tx) => {
    const lockRows = await tx.$queryRaw<Array<{ locked: boolean | string }>>`
      SELECT pg_try_advisory_xact_lock(${lockKey}) AS locked
    `;
    const locked = lockRows[0]?.locked;
    if (locked !== true && locked !== "t") return false;

    const updated = await tx.subscription.updateMany({
      where: {
        userId,
        OR: [
          { nextRenewalAttemptAt: null },
          { nextRenewalAttemptAt: { lte: now } },
        ],
      },
      data: {
        lastRenewalAttemptAt: now,
        nextRenewalAttemptAt: claimUntil,
      },
    });
    return updated.count === 1;
  });
}

export async function findOpenRenewalPaymentForPeriod(params: {
  userId: string;
  periodEnd: Date;
}) {
  return prisma.payment.findFirst({
    where: {
      userId: params.userId,
      purpose: "SUBSCRIPTION",
      billingPaymentMethod: "nwc_auto_renew",
      createdAt: { gte: params.periodEnd },
      status: { in: ["PENDING", "COMPLETED"] },
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      status: true,
      invoice: true,
      expiresAt: true,
      subscriptionId: true,
    },
  });
}

export async function attachPaymentSubscription(
  paymentId: string,
  subscriptionId: string
): Promise<void> {
  await prisma.payment.update({
    where: { id: paymentId },
    data: { subscriptionId },
  });
}
