/**
 * Record referral earning when a subscription payment is settled.
 * Idempotent: unique on (referrer_npub, payment_id); duplicate insert is no-op.
 */

import { ReferralEarningStatus } from "./data/referral-prisma-types.server";
import { computeReferralCommissionSats } from "./referral-config.server";
import {
  createReferralEarning,
  findReferralByReferredNpubSelectReferrer,
  findUserNpubById,
} from "./repositories/referral-data.server";

export async function recordReferralEarningIfAny(
  payerUserId: string,
  paymentId: string,
  amountPaidSats: number
): Promise<void> {
  if (amountPaidSats <= 0) return;

  const user = await findUserNpubById(payerUserId);
  if (!user) return;

  const referral = await findReferralByReferredNpubSelectReferrer(user.npub);
  if (!referral) return;

  const commissionSats = computeReferralCommissionSats(amountPaidSats);
  if (commissionSats <= 0) return;

  try {
    await createReferralEarning({
      referrerNpub: referral.referrerNpub,
      referredNpub: user.npub,
      paymentId,
      amountPaidSats,
      commissionSats,
      status: ReferralEarningStatus.PENDING,
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
