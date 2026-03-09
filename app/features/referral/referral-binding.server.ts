/**
 * Referral binding: persist referral at first auth when context exists.
 * One referrer per referred_npub; no self-referral; immutable.
 */

import type { ReferralContext } from "./referral-context.server";
import {
  bindReferralInTransaction,
  type Tx,
} from "./repositories/referral-data.server";

export type { Tx };

export async function bindReferralIfEligible(
  tx: Tx,
  referredNpub: string,
  referralContext: ReferralContext | null
): Promise<void> {
  if (!referralContext) return;

  const referrerNpub = referralContext.referrer_npub.trim();
  if (referrerNpub === referredNpub) return; // self-referral blocked

  await bindReferralInTransaction(tx, referredNpub, referrerNpub);
}
