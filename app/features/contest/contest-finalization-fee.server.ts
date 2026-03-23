/* eslint-disable import/order -- Contest module import ordering will be normalized after feature stabilization. */
import { createHash } from "crypto";

import {
  computeContestFinalizationFeeSats,
  getContestFinalizationFeeRateBps,
} from "./contest-finalization-fee.shared";
import type { ContestPrizeMode, ContestRankReward } from "./types";
import type { PlanType } from "~/features/payments/types";

function stableSortRankRewards(
  rankRewards: ContestRankReward[]
): ContestRankReward[] {
  return [...rankRewards].sort((a, b) => a.rank - b.rank);
}

function computePlannedPayoutSats(input: {
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

function buildContestLockConfigHash(payload: Record<string, unknown>): string {
  const canonical = JSON.stringify(payload);
  return createHash("sha256").update(canonical).digest("hex");
}

export function quoteContestFinalization(input: {
  contest: {
    sourceNoteId: string;
    rankingMetric: string;
    contestEndAt: Date;
    prizeMode: ContestPrizeMode;
    winnerCount: number;
    equalRewardSats?: number | null;
    rankRewards?: ContestRankReward[] | null;
    fairnessConfig?: unknown;
    tieBreakRule?: string | null;
    snapshotId?: string | null;
  };
  planType: PlanType;
}) {
  const plannedPayoutSats = computePlannedPayoutSats(input.contest);
  const feeRateBps = getContestFinalizationFeeRateBps(input.planType);
  const { feeSats, waivedByPlan } = computeContestFinalizationFeeSats(
    plannedPayoutSats,
    feeRateBps
  );

  const lockConfigHash = buildContestLockConfigHash({
    sourceNoteId: input.contest.sourceNoteId,
    rankingMetric: input.contest.rankingMetric,
    contestEndAt: input.contest.contestEndAt.toISOString(),
    prizeMode: input.contest.prizeMode,
    winnerCount: input.contest.winnerCount,
    equalRewardSats: input.contest.equalRewardSats ?? null,
    rankRewards: stableSortRankRewards(input.contest.rankRewards ?? []),
    fairnessConfig: input.contest.fairnessConfig ?? null,
    tieBreakRule: input.contest.tieBreakRule ?? null,
    snapshotId: input.contest.snapshotId ?? null,
  });

  return {
    plannedPayoutSats,
    feeRateBps,
    feeSats,
    waivedByPlan,
    lockConfigHash,
  };
}
/* eslint-enable import/order */
