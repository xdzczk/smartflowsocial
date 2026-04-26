import type { BroadcastDeliveryMode } from "@prisma/client";
import { Link } from "@remix-run/react";
import { ArrowRight, Clock } from "lucide-react";

import {
  ActionRail,
  ActionRailActions,
  ActionRailLabel,
  ActionRailRow,
  RAIL_MAJOR_DIVIDE,
  RAIL_STACK_ROWS,
  RAIL_SECONDARY_ACTION,
  RAIL_SUMMARY_TO_FEEDBACK,
  railFieldClassNames,
} from "~/components/action-rail";
import { RAIL_PAD_X, RAIL_ZONE_PY } from "~/components/action-rail/tokens";
import { Button } from "~/components/ui/button";
import {
  audienceRiskForSource,
  type AudienceRiskLevel,
} from "~/features/broadcast/audience/audience-risk";
import { formatBroadcastDeliveryMode } from "~/features/broadcast/broadcast-delivery-copy";
import {
  RailChip,
  RailFeedbackBlock,
  RailSummaryOutcomeBlock,
} from "~/features/posts/components/publishing-rail";
import { INLINE_ICON_STROKE } from "~/lib/icon-constants";
import { formatIntervalLabel } from "~/lib/schedule-intervals";
import { clampDateTimeLocalToMin } from "~/lib/temporal";
import { cn } from "~/lib/utils";

import {
  BroadcastRailModeTabs,
  type BroadcastCommitMode,
} from "./BroadcastRailModeTabs";

const BROADCAST_QUICK_SCHEDULE_INTERVALS_HOURS = [
  0.25, 0.5, 1, 12, 24,
] as const;

function riskBadgeClass(level: AudienceRiskLevel): string {
  switch (level) {
    case "low":
      return "bg-success/15 text-success-text";
    case "moderate":
      return "bg-warning/15 text-warning-text";
    case "curated":
      return "bg-info/15 text-info-text";
    default:
      return "bg-surface-hover text-text-secondary";
  }
}

export interface BroadcastCreationRailProps {
  limits: {
    allowSchedule: boolean;
    allowAdvancedDelivery: boolean;
    allowStaggered: boolean;
    maxRecipientsPerCampaign: number;
    maxDailyBroadcastRecipients: number;
  };
  planType: string;
  busy: boolean;
  userTimezone: string;
  commitMode: BroadcastCommitMode;
  onCommitModeChange: (next: BroadcastCommitMode) => void;
  deliveryMode: string;
  onDeliveryModeChange: (v: string) => void;
  onSendStrategyChange: (v: string) => void;
  resolvedSendStrategy: string;
  scheduledForLocal: string;
  onScheduledForChange: (v: string) => void;
  onQuickSchedule: (hours: number) => void;
  minDatetime: string;
  audienceHeadline: string;
  riskSource: "MUTUALS" | "CUSTOM";
  estimatedGraphCount: number | null | undefined;
  graphFetchFailed: boolean;
  selectedCount?: number;
  selectedSuppressed?: number;
  selectedSendable?: number;
  excludeRecentDays: number;
  hasScheduleTimeForSubmit: boolean;
  scheduleTimeLabel: string | null;
  primaryLabel: string;
  primaryIntent: "create_now" | "create_schedule";
  primaryDisabled: boolean;
  draftDisabled: boolean;
  blockers: string[];
  advisories: string[];
  outcomeHeadline: string | null;
  outcomeLine: string | null;
}

