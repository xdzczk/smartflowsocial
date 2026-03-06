/**
 * Referral settings data for the referrer (current user as referrer).
 */

import { ReferralEarningStatus } from "@prisma/client";

import { prisma } from "~/lib/prisma.server";

import { REFERRAL_COMMISSION_RATE_PERCENT } from "./referral-config.server";

/** Landing page URL for referral links (user lands here first, then goes to app to sign in). */
const REFERRAL_LANDING_URL_DEFAULT = "https://smartflow.social";

function getReferralLandingUrl(): string {
  const env = process.env["REFERRAL_LANDING_URL"];
  if (typeof env === "string" && env.length > 0) return env.replace(/\/$/, "");
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
    prisma.referralEarning.groupBy({
      by: ["status"],
      where: { referrerNpub },
      _sum: { commissionSats: true },
    }),
    prisma.referrerPayoutConfig.findUnique({
      where: { referrerNpub },
      select: { payoutDestination: true, payoutDestinationType: true },
    }),
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
