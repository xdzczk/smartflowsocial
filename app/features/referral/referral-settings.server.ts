/**
 * Referral settings data for the referrer (current user as referrer).
 */

import { env } from "~/lib/env.server";

import { ReferralEarningStatus } from "./data/referral-prisma-types.server";
import { REFERRAL_COMMISSION_RATE_PERCENT } from "./referral-config.server";
import {
  aggregateEarningsByStatus,
  findReferrerPayoutConfigForSettings,
} from "./repositories/referral-data.server";

/** Landing page URL for referral links (user lands here first, then goes to app to sign in). */
const REFERRAL_LANDING_URL_DEFAULT = "https://smartflow.social";

function getReferralLandingUrl(): string {
  const url = env.REFERRAL_LANDING_URL;
  if (typeof url === "string" && url.length > 0) return url.replace(/\/$/, "");
  return REFERRAL_LANDING_URL_DEFAULT;
}

export interface ReferralSettingsData {
  referralLink: string;
  commissionRatePercent: number;
  totalEarnedSats: number;
  paidSats: number;
  pendingSats: number;
  failedSats: number;
  payoutDestination: string | null;
  payoutDestinationType: string | null;
}

export async function getReferralSettingsData(
  referrerNpub: string
): Promise<ReferralSettingsData> {
  const landingUrl = getReferralLandingUrl();
  const referralLink = `${landingUrl}/?ref=${encodeURIComponent(referrerNpub)}`;

  const [aggregates, config] = await Promise.all([
    aggregateEarningsByStatus(referrerNpub),
    findReferrerPayoutConfigForSettings(referrerNpub),
  ]);

  let paidSats = 0;
  let pendingSats = 0;
  let failedSats = 0;
  for (const row of aggregates) {
    const sum = row._sum.commissionSats ?? 0;
    if (row.status === ReferralEarningStatus.PAID) paidSats = sum;
    else if (row.status === ReferralEarningStatus.PENDING) pendingSats = sum;
    else failedSats = sum;
  }

  return {
    referralLink,
    commissionRatePercent: REFERRAL_COMMISSION_RATE_PERCENT,
    totalEarnedSats: paidSats + pendingSats + failedSats,
    paidSats,
    pendingSats,
    failedSats,
    payoutDestination: config?.payoutDestination ?? null,
    payoutDestinationType: config?.payoutDestinationType ?? null,
  };
}
