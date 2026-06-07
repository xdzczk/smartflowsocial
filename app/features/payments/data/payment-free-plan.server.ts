import { FREE_PLAN_ID } from "~/features/payments/plan-ids";
import type { InvoiceResponse } from "~/features/payments/types";
import { prisma } from "~/lib/prisma.server";

import { updateUserSubscription } from "./payment-subscription.server";
import { getUserSubscription } from "./payment.queries.server";

/** Minimal free plan data so dashboard can assign new users even if seed wasn't run. */
export const FREE_PLAN_SEED = {
  id: FREE_PLAN_ID,
  name: "Free",
  price: 0,
  description: "Perfect for getting started",
  features: {
    basicScheduling: true,
    multipleQueues: false,
    bulkScheduling: false,
    repostsAndQuotes: false,
    engagementFeed: true,
    giveaways: true,
    contests: true,
    commissions: "High",
    leaderboards: false,
    advancedAnalytics: false,
    multiAccountSwitching: false,
    wolfFilteringAndVortex: false,
    nativeS3BlossomStorage: false,
    relayBlast: false,
    visualPerks: false,
    lifetimeAccess: false,
  },
  maxPostsPerMonth: 10,
  maxQueueTypes: 1,
  maxTemplates: 3,
  maxLongFormPosts: 2,
  enableBasicScheduling: true,
  enableMultipleQueues: false,
  enableBulkScheduling: false,
  enableRepostsAndQuotes: false,
  enableEngagementFeed: true,
  enableGiveaways: true,
  enableContests: true,
  enableCommissions: false,
  enableLeaderboards: false,
  enableAdvancedAnalytics: false,
  enableMultiAccountSwitching: false,
  enableWolfFilteringAndVortex: false,
  enableNativeS3BlossomStorage: false,
  enableRelayBlast: false,
  enableVisualPerks: false,
  enableLifetimeAccess: false,
};

export async function ensureFreePlanExists(): Promise<void> {
  await prisma.plan.upsert({
    where: { id: FREE_PLAN_ID },
    create: { ...FREE_PLAN_SEED, updatedAt: new Date() },
    update: {},
  });
}

export async function handleFreePlanInvoice(
  userId: string,
  planId: string,
  description: string | undefined
): Promise<InvoiceResponse> {
  const paymentId = `free_${Date.now()}_${userId}`;
  await prisma.payment.create({
    data: {
      id: paymentId,
      userId,
      amount: 0,
      amountUsd: 0,
      invoice: "free_plan",
      paymentHash: "free_plan",
      status: "COMPLETED",
      description: description ?? `Free plan subscription`,
      paidAt: new Date(),
    },
  });

  await updateUserSubscription(userId, planId, paymentId);

  return {
    invoice: "free_plan",
    paymentHash: "free_plan",
    amount: 0,
    amountUsd: 0,
    expiresAt: new Date(Date.now() + 30 * 60 * 1000),
    paymentId,
  };
}

/**
 * Ensures the user has a free plan subscription (and is enabled).
 */
export async function ensureUserHasFreePlan(userId: string): Promise<void> {
  await ensureFreePlanExists();

  const [user, subscription, freePlan] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, isEnabled: true },
    }),
    getUserSubscription(userId),
    prisma.plan.findUnique({
      where: { id: FREE_PLAN_ID },
      select: { id: true, price: true },
    }),
  ]);

  if (!user || !freePlan) {
    return;
  }

  const isFreeInactive =
    subscription?.planId === FREE_PLAN_ID && subscription.status !== "ACTIVE";

  if (subscription && !isFreeInactive) {
    return;
  }

  const now = new Date();

  if (isFreeInactive) {
    await prisma.$transaction(async (tx) => {
      await tx.subscription.update({
        where: { userId },
        data: {
          status: "ACTIVE",
          lastPaymentDate: now,
        },
      });
      await tx.user.update({
        where: { id: userId },
        data: { isEnabled: true },
      });
    });
    return;
  }

  const subscriptionId = `sub_${userId}_${FREE_PLAN_ID}_${Date.now()}`;

  await prisma.$transaction(async (tx) => {
    await tx.subscription.create({
      data: {
        id: subscriptionId,
        userId,
        planId: FREE_PLAN_ID,
        status: "ACTIVE",
        startDate: now,
        currentPeriodStart: now,
        currentPeriodEnd: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
        lastPaymentDate: now,
        plan: FREE_PLAN_ID,
        amountSats: BigInt(0),
        amountUsd: freePlan.price,
      },
    });
    await tx.user.update({
      where: { id: userId },
      data: { isEnabled: true },
    });
  });
}
