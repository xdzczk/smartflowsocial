import type { ReactNode } from "react";
import { useMemo, useState } from "react";

import {
  ActionRail,
  ActionRailLabel,
  ActionRailNotice,
  ActionRailOutcome,
  ActionRailRow,
  ActionRailSection,
  RAIL_MAJOR_DIVIDE,
  RAIL_STACK_ROWS,
  RAIL_SUMMARY_TO_FEEDBACK,
} from "~/components/action-rail";
import type { PlanType } from "~/features/payments/types";
import { cn } from "~/lib/utils";

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

  const missingRequirements: string[] = [];
  if (!hasSourcePost) {
    missingRequirements.push(
      sourceMode === "create"
        ? contestCopy.railWarnNoSourceCreate
        : contestCopy.railWarnNoSourceExisting
    );
  }
  if (!endValid) {
    missingRequirements.push(contestCopy.railWarnEndInvalid);
  } else if (endPast) {
    missingRequirements.push(contestCopy.railWarnEndPast);
  }
  if (rankedIncomplete) {
    missingRequirements.push(contestCopy.railWarnRankedIncomplete);
  }

  const beforeSubmit: string[] = [];
  if (plannedPayoutSats <= 0) {
    beforeSubmit.push(contestCopy.railWarnZeroPayout);
  }
  if (endValid && !endPast && endSoon) {
    beforeSubmit.push(contestCopy.railWarnEndSoon);
  }
  if (noFairnessFilters) {
    beforeSubmit.push(contestCopy.railWarnNoFairness);
  }

  const hasHardBlockers = missingRequirements.length > 0;
  const outcomeLine = `${plannedPayoutSats.toLocaleString()} sats pool · ${winnerCount} winner${winnerCount !== 1 ? "s" : ""}`;

  return (
    <ActionRail ariaLabel="Contest summary" footer={footerActions}>
      <div className={cn("flex flex-col text-xs", RAIL_MAJOR_DIVIDE)}>
        <ActionRailSection>
          <ActionRailLabel>Contest options</ActionRailLabel>
          <div className={RAIL_STACK_ROWS}>
            <ActionRailRow
              label="Source"
              value={
                hasSourcePost
                  ? contestCopy.railSourceOk
                  : contestCopy.railSourceMissing
              }
              tone={hasSourcePost ? "default" : "warning"}
              placeholder={!hasSourcePost}
            />
            <ActionRailRow label="Metric" value={rankingMetric.toLowerCase()} />
            <ActionRailRow
              label="Ends"
              value={
                endValid ? end.toLocaleString() : contestCopy.railEndPlaceholder
              }
              placeholder={!endValid}
            />
            <ActionRailRow label="Winners" value={winnerCount} />
            <ActionRailRow label="Plan" value={planLabel} />
          </div>
        </ActionRailSection>

        <ActionRailSection>
          <ActionRailLabel>Contest summary</ActionRailLabel>
          <div className={RAIL_STACK_ROWS}>
            <ActionRailRow
              label="Planned pool"
              value={`${plannedPayoutSats.toLocaleString()} sats`}
            />
            <ActionRailRow label="Finalization fee" value={feePct} />
            <ActionRailRow
              label="Due at lock"
              value={`${feeSats.toLocaleString()} sats`}
            />
          </div>
        </ActionRailSection>

        <ActionRailSection className="space-y-2">
          {missingRequirements.length > 0 ? (
            <ActionRailNotice
              variant="error"
              title="Missing requirements"
              lines={missingRequirements}
              className={RAIL_SUMMARY_TO_FEEDBACK}
            />
          ) : null}
          {beforeSubmit.length > 0 ? (
            <ActionRailNotice
              variant="warning"
              title="Before you submit"
              lines={beforeSubmit}
              className={
                missingRequirements.length > 0
                  ? RAIL_SUMMARY_TO_FEEDBACK
                  : undefined
              }
            />
          ) : null}
          {!hasHardBlockers ? (
            <ActionRailOutcome
              className={RAIL_SUMMARY_TO_FEEDBACK}
              headline="Ready to launch"
              outcomeLine={outcomeLine}
            />
          ) : null}
        </ActionRailSection>
      </div>
    </ActionRail>
  );
}
