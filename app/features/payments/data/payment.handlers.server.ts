/**
 * Payment event/webhook-style handlers: completion and timeout.
 */

import { completeGiveawayFinalizationPayment } from "~/features/giveaway/repositories/giveaway-finalization-payment.server";
import { recordReferralEarningIfAny } from "~/features/referral/record-referral-earning.server";
import { logError } from "~/lib/error-logger.server";
import { prisma } from "~/lib/prisma.server";

import { extendUserSubscriptionFromPayment } from "./payment-subscription.server";

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
      select: { status: true, purpose: true },
    });
    if (existing?.status === "COMPLETED") {
      return;
    }

    if (existing?.purpose === "GIVEAWAY_FINALIZATION") {
      await completeGiveawayFinalizationPayment(paymentId);
      return;
    }

    await prisma.payment.update({
      where: { id: paymentId },
      data: {
        status: "COMPLETED",
        paidAt: new Date(),
      },
    });

    await extendUserSubscriptionFromPayment(userId, planId, paymentId);

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

    await prisma.giveawayFinalizationPayment.updateMany({
      where: { paymentId, status: "PENDING" },
      data: { status: "EXPIRED" },
    });
  } catch (error) {
    logError(error instanceof Error ? error : new Error(String(error)), {
      paymentId,
      message: "Error handling payment timeout",
    });
  }
}
