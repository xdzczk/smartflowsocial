import type { PlanType } from "~/features/payments/types";

import type { ContestPrizeMode, ContestRankReward } from "./types";

export function stableSortRankRewards(
  rankRewards: ContestRankReward[]
): ContestRankReward[] {
  return [...rankRewards].sort((a, b) => a.rank - b.rank);
}

/** Planned prize pool (sats) from contest prize settings  -  shared by quotes and builder UI. */
export function computePlannedPayoutSats(input: {
  prizeMode: ContestPrizeMode;
  winnerCount: number;
  equalRewardSats?: number | null;
  rankRewards?: ContestRankReward[] | null;
}): number {
  if (input.prizeMode === "EQUAL") {
    return (
      Math.max(0, input.winnerCount) * Math.max(0, input.equalRewardSats ?? 0)
    );
  }
  const rewards = stableSortRankRewards(input.rankRewards ?? []);
  return rewards
    .slice(0, Math.max(0, input.winnerCount))
    .reduce((sum, row) => sum + Math.max(0, row.sats), 0);
}

export function getContestFinalizationFeeRateBps(planType: PlanType): number {
  if (planType === "free") return 1000;
  if (planType === "creator") return 500;
  return 0;
}

export function computeContestFinalizationFeeSats(
  plannedPayoutSats: number,
  feeRateBps: number
): { feeSats: number; waivedByPlan: boolean } {
  if (feeRateBps <= 0) {
    return { feeSats: 0, waivedByPlan: plannedPayoutSats > 0 };
  }
  if (plannedPayoutSats <= 0) {
    return { feeSats: 0, waivedByPlan: false };
  }
  let feeSats = Math.floor((plannedPayoutSats * feeRateBps) / 10000);
  if (feeSats <= 0) feeSats = 1;
  return { feeSats, waivedByPlan: false };
}
