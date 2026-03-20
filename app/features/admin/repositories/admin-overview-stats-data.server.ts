/**
 * Operator dashboard: aggregate DB stats (global counts).
 *
 * Semantics:
 * - Short posts: `Post.currentState` is the state-machine source of truth.
 *   "Scheduled" in product terms ≈ states like SCHEDULED / PUBLISHING (see post state machine).
 * - Long-form: `LongFormPost.currentState` same idea (see longform-post-state).
 */

import { ReferralEarningStatus, SubscriptionStatus } from "@prisma/client";

import { getReferrersEligibleForPayout } from "~/features/referral/referral-payout.server";
import { prisma } from "~/lib/prisma.server";

const PAYOUT_PREVIEW_NPUBS = 20;

export interface AdminOverviewStats {
  usersTotal: number;
  usersEnabled: number;
  subscriptionsActive: number;
  postsByCurrentState: Array<{ currentState: string; count: number }>;
  longFormByCurrentState: Array<{ currentState: string; count: number }>;
  referralLinkCount: number;
  referralEarningsByStatus: {
    pending: number;
    paid: number;
    failed: number;
  };
  referralPendingCommissionSats: number;
  referralPayoutEligibleCount: number;
  referralPayoutEligiblePreviewNpubs: string[];
}

export async function getAdminOverviewStats(): Promise<AdminOverviewStats> {
  const [
    usersTotal,
    usersEnabled,
    subscriptionsActive,
    postsGrouped,
    longFormGrouped,
    referralLinkCount,
    earningsGrouped,
    pendingCommission,
    eligibleReferrers,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { isEnabled: true } }),
    prisma.subscription.count({
      where: { status: SubscriptionStatus.ACTIVE },
    }),
    prisma.post.groupBy({
      by: ["currentState"],
      _count: { _all: true },
    }),
    prisma.longFormPost.groupBy({
      by: ["currentState"],
      _count: { _all: true },
    }),
    prisma.referral.count(),
    prisma.referralEarning.groupBy({
      by: ["status"],
      _count: { _all: true },
    }),
    prisma.referralEarning.aggregate({
      where: { status: ReferralEarningStatus.PENDING },
      _sum: { commissionSats: true },
    }),
    getReferrersEligibleForPayout(),
  ]);

  const earningsByStatus = {
    pending: 0,
    paid: 0,
    failed: 0,
  };
  for (const row of earningsGrouped) {
    switch (row.status) {
      case ReferralEarningStatus.PENDING:
        earningsByStatus.pending = row._count._all;
        break;
      case ReferralEarningStatus.PAID:
        earningsByStatus.paid = row._count._all;
        break;
      case ReferralEarningStatus.FAILED:
        earningsByStatus.failed = row._count._all;
        break;
      default:
        break;
    }
  }

  const postsByCurrentState = [...postsGrouped]
    .map((r) => ({
      currentState: r.currentState,
      count: r._count._all,
    }))
    .sort((a, b) => b.count - a.count);

  const longFormByCurrentState = [...longFormGrouped]
    .map((r) => ({
      currentState: r.currentState,
      count: r._count._all,
    }))
    .sort((a, b) => b.count - a.count);

  return {
    usersTotal,
    usersEnabled,
    subscriptionsActive,
    postsByCurrentState,
    longFormByCurrentState,
    referralLinkCount,
    referralEarningsByStatus: earningsByStatus,
    referralPendingCommissionSats: pendingCommission._sum.commissionSats ?? 0,
    referralPayoutEligibleCount: eligibleReferrers.length,
    referralPayoutEligiblePreviewNpubs: eligibleReferrers
      .slice(0, PAYOUT_PREVIEW_NPUBS)
      .map((e) => e.referrerNpub),
  };
}
