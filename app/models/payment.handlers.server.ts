/**
 * Payment event/webhook-style handlers: completion and timeout.
 */

import { recordReferralEarningIfAny } from "~/features/referral/record-referral-earning.server";
import { logError } from "~/lib/error-logger.server";
import { prisma } from "~/lib/prisma.server";

import { updateUserSubscription } from "./payment-subscription.server";

/**
 * Handles completed payments and updates user subscription.
 * Idempotent: if payment is already COMPLETED, returns without updating.
 */
export async function handlePaymentCompleted(
  paymentId: string,
  userId: string,
  planId: string
): Promise<void> {
  try {
    const existing = await prisma.payment.findUnique({
      where: { id: paymentId },
      select: { status: true },
    });
    if (existing?.status === "COMPLETED") {
      return;
    }

    await prisma.payment.update({
      where: { id: paymentId },
      data: {
        status: "COMPLETED",
        paidAt: new Date(),
      },
    });

    await updateUserSubscription(userId, planId, paymentId);

    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
      select: { amount: true },
    });
    if (payment?.amount != null && payment.amount > 0) {
      await recordReferralEarningIfAny(userId, paymentId, payment.amount);
    }
  } catch (error) {
    logError(error instanceof Error ? error : new Error(String(error)), {
      userId,
      planId,
      paymentId,
      message: "Error handling completed payment",
    });
    throw error;
  }
}

/**
 * Handles payment timeout
 */
export async function handlePaymentTimeout(paymentId: string): Promise<void> {
  try {
    await prisma.payment.update({
      where: { id: paymentId },
      data: {
        status: "EXPIRED",
        failedAt: new Date(),
        failureReason: "Payment timeout",
      },
    });
  } catch (error) {
    logError(error instanceof Error ? error : new Error(String(error)), {
      paymentId,
      message: "Error handling payment timeout",
    });
  }
}
