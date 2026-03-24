import { useMemo, useState } from "react";

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
    <aside className="border-border bg-card h-fit space-y-4 rounded-lg border p-4 lg:sticky lg:top-6">
      <div>
        <h2 className="text-sm font-semibold">{contestCopy.builderSummary}</h2>
        <p className="text-muted-foreground text-xs">
          {contestCopy.builderSummaryHint}
        </p>
      </div>
      <dl className="space-y-2 text-sm">
        <div className="flex justify-between gap-2">
          <dt className="text-muted-foreground">Source</dt>
          <dd className="text-right font-medium">
            {hasSourcePost
              ? contestCopy.railSourceOk
              : contestCopy.railSourceMissing}
          </dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-muted-foreground">Metric</dt>
          <dd className="text-right">{rankingMetric.toLowerCase()}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-muted-foreground">Ends</dt>
          <dd className="text-right">
            {endValid ? end.toLocaleString() : contestCopy.railEndPlaceholder}
          </dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-muted-foreground">Winners</dt>
          <dd className="text-right">{winnerCount}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-muted-foreground">Planned pool</dt>
          <dd className="text-right font-medium">
            {plannedPayoutSats.toLocaleString()} sats
          </dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-muted-foreground">Finalization fee</dt>
          <dd className="text-right">
            {feePct} · {feeSats.toLocaleString()} sats due at lock
          </dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-muted-foreground">Plan</dt>
          <dd className="text-right">{planLabel}</dd>
        </div>
      </dl>
      {warnings.length > 0 ? (
        <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3">
          <p className="mb-1 text-xs font-medium text-amber-900 dark:text-amber-100">
            {contestCopy.railWarningsTitle}
          </p>
          <ul className="text-muted-foreground list-inside list-disc text-xs">
            {warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </aside>
  );
}
