/**
 * Referral settings data for the referrer (current user as referrer).
 */

import { ReferralEarningStatus } from "@prisma/client";

import { prisma } from "~/lib/prisma.server";

import { REFERRAL_COMMISSION_RATE_PERCENT } from "./referral-config.server";

const DEFAULT_APP_URL = "https://smartflowsocial.com";

function getAppUrl(): string {
  const appUrl = process.env["APP_URL"];
  if (typeof appUrl === "string" && appUrl.length > 0) return appUrl;
  const vercelUrl = process.env["VERCEL_URL"];
  if (typeof vercelUrl === "string" && vercelUrl.length > 0) {
    return `https://${vercelUrl}`;
  }
  return DEFAULT_APP_URL;
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
  const baseUrl = getAppUrl().replace(/\/$/, "");
  const referralLink = `${baseUrl}/?ref=${encodeURIComponent(referrerNpub)}`;

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
