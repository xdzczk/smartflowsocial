import type { ReactNode } from "react";
import { useMemo, useState } from "react";

import {
  ActionRailLabel,
  ActionRailSection,
  type ActionRailRowTone,
  railFieldClassNames,
} from "~/components/action-rail";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  buildContestOutcomePoolLine,
  CampaignActionRail,
  type CampaignActionRailSnapshotRow,
} from "~/features/campaign-ui";
import type { PlanType } from "~/features/payments/types";
import { RailSegmentedTabGroup } from "~/features/posts/components/publishing-rail/RailSegmentedTabGroup";
import {
  clampDateTimeLocalToMin,
  getNowForDateTimeLocal,
} from "~/lib/temporal";

import { contestCopy } from "../contest-copy";
import {
  computeContestFinalizationFeeSats,
  computePlannedPayoutSats,
  getContestFinalizationFeeRateBps,
} from "../contest-finalization-fee.shared";
import { getContestLaunchCtaConfig } from "../contest-launch-cta-config";
import type { ContestPrizeMode, ContestRankReward } from "../types";

const LAUNCH_TABS = [
  { id: "now", label: "Now", ariaLabel: "Launch now" },
  { id: "schedule", label: "Schedule", ariaLabel: "Schedule for later" },
] as const;

export interface ContestReadinessItem {
  id: string;
  label: string;
  satisfied: boolean;
  isError?: boolean;
}

function launchHintLine(
  launchMode: "now" | "schedule",
  sourceMode: "create" | "existing"
): string {
  if (launchMode === "now") {
    return sourceMode === "existing"
      ? "Launches immediately with the selected post."
      : "Publishes the source post, then launches.";
  }
  return sourceMode === "existing"
    ? "Activates at the scheduled time."
    : "Publishes the source post, then activates on schedule.";
}

