/**
 * Referral binding: persist referral at first auth when context exists.
 * One referrer per referred_npub; no self-referral; immutable.
 */

import type { prisma } from "~/lib/prisma.server";

import type { ReferralContext } from "./referral-context.server";

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

export async function bindReferralIfEligible(
  tx: Tx,
  referredNpub: string,
  referralContext: ReferralContext | null
): Promise<void> {
  if (!referralContext) return;

  const referrerNpub = referralContext.referrer_npub.trim();
  if (referrerNpub === referredNpub) return; // self-referral blocked

  const existing = await tx.referral.findUnique({
    where: { referredNpub },
    select: { referredNpub: true },
  });
  if (existing) return;

  await tx.referral.create({
    data: {
      referrerNpub,
      referredNpub,
    },
  });
}
