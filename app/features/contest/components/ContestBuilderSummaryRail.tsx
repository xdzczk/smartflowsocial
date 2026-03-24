import type { ReactNode } from "react";
import { useMemo, useState } from "react";

import { CampaignSummaryRailShell } from "~/features/campaign-ui";
import type { PlanType } from "~/features/payments/types";

import { contestCopy } from "../contest-copy";
import {
  computeContestFinalizationFeeSats,
  computePlannedPayoutSats,
  getContestFinalizationFeeRateBps,
} from "../contest-finalization-fee.shared";
import type { ContestPrizeMode, ContestRankReward } from "../types";

export function ContestBuilderSummaryRail({
  planType,
  planLabel,
  sourceMode,
  hasSourcePost,
  rankingMetric,
  contestEndAt,
  prizeMode,
  winnerCount,
  equalRewardSats,
  rankRewards,
  fairness,
  footerActions,
}: {
  planType: PlanType;
  planLabel: string;
  sourceMode: "create" | "existing";
  hasSourcePost: boolean;
  rankingMetric: string;
  contestEndAt: string;
  prizeMode: ContestPrizeMode;
  winnerCount: number;
  equalRewardSats: number;
  rankRewards: number[];
  fairness: {
    excludeMuted: boolean;
    excludeBlocked: boolean;
    excludeLowTrust: boolean;
    excludeNonFollowers: boolean;
    minAccountAgeDays: number;
    minFollowers: number;
  };
  footerActions?: ReactNode;
}) {
  const [now] = useState(() => Date.now());

  const rankRewardsJson: ContestRankReward[] = useMemo(
    () =>
      rankRewards.map((sats, i) => ({
        rank: i + 1,
        sats: Math.max(0, sats),
      })),
    [rankRewards]
  );

  const plannedPayoutSats = useMemo(
    () =>
      computePlannedPayoutSats({
        prizeMode,
        winnerCount,
        equalRewardSats: prizeMode === "EQUAL" ? equalRewardSats : null,
        rankRewards: prizeMode === "RANKED" ? rankRewardsJson : null,
      }),
    [prizeMode, winnerCount, equalRewardSats, rankRewardsJson]
  );

  const feeRateBps = getContestFinalizationFeeRateBps(planType);
  const { feeSats } = computeContestFinalizationFeeSats(
    plannedPayoutSats,
    feeRateBps
  );
  const feePct = feeRateBps > 0 ? `${(feeRateBps / 100).toFixed(1)}%` : "0%";

  const end = contestEndAt.trim() ? new Date(contestEndAt) : null;
  const endValid = end != null && Number.isFinite(end.getTime());
  const endMs = endValid ? end.getTime() : null;
  const endPast = endMs != null && endMs < now;
  const endSoon = endMs != null && endMs > now && endMs - now < 60 * 60 * 1000;

  const rankedIncomplete =
    prizeMode === "RANKED" && !rankRewardsJson.some((r) => r.sats > 0);

  const noFairnessFilters =
    !fairness.excludeMuted &&
    !fairness.excludeBlocked &&
    !fairness.excludeLowTrust &&
    !fairness.excludeNonFollowers &&
    fairness.minAccountAgeDays <= 0 &&
    fairness.minFollowers <= 0;

  const warnings: string[] = [];
  if (!hasSourcePost) {
    warnings.push(
      sourceMode === "create"
        ? contestCopy.railWarnNoSourceCreate
        : contestCopy.railWarnNoSourceExisting
    );
  }
  if (!endValid) {
    warnings.push(contestCopy.railWarnEndInvalid);
  } else if (endPast) {
    warnings.push(contestCopy.railWarnEndPast);
  } else if (endSoon) {
    warnings.push(contestCopy.railWarnEndSoon);
  }
  if (plannedPayoutSats <= 0) {
    warnings.push(contestCopy.railWarnZeroPayout);
  }
  if (rankedIncomplete) {
    warnings.push(contestCopy.railWarnRankedIncomplete);
  }
  if (noFairnessFilters) {
    warnings.push(contestCopy.railWarnNoFairness);
  }

  return (
    <CampaignSummaryRailShell
      title={contestCopy.builderSummary}
      hint={contestCopy.builderSummaryHint}
      rows={[
        {
          label: "Source",
          value: (
            <span className="font-medium">
              {hasSourcePost
                ? contestCopy.railSourceOk
                : contestCopy.railSourceMissing}
            </span>
          ),
        },
        { label: "Metric", value: rankingMetric.toLowerCase() },
        {
          label: "Ends",
          value: endValid
            ? end.toLocaleString()
            : contestCopy.railEndPlaceholder,
        },
        { label: "Winners", value: winnerCount },
        {
          label: "Planned pool",
          value: (
            <span className="font-medium">
              {plannedPayoutSats.toLocaleString()} sats
            </span>
          ),
        },
        {
          label: "Finalization fee",
          value: `${feePct} · ${feeSats.toLocaleString()} sats due at lock`,
        },
        { label: "Plan", value: planLabel },
      ]}
      warningsTitle={contestCopy.railWarningsTitle}
      warnings={warnings}
      footer={footerActions}
    />
  );
}