export function ContestBuilderSummaryRail({
  planType,
  planLabel,
  sourceMode,
  hasSourcePost,
  hasValidNewPostComposer,
  rankingMetric,
  contestEndAt,
  prizeMode,
  winnerCount,
  equalRewardSats,
  rankRewards,
  fairness: _fairness,
  launchMode,
  onLaunchModeChange,
  scheduledActivationFor,
  onScheduledActivationForChange,
  userTimezone,
  readinessRequired,
  readinessRecommended,
  primaryCtaDisabled: _primaryCtaDisabled,
  footerActions,
  className,
}: {
  planType: PlanType;
  planLabel: string;
  sourceMode: "create" | "existing";
  hasSourcePost: boolean;
  /** When source is create-new, true if composer has content/media to publish. */
  hasValidNewPostComposer: boolean;
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
  launchMode: "now" | "schedule";
  onLaunchModeChange: (next: "now" | "schedule") => void;
  scheduledActivationFor: string;
  onScheduledActivationForChange: (next: string) => void;
  userTimezone: string;
  readinessRequired: ContestReadinessItem[];
  readinessRecommended: ContestReadinessItem[];
  primaryCtaDisabled: boolean;
  footerActions?: ReactNode;
  /** Merged into `ActionRail` (e.g. `lg:static` when a parent owns `position: sticky`). */
  className?: string;
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

  const scheduleHelper =
    sourceMode === "existing"
      ? contestCopy.railScheduleHelperExisting
      : contestCopy.railScheduleHelperCreate;

  const ctaConfig = getContestLaunchCtaConfig(sourceMode, launchMode);

  const sourceOk =
    sourceMode === "existing"
      ? hasSourcePost
      : hasValidNewPostComposer || hasSourcePost;

  const modeLine =
    launchMode === "now"
      ? "Now"
      : scheduledActivationFor.trim()
        ? new Date(scheduledActivationFor).toLocaleString(undefined, {
            dateStyle: "medium",
            timeStyle: "short",
          })
        : "—";

  const outcomeLine = buildContestOutcomePoolLine({
    plannedPayoutSats,
    winnerCount,
  });

  const minSchedule = getNowForDateTimeLocal(userTimezone);

  const blockerLines = readinessRequired
    .filter((r) => !r.satisfied && r.isError)
    .map((r) => r.label);

  const blocker =
    blockerLines.length > 0
      ? {
          variant: "warning" as const,
          title: contestCopy.railBlockerTitle,
          lines: blockerLines,
        }
      : null;

  const hasRecommendedGap = readinessRecommended.some((r) => !r.satisfied);

  const scheduleActivationRows: CampaignActionRailSnapshotRow[] =
    launchMode === "schedule"
      ? [
          {
            label: contestCopy.railRowActivation,
            value: modeLine,
            emphasis: "primary",
          },
        ]
      : [];

  const optionalHintRows: CampaignActionRailSnapshotRow[] = hasRecommendedGap
    ? [
        {
          label: "Optional",
          value: contestCopy.railOptionalHint,
          tone: "muted",
          emphasis: "muted",
        },
      ]
    : [];

  const sourceStatusTone: ActionRailRowTone = sourceOk ? "default" : "warning";

  const snapshotRows: CampaignActionRailSnapshotRow[] = [
    {
      label: "Source",
      emphasis: "primary",
      value:
        sourceMode === "existing"
          ? contestCopy.railSourceModeExisting
          : contestCopy.railSourceModeCreate,
    },
    {
      label: "Launch",
      emphasis: "primary",
      value:
        launchMode === "now"
          ? contestCopy.railLaunchNow
          : contestCopy.railLaunchSchedule,
    },
    ...scheduleActivationRows,
    {
      label: "Ends",
      emphasis: "primary",
      value:
        endValid && !endPast
          ? end.toLocaleString()
          : contestCopy.railEndPlaceholder,
      placeholder: !endValid || endPast,
    },
    { label: "Winners", emphasis: "primary", value: winnerCount },
    { label: "Metric", value: rankingMetric.toLowerCase() },
  ];

  const snapshotSecondaryRows: CampaignActionRailSnapshotRow[] = [
    {
      label: "Source status",
      value: sourceOk
        ? contestCopy.railSourceOk
        : contestCopy.railSourceMissing,
      placeholder: !sourceOk,
      tone: sourceStatusTone,
      emphasis: sourceOk ? "muted" : "default",
    },
    { label: "Plan", value: planLabel, emphasis: "muted" },
    ...optionalHintRows,
  ];

  const prependSections = (
    <>
      <ActionRailSection className="pt-0">
        <RailSegmentedTabGroup
          items={[...LAUNCH_TABS]}
          value={launchMode}
          onValueChange={(id) => {
            onLaunchModeChange(id as "now" | "schedule");
          }}
          columns={2}
          radiogroupAriaLabel="Contest launch timing"
        />
        <p className="text-muted-foreground mt-1.5 text-[11px] leading-snug">
          {launchHintLine(launchMode, sourceMode)}
        </p>
      </ActionRailSection>

      {launchMode === "schedule" ? (
        <ActionRailSection className="space-y-2">
          <ActionRailLabel>
            {contestCopy.railActivationTimeLabel}
          </ActionRailLabel>
          <Label
            htmlFor="contest-rail-scheduled-activation"
            className="text-muted-foreground text-[11px] font-medium"
          >
            {contestCopy.railDateTimeLabel}
          </Label>
          <Input
            id="contest-rail-scheduled-activation"
            type="datetime-local"
            className={railFieldClassNames}
            value={scheduledActivationFor}
            min={minSchedule}
            onChange={(e) => {
              const v = e.target.value || "";
              onScheduledActivationForChange(
                clampDateTimeLocalToMin(v, minSchedule)
              );
            }}
          />
          <p className="text-muted-foreground text-[11px] leading-snug">
            {userTimezone} · {scheduleHelper}
          </p>
        </ActionRailSection>
      ) : null}
    </>
  );

  return (
    <CampaignActionRail
      className={className}
      ariaLabel={contestCopy.railAriaLabel}
      prependSections={prependSections}
      snapshotLabel={contestCopy.railSnapshotLabel}
      snapshotRows={snapshotRows}
      snapshotSecondaryRows={snapshotSecondaryRows}
      financialLabel={contestCopy.railFinancialLabel}
      financialRows={[
        {
          label: contestCopy.railPlannedPool,
          value: `${plannedPayoutSats.toLocaleString()} sats`,
          emphasis: "primary",
        },
        { label: contestCopy.railFinalizationFee, value: feePct },
        {
          label: contestCopy.railDueAtLock,
          value: `${feeSats.toLocaleString()} sats`,
        },
      ]}
      blocker={blocker}
      outcomeHeadline={ctaConfig.outcomeText}
      outcomeLine={outcomeLine}
      footer={footerActions ?? <></>}
    />
  );
}
