import {
  ActionRailActions,
  RAIL_SECONDARY_ACTION,
} from "~/components/action-rail";
import { Button } from "~/components/ui/button";
import {
  buildGiveawayOutcomeLine,
  CampaignActionRail,
} from "~/features/campaign-ui";

import type { BuilderScopeType } from "./giveaway-new-builder-constants";
import { asideScopeLine } from "./giveaway-new-builder-constants";

/* eslint-disable sonarjs/cognitive-complexity -- rail aggregates many builder fields */
export function GiveawayNewBuilderStickySummary({
  scopeType,
  periodMode,
  selectedTypes,
  winnerCount,
  rewardMode,
  simpleSats,
  selectionMode,
  planDisplayName,
  plannedPayoutForFee,
  feePreview,
  isFollowGraphScope,
  selectedSinglePostId,
  singlePostSourceMode,
  actionError,
  fetcherError,
  isBusy,
  onSaveDraft,
}: {
  scopeType: BuilderScopeType;
  periodMode: "days" | "custom";
  selectedTypes: string[];
  winnerCount: number;
  rewardMode: "simple" | "advanced";
  simpleSats: number;
  selectionMode: "UNIQUE_USER" | "WEIGHTED_BY_ENGAGEMENT";
  planDisplayName: string;
  plannedPayoutForFee: number | null;
  feePreview: {
    feeSats: number;
    waivedByPlan: boolean;
    rateBps: number;
  } | null;
  isFollowGraphScope: boolean;
  selectedSinglePostId: string;
  singlePostSourceMode: "create" | "existing";
  actionError?: string;
  fetcherError?: string;
  isBusy: boolean;
  onSaveDraft: () => void;
}) {
  const entryValue = isFollowGraphScope
    ? "Random from accounts (after filters)"
    : selectedTypes.length
      ? selectedTypes.join(", ")
      : "None selected";

  const rewardsValue =
    rewardMode === "simple"
      ? simpleSats > 0
        ? `${simpleSats.toLocaleString()} sats × ${winnerCount} → ${(simpleSats * winnerCount).toLocaleString()} max`
        : "Selection-only (no payout)"
      : "Advanced per-type";

  const selectionValue = isFollowGraphScope
    ? "Uniform random"
    : selectionMode === "UNIQUE_USER"
      ? "Unique user"
      : "Weighted";

  const missingLines: string[] = [];
  if (scopeType === "SINGLE_POST" && !selectedSinglePostId.trim()) {
    missingLines.push(
      singlePostSourceMode === "create"
        ? "Publish the giveaway post from the composer."
        : "Select a post for single-post scope."
    );
  }
  if (!isFollowGraphScope && selectedTypes.length === 0) {
    missingLines.push("Select at least one entry method.");
  }

  const cautionHint =
    winnerCount > 50
      ? "High winner count — confirm it fits your plan cap."
      : null;

  const blocker =
    missingLines.length > 0
      ? {
          variant: "warning" as const,
          title: "Before you continue",
          lines: missingLines,
        }
      : null;

  const serverErr = actionError ?? fetcherError;
  const outcomeLine = buildGiveawayOutcomeLine({
    plannedPayoutSats:
      plannedPayoutForFee != null && plannedPayoutForFee > 0
        ? plannedPayoutForFee
        : null,
    winnerCount,
  });

  const plannedPayoutDisplay =
    rewardMode === "advanced"
      ? "—"
      : plannedPayoutForFee != null
        ? `${plannedPayoutForFee.toLocaleString()} sats`
        : "0 sats";

  let finalizationDisplay: string;
  let dueAtLockDisplay: string;
  if (rewardMode === "advanced") {
    finalizationDisplay = "At preview";
    dueAtLockDisplay = "—";
  } else if (plannedPayoutForFee != null && feePreview) {
    finalizationDisplay =
      plannedPayoutForFee <= 0
        ? "0 sats"
        : feePreview.waivedByPlan
          ? "Included in plan"
          : `${feePreview.rateBps / 100}% (${feePreview.feeSats.toLocaleString()} sats)`;
    dueAtLockDisplay =
      plannedPayoutForFee <= 0
        ? "0 sats"
        : feePreview.waivedByPlan
          ? "0 sats"
          : `${feePreview.feeSats.toLocaleString()} sats`;
  } else {
    finalizationDisplay = "—";
    dueAtLockDisplay = "—";
  }

  return (
    <CampaignActionRail
      ariaLabel="Giveaway summary"
      className="mt-10 self-start lg:mt-0"
      snapshotLabel="Snapshot"
      snapshotRows={[
        {
          label: "Scope",
          value: asideScopeLine(scopeType, periodMode),
          emphasis: "primary",
        },
        {
          label: "Entry",
          value: entryValue,
          placeholder: !isFollowGraphScope ? selectedTypes.length === 0 : false,
          emphasis: "primary",
        },
        {
          label: "Winners",
          value: `${winnerCount} total`,
          emphasis: "primary",
        },
        { label: "Rewards", value: rewardsValue, emphasis: "primary" },
        { label: "Selection", value: selectionValue },
      ]}
      snapshotSecondaryRows={[
        { label: "Plan", value: planDisplayName, emphasis: "muted" },
      ]}
      financialLabel="Payout & fees"
      financialRows={[
        {
          label: "Planned payout",
          value: plannedPayoutDisplay,
          emphasis: "primary",
        },
        { label: "Finalization fee", value: finalizationDisplay },
        { label: "Due at lock", value: dueAtLockDisplay },
      ]}
      blocker={blocker}
      serverError={serverErr ?? null}
      outcomeHeadline="Ready to continue"
      outcomeLine={outcomeLine}
      outcomeHint={cautionHint}
      footer={
        <ActionRailActions
          secondaryButton={
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className={RAIL_SECONDARY_ACTION}
              onClick={onSaveDraft}
              disabled={isBusy}
            >
              Save draft
            </Button>
          }
          primaryButton={
            <Button
              type="submit"
              size="sm"
              variant="default"
              disabled={isBusy}
              className="h-12 w-full rounded-none rounded-b-xl border-0 text-xs font-semibold shadow-none"
            >
              Create draft & continue to preview
            </Button>
          }
        />
      }
    />
  );
}
/* eslint-enable sonarjs/cognitive-complexity */
