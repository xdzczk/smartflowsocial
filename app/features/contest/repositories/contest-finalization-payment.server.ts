import { prisma } from "~/lib/prisma.server";

export async function findPaidContestFinalizationForLock(
  contestId: string,
  userId: string,
  lockConfigHash: string
): Promise<boolean> {
  const row = await prisma.contestFinalizationPayment.findFirst({
    where: {
      contestId,
      userId,
      lockConfigHash,
      status: "PAID",
    },
    select: { id: true },
  });
  return !!row;
}

export async function completeContestFinalizationPayment(
  paymentId: string
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const payment = await tx.payment.update({
      where: { id: paymentId },
      data: {
        status: "COMPLETED",
        paidAt: new Date(),
      },
    });

    const finalization = await tx.contestFinalizationPayment.findFirst({
      where: { paymentId: payment.id },
    });
    if (!finalization) return;

    await tx.contestFinalizationPayment.update({
      where: { id: finalization.id },
      data: { status: "PAID", paidAt: new Date() },
    });
  });
}

export async function expireStaleFinalizationPaymentsForContest(
  contestId: string
): Promise<void> {
  await prisma.contestFinalizationPayment.updateMany({
    where: {
      contestId,
      status: "PENDING",
      payment: {
        status: { in: ["EXPIRED", "FAILED", "CANCELED"] },
      },
    },
    data: { status: "EXPIRED" },
  });
}
