/**
 * Persists and completes Lightning payments for giveaway finalization fees.
 */

import { recordReferralEarningIfAny } from "~/features/referral/record-referral-earning.server";
import { prisma } from "~/lib/prisma.server";

import { appendGiveawayActivityLog } from "../giveaway-activity-log.server";

/**
 * Marks Payment COMPLETED, finalization row PAID, and appends activity (idempotent).
 */
export async function completeGiveawayFinalizationPayment(
  paymentId: string
): Promise<void> {
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    select: {
      id: true,
      status: true,
      purpose: true,
      userId: true,
      amount: true,
    },
  });

  if (payment?.purpose !== "GIVEAWAY_FINALIZATION") {
    throw new Error("Not a giveaway finalization payment");
  }

  if (payment.status === "COMPLETED") {
    return;
  }

  const gfp = await prisma.giveawayFinalizationPayment.findFirst({
    where: { paymentId },
  });

  if (!gfp) {
    throw new Error("Giveaway finalization record missing");
  }

  await prisma.$transaction(async (tx) => {
    await tx.payment.update({
      where: { id: paymentId },
      data: {
        status: "COMPLETED",
        paidAt: new Date(),
      },
    });

    if (gfp.status === "PENDING") {
      await tx.giveawayFinalizationPayment.update({
        where: { id: gfp.id },
        data: {
          status: "PAID",
          paidAt: new Date(),
        },
      });
    }

    const g = await tx.giveaway.findUnique({
      where: { id: gfp.giveawayId },
      select: { id: true, activityLog: true },
    });
    if (g) {
      await tx.giveaway.update({
        where: { id: g.id },
        data: {
          activityLog: appendGiveawayActivityLog(g.activityLog, "fee_paid", {
            feeSats: gfp.feeSats,
            planName: gfp.planName,
            paymentId,
          }),
        },
      });
    }
  });

  if (payment.amount > 0) {
    await recordReferralEarningIfAny(payment.userId, paymentId, payment.amount);
  }
}

export async function findPaidFinalizationForLock(
  giveawayId: string,
  userId: string,
  lockConfigHash: string
) {
  return prisma.giveawayFinalizationPayment.findFirst({
    where: {
      giveawayId,
      userId,
      lockConfigHash,
      status: "PAID",
    },
  });
}

export async function expireStaleFinalizationPaymentsForGiveaway(
  giveawayId: string
): Promise<void> {
  const pending = await prisma.giveawayFinalizationPayment.findMany({
    where: { giveawayId, status: "PENDING" },
    select: { id: true, paymentId: true },
  });
  for (const row of pending) {
    await prisma.$transaction(async (tx) => {
      await tx.giveawayFinalizationPayment.update({
        where: { id: row.id },
        data: { status: "EXPIRED" },
      });
      if (row.paymentId) {
        await tx.payment.updateMany({
          where: {
            id: row.paymentId,
            status: "PENDING",
          },
          data: {
            status: "EXPIRED",
            failedAt: new Date(),
            failureReason: "Superseded by new finalization invoice",
          },
        });
      }
    });
  }
}