/* eslint-disable sonarjs/cognitive-complexity -- rail composes delivery, summary, notices, footer */
export function BroadcastCreationRail(props: BroadcastCreationRailProps) {
  const {
    limits,
    planType,
    busy,
    userTimezone,
    commitMode,
    onCommitModeChange,
    deliveryMode,
    onDeliveryModeChange,
    onSendStrategyChange,
    resolvedSendStrategy,
    scheduledForLocal,
    onScheduledForChange,
    onQuickSchedule,
    minDatetime,
    audienceHeadline,
    riskSource,
    estimatedGraphCount,
    graphFetchFailed,
    selectedCount,
    selectedSuppressed,
    selectedSendable,
    excludeRecentDays,
    hasScheduleTimeForSubmit,
    scheduleTimeLabel,
    primaryLabel,
    primaryIntent,
    primaryDisabled,
    draftDisabled,
    blockers,
    advisories,
    outcomeHeadline,
    outcomeLine,
  } = props;

  const risk = audienceRiskForSource(riskSource);
  const strategyLabel =
    resolvedSendStrategy === "STAGGERED" ? "Conservative" : "Standard";
  const audienceIsSelected = audienceHeadline === "Selected recipients";
  const scheduleSummaryRow =
    commitMode === "schedule" && hasScheduleTimeForSubmit && scheduleTimeLabel
      ? scheduleTimeLabel
      : commitMode === "schedule"
        ? "—"
        : "After review";

  const showSchedulePicker = limits.allowSchedule && commitMode === "schedule";
  const zoneClass = cn(RAIL_PAD_X, RAIL_ZONE_PY);

  const footer = (
    <ActionRailActions
      secondaryButton={
        <Button
          type="submit"
          name="intent"
          value="create_draft"
          variant="ghost"
          size="sm"
          disabled={draftDisabled}
          className={RAIL_SECONDARY_ACTION}
        >
          Save draft
        </Button>
      }
      primaryButton={
        <Button
          type="submit"
          name="intent"
          value={primaryIntent}
          size="sm"
          variant="default"
          disabled={primaryDisabled}
          className={cn(
            "h-12 w-full rounded-none rounded-b-xl border-0 text-xs font-semibold shadow-none",
            primaryDisabled
              ? "bg-action-primary/80 text-action-primary-foreground hover:bg-action-primary/80 pointer-events-auto cursor-not-allowed opacity-95"
              : "bg-action-primary text-action-primary-foreground hover:bg-action-primary/90"
          )}
        >
          <span className="inline-flex items-center justify-center gap-1.5">
            {hasScheduleTimeForSubmit ? (
              <Clock
                className="h-4 w-4 shrink-0"
                strokeWidth={INLINE_ICON_STROKE}
                aria-hidden
              />
            ) : (
              <ArrowRight
                className="h-4 w-4 shrink-0"
                strokeWidth={INLINE_ICON_STROKE}
                aria-hidden
              />
            )}
            {primaryLabel}
          </span>
        </Button>
      }
    />
  );

  return (
    <ActionRail ariaLabel="Broadcast delivery and summary" footer={footer}>
      <div className="flex min-h-0 flex-col text-xs">
        <div className="shrink-0">
          {limits.allowSchedule ? (
            <BroadcastRailModeTabs
              value={commitMode}
              onValueChange={(next) => {
                onCommitModeChange(next);
                if (next === "now") {
                  onScheduledForChange("");
                }
              }}
            />
          ) : null}
        </div>

        <div className={cn("flex flex-col", RAIL_MAJOR_DIVIDE)}>
          {!limits.allowSchedule ? (
            <div className={zoneClass}>
              <p className="text-text-secondary text-[11px] leading-snug">
                Scheduling is not available on your plan.
              </p>
            </div>
          ) : null}

          <div className={cn(zoneClass, "space-y-3")}>
            <ActionRailLabel>Delivery options</ActionRailLabel>
            <div className="divide-border/60 divide-y">
              <div className="space-y-1.5 py-2 first:pt-0">
                <label
                  htmlFor="broadcast-rail-delivery-mode"
                  className="text-text-secondary text-[11px] font-medium"
                >
                  Routing
                </label>
                <select
                  id="broadcast-rail-delivery-mode"
                  name="deliveryMode"
                  value={deliveryMode}
                  onChange={(e) => onDeliveryModeChange(e.target.value)}
                  className={railFieldClassNames}
                >
                  <option value="BEST_COMPATIBILITY">Best compatibility</option>
                  {limits.allowAdvancedDelivery ? (
                    <>
                      <option value="NIP04_ONLY">NIP-04 only (legacy)</option>
                      <option value="NIP17_ONLY">NIP-17 only</option>
                      <option value="NIP17_FALLBACK_NIP04">
                        NIP-17 with NIP-04 fallback
                      </option>
                      <option value="BOTH">Both (expert)</option>
                    </>
                  ) : null}
                </select>
              </div>

              <div className="space-y-1.5 py-2">
                <label
                  htmlFor="broadcast-rail-send-strategy"
                  className="text-text-secondary text-[11px] font-medium"
                >
                  Strategy
                </label>
                <select
                  id="broadcast-rail-send-strategy"
                  name="sendStrategy"
                  value={resolvedSendStrategy}
                  onChange={(e) => onSendStrategyChange(e.target.value)}
                  className={railFieldClassNames}
                >
                  <option value="STANDARD">Standard</option>
                  {limits.allowStaggered ? (
                    <option value="STAGGERED">Conservative</option>
                  ) : null}
                </select>
              </div>

              {showSchedulePicker ? (
                <div className="flex flex-col gap-3 py-2">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                    <div className="min-w-0 flex-1 space-y-1">
                      <label
                        htmlFor="broadcast-rail-scheduled-for"
                        className="text-text-secondary block text-[11px] font-medium"
                      >
                        Send time ({userTimezone})
                      </label>
                      <input
                        id="broadcast-rail-scheduled-for"
                        type="datetime-local"
                        name="scheduledFor"
                        value={scheduledForLocal}
                        min={minDatetime}
                        onChange={(e) => {
                          const v = e.target.value;
                          onScheduledForChange(
                            clampDateTimeLocalToMin(v, minDatetime)
                          );
                        }}
                        className={railFieldClassNames}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-5 gap-1 sm:gap-1.5">
                    {BROADCAST_QUICK_SCHEDULE_INTERVALS_HOURS.map((h) => (
                      <RailChip
                        key={h}
                        type="button"
                        className="w-full min-w-0 px-1 sm:px-2"
                        disabled={busy}
                        onClick={() => onQuickSchedule(h)}
                      >
                        {formatIntervalLabel(h, { compact: true })}
                      </RailChip>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </div>

          <div className={zoneClass}>
            <ActionRailLabel>Broadcast summary</ActionRailLabel>
            <div className={RAIL_STACK_ROWS}>
              <ActionRailRow
                label="Audience source"
                value={audienceHeadline}
                emphasis="primary"
              />
              {audienceIsSelected ? (
                <>
                  {selectedCount != null ? (
                    <ActionRailRow
                      label="Selected"
                      value={String(selectedCount)}
                    />
                  ) : null}
                  {selectedSuppressed != null ? (
                    <ActionRailRow
                      label="Suppressed"
                      value={String(selectedSuppressed)}
                    />
                  ) : null}
                  {selectedSendable != null ? (
                    <ActionRailRow
                      label="Sendable"
                      value={String(selectedSendable)}
                    />
                  ) : null}
                </>
              ) : (
                <ActionRailRow
                  label="Estimated"
                  value={
                    graphFetchFailed
                      ? "—"
                      : estimatedGraphCount != null
                        ? String(estimatedGraphCount)
                        : "At review"
                  }
                  placeholder={Boolean(
                    estimatedGraphCount == null && !graphFetchFailed
                  )}
                  emphasis="primary"
                />
              )}
              <ActionRailRow
                label="Spam risk"
                value={
                  <span
                    className={cn(
                      "inline-block rounded-md px-1.5 py-0.5 font-medium",
                      riskBadgeClass(risk.level)
                    )}
                  >
                    {risk.label}
                  </span>
                }
              />
              {excludeRecentDays > 0 ? (
                <ActionRailRow
                  label="Recent-message exclusion"
                  value={`Last ${excludeRecentDays}d`}
                />
              ) : null}

              <ActionRailRow
                className="mt-2"
                label="Send window"
                value={commitMode === "schedule" ? "Schedule" : "Now"}
                emphasis="primary"
              />
              <ActionRailRow
                label="Send time"
                value={scheduleSummaryRow}
                placeholder={Boolean(
                  commitMode === "schedule" && !hasScheduleTimeForSubmit
                )}
                emphasis="primary"
              />
              <ActionRailRow
                label="Strategy"
                value={strategyLabel}
                emphasis="muted"
              />
              <ActionRailRow
                label="Compatibility"
                value={formatBroadcastDeliveryMode(
                  deliveryMode as BroadcastDeliveryMode
                )}
                emphasis="muted"
              />

              <ActionRailRow
                className="mt-2"
                label="Plan"
                value={planType}
                emphasis="primary"
              />
              <ActionRailRow
                label="Max / broadcast"
                value={String(limits.maxRecipientsPerCampaign)}
                emphasis="muted"
              />
              {limits.maxDailyBroadcastRecipients > 0 ? (
                <ActionRailRow
                  label="Daily cap"
                  value={String(limits.maxDailyBroadcastRecipients)}
                  emphasis="muted"
                />
              ) : null}
              <ActionRailRow
                label="Suppression"
                emphasis="muted"
                value={
                  <span className="block text-right">
                    <span className="block">Active (automatic)</span>
                    <Link
                      to="/dashboard/broadcasts/suppression"
                      className="text-brand mt-0.5 inline-block text-[10px] font-medium hover:underline"
                    >
                      Suppression list
                    </Link>
                  </span>
                }
              />
            </div>

            {blockers.length > 0 ? (
              <RailFeedbackBlock
                className={RAIL_SUMMARY_TO_FEEDBACK}
                variant="error"
                title="Missing requirements"
                lines={blockers}
              />
            ) : null}
            {advisories.length > 0 ? (
              <RailFeedbackBlock
                className={cn(
                  RAIL_SUMMARY_TO_FEEDBACK,
                  blockers.length > 0 && "!pt-2 pt-1"
                )}
                variant="warning"
                title="Before you send"
                lines={advisories}
              />
            ) : null}
            {outcomeHeadline != null && outcomeLine != null ? (
              <RailSummaryOutcomeBlock
                className={cn(
                  RAIL_SUMMARY_TO_FEEDBACK,
                  (blockers.length > 0 || advisories.length > 0) && "!pt-2 pt-1"
                )}
                headline={outcomeHeadline}
                outcomeLine={outcomeLine}
              />
            ) : null}
          </div>
        </div>
      </div>
    </ActionRail>
  );
}
/* eslint-enable sonarjs/cognitive-complexity */
