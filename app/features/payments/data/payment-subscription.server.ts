/**
 * Subscription update logic shared by payment commands and handlers.
 * Isolated to avoid circular dependency between commands and handlers.
 */

import { prisma } from "~/lib/prisma.server";

/**
 * Updates user subscription and account status
 */
export async function updateUserSubscription(
  userId: string,
  planId: string,
  paymentId: string
): Promise<void> {
  const plan = await prisma.plan.findUnique({
    where: { id: planId },
  });

  if (!plan) {
    throw new Error(`Plan ${planId} not found`);
  }

  let satsAmount = 0;
  let payment = null;

  if (paymentId && !paymentId.startsWith("free_")) {
    payment = await prisma.payment.findUnique({
      where: { id: paymentId },
      select: { amount: true },
    });
    satsAmount = payment?.amount ?? 0;
  }

  const now = new Date();
  const isLifetime = plan.enableLifetimeAccess;
  const BILLING_PERIOD_DAYS = 30;

  const currentPeriodStart = now;
  let currentPeriodEnd: Date | null = null;
  let nextPaymentDue: Date | null = null;

  if (!isLifetime) {
    const periodMs = BILLING_PERIOD_DAYS * 24 * 60 * 60 * 1000;
    currentPeriodEnd = new Date(now.getTime() + periodMs);
    nextPaymentDue = currentPeriodEnd;
  }

  await prisma.$transaction(async (tx) => {
    const subscriptionId = `sub_${userId}_${planId}_${Date.now()}`;

    const subscription = await tx.subscription.upsert({
      where: { userId },
      create: {
        id: subscriptionId,
        userId,
        planId,
        status: "ACTIVE",
        currentPeriodStart,
        currentPeriodEnd,
        nextPaymentDue,
        startDate: now,
        lastPaymentDate: now,
        plan: planId,
        amountSats: BigInt(satsAmount),
        amountUsd: plan.price,
      },
      update: {
        planId,
        status: "ACTIVE",
        currentPeriodStart,
        currentPeriodEnd,
        nextPaymentDue,
        lastPaymentDate: now,
        plan: planId,
        amountSats: BigInt(satsAmount),
        amountUsd: plan.price,
        cancelAtPeriodEnd: false,
      },
      select: { id: true },
    });

    if (payment && paymentId && !paymentId.startsWith("free_")) {
      await tx.payment.update({
        where: { id: paymentId },
        data: {
          subscriptionId: subscription.id,
        },
      });
    }

    await tx.user.update({
      where: { id: userId },
      data: {
        isEnabled: true,
      },
    });
  });
}
