/**
 * Payment read-only queries: plans, subscription, payment history, status.
 */

import { prisma } from "~/lib/prisma.server";

/**
 * Gets a plan by its ID
 */
export async function getPlanById(planId: string) {
  return prisma.plan.findUnique({
    where: { id: planId },
  });
}

/**
 * Gets all plans from database
 */
export async function getAllPlans() {
  return await prisma.plan.findMany({
    where: { isActive: true },
    orderBy: { price: "asc" },
  });
}

/**
 * Gets user's current subscription info
 */
export async function getUserSubscription(userId: string) {
  return await prisma.subscription.findUnique({
    where: { userId },
    include: {
      Plan: true,
    },
  });
}

/**
 * Gets user's payment history
 */
export async function getUserPaymentHistory(userId: string) {
  return await prisma.payment.findMany({
    where: {
      userId,
      status: "COMPLETED",
    },
    orderBy: { paidAt: "desc" },
    take: 20,
    select: {
      id: true,
      amount: true,
      amountUsd: true,
      description: true,
      paidAt: true,
      paymentMethod: true,
      paymentHash: true,
      Subscription: {
        select: {
          Plan: {
            select: {
              name: true,
              price: true,
            },
          },
        },
      },
    },
  });
}

/**
 * Returns the userId that owns the payment, or null if not found.
 */
export async function getPaymentUserId(
  paymentId: string
): Promise<string | null> {
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    select: { userId: true },
  });
  return payment?.userId ?? null;
}

/**
 * Checks the status of a payment
 */
export async function checkPaymentStatus(paymentId: string): Promise<{
  status: string;
  paid: boolean;
  paidAt?: Date;
}> {
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    select: {
      status: true,
      paidAt: true,
    },
  });

  if (!payment) {
    throw new Error("Payment not found");
  }

  return {
    status: payment.status,
    paid: payment.status === "COMPLETED",
    paidAt: payment.paidAt ?? undefined,
  };
}
