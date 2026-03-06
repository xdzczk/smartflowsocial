/**
 * Record referral earning when a subscription payment is settled.
 * Idempotent: unique on (referrer_npub, payment_id); duplicate insert is no-op.
 */

import { ReferralEarningStatus } from "@prisma/client";

import { prisma } from "~/lib/prisma.server";

import { computeReferralCommissionSats } from "./referral-config.server";

export async function recordReferralEarningIfAny(
  payerUserId: string,
  paymentId: string,
  amountPaidSats: number
): Promise<void> {
  if (amountPaidSats <= 0) return;

  const user = await prisma.user.findUnique({
    where: { id: payerUserId },
    select: { npub: true },
  });
  if (!user) return;

  const referral = await prisma.referral.findUnique({
    where: { referredNpub: user.npub },
    select: { referrerNpub: true },
  });
  if (!referral) return;

  const commissionSats = computeReferralCommissionSats(amountPaidSats);
  if (commissionSats <= 0) return;

  try {
    await prisma.referralEarning.create({
      data: {
        referrerNpub: referral.referrerNpub,
        referredNpub: user.npub,
        paymentId,
        amountPaidSats,
        commissionSats,
        status: ReferralEarningStatus.PENDING,
      },
    });
  } catch (error: unknown) {
    const code =
      error && typeof error === "object" && "code" in error
        ? (error as { code: string }).code
        : undefined;
    if (code === "P2002") {
      // Unique violation (referrer_npub, payment_id) - already recorded, idempotent success
      return;
    }
    throw error;
  }
}
