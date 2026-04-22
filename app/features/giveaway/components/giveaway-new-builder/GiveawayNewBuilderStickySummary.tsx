import type { ReactNode } from "react";
import { useState } from "react";

import {
  ActionRailActions,
  ActionRailLabel,
  ActionRailSection,
  RAIL_SECONDARY_ACTION,
  railFieldClassNames,
} from "~/components/action-rail";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  buildGiveawayOutcomeLine,
  CampaignActionRail,
} from "~/features/campaign-ui";
import { RailSegmentedTabGroup } from "~/features/posts/components/publishing-rail/RailSegmentedTabGroup";
import {
  clampDateTimeLocalToMin,
  getNowForDateTimeLocal,
} from "~/lib/temporal";

import type { BuilderScopeType } from "./giveaway-new-builder-constants";
import { asideScopeLine } from "./giveaway-new-builder-constants";

const SOURCE_POST_LAUNCH_TABS = [
  { id: "now", label: "Now", ariaLabel: "Publish now" },
  { id: "schedule", label: "Schedule", ariaLabel: "Schedule for later" },
] as const;

function giveawaySourcePostLaunchHint(launchMode: "now" | "schedule"): string {
  if (launchMode === "now") {
    return "Publishes the giveaway announcement note now, then continues to preview.";
  }
  return "Schedules the announcement note; after it publishes, your giveaway draft is created.";
}

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
  userTimezone,
  sourcePostLaunchMode,
  onSourcePostLaunchModeChange,
  scheduledSourcePostFor,
  onScheduledSourcePostForChange,
  useRailPublishPrimary,
  publishPrimaryLabel,
  publishPrimaryDisabled,
  onPublishPrimaryClick,
  outcomeHeadline,
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
  userTimezone: string;
  sourcePostLaunchMode: "now" | "schedule";
  onSourcePostLaunchModeChange: (next: "now" | "schedule") => void;
  scheduledSourcePostFor: string;
  onScheduledSourcePostForChange: (next: string) => void;
  useRailPublishPrimary: boolean;
  publishPrimaryLabel: string;
  publishPrimaryDisabled: boolean;
  onPublishPrimaryClick: () => void;
  outcomeHeadline: ReactNode;
}) {
  const [now] = useState(() => Date.now());
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
        ? "Use the summary rail to publish or schedule the giveaway post."
        : "Select a post for single-post scope."
    );
  }
  if (
    useRailPublishPrimary &&
    sourcePostLaunchMode === "schedule" &&
    (scheduledSourcePostFor.trim() === "" ||
      new Date(scheduledSourcePostFor).getTime() <= now)
  ) {
    missingLines.push("Set a future publish time in the rail.");
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

  const minSchedule = getNowForDateTimeLocal(userTimezone);

  const prependSections = useRailPublishPrimary ? (
    <>
      <ActionRailSection className="pt-0">
        <RailSegmentedTabGroup
          items={[...SOURCE_POST_LAUNCH_TABS]}
          value={sourcePostLaunchMode}
          onValueChange={(id) => {
            onSourcePostLaunchModeChange(id as "now" | "schedule");
          }}
          columns={2}
          radiogroupAriaLabel="Giveaway source post publish timing"
        />
        <p className="text-text-secondary mt-1.5 text-[11px] leading-snug">
          {giveawaySourcePostLaunchHint(sourcePostLaunchMode)}
        </p>
      </ActionRailSection>

      {sourcePostLaunchMode === "schedule" ? (
        <ActionRailSection className="space-y-2">
          <ActionRailLabel>Publish time</ActionRailLabel>
          <Label
            htmlFor="giveaway-rail-scheduled-source-post"
            className="text-text-secondary text-[11px] font-medium"
          >
            Date and time
          </Label>
          <Input
            id="giveaway-rail-scheduled-source-post"
            type="datetime-local"
            className={railFieldClassNames}
            value={scheduledSourcePostFor}
            min={minSchedule}
            onChange={(e) => {
              const v = e.target.value || "";
              onScheduledSourcePostForChange(
                clampDateTimeLocalToMin(v, minSchedule)
              );
            }}
          />
          <p className="text-text-secondary text-[11px] leading-snug">
            {userTimezone} · When the announcement note should go out.
          </p>
        </ActionRailSection>
      ) : null}
    </>
  ) : null;

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
      prependSections={prependSections}
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
      outcomeHeadline={outcomeHeadline}
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
            useRailPublishPrimary ? (
              <Button
                type="button"
                size="sm"
                variant="default"
                disabled={isBusy || publishPrimaryDisabled}
                onClick={onPublishPrimaryClick}
                className="h-12 w-full rounded-none rounded-b-xl border-0 text-xs font-semibold shadow-none"
              >
                {publishPrimaryLabel}
              </Button>
            ) : (
              <Button
                type="submit"
                size="sm"
                variant="default"
                disabled={isBusy}
                className="h-12 w-full rounded-none rounded-b-xl border-0 text-xs font-semibold shadow-none"
              >
                Create draft & continue to preview
              </Button>
            )
          }
        />
      }
    />
  );
}
/* eslint-enable sonarjs/cognitive-complexity */
