/**
 * Referral commission config. Stored in config, not DB (for now).
 * amount_paid_sats = gross; commission_sats = floor(amount_paid_sats * rate / 100), integer only.
 */

export const REFERRAL_COMMISSION_RATE_PERCENT = 20;

export function computeReferralCommissionSats(amountPaidSats: number): number {
  return Math.floor((amountPaidSats * REFERRAL_COMMISSION_RATE_PERCENT) / 100);
}
