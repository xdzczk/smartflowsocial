import type { BroadcastDeliveryMode } from "@prisma/client";
import { Link } from "@remix-run/react";
import { ArrowRight, Clock } from "lucide-react";

import {
  ActionRail,
  ActionRailActions,
  ActionRailLabel,
  ActionRailNotice,
  ActionRailOutcome,
  ActionRailRow,
  ActionRailSection,
  RAIL_MAJOR_DIVIDE,
  RAIL_STACK_ROWS,
  RAIL_SECONDARY_ACTION,
  RAIL_SUMMARY_TO_FEEDBACK,
  railFieldClassNames,
} from "~/components/action-rail";
import { Button } from "~/components/ui/button";
import {
  audienceRiskForSource,
  type AudienceRiskLevel,
} from "~/features/broadcast/audience/audience-risk";
import {
  broadcastDeliveryModeComposerHelper,
  formatBroadcastDeliveryMode,
} from "~/features/broadcast/broadcast-delivery-copy";
import { INLINE_ICON_STROKE } from "~/lib/icon-constants";
import { formatIntervalLabel } from "~/lib/schedule-intervals";
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
      return "bg-emerald-500/15 text-emerald-800 dark:text-emerald-200";
    case "moderate":
      return "bg-amber-500/15 text-amber-900 dark:text-amber-100";
    case "curated":
      return "bg-blue-500/15 text-blue-900 dark:text-blue-100";
    default:
      return "bg-muted text-muted-foreground";
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
  const deliveryHelper = broadcastDeliveryModeComposerHelper(
    deliveryMode as BroadcastDeliveryMode
  );
  const scheduleSummaryRow =
    commitMode === "schedule" && hasScheduleTimeForSubmit && scheduleTimeLabel
      ? scheduleTimeLabel
      : commitMode === "schedule"
        ? "—"
        : "After review";

  const showSchedulePicker = limits.allowSchedule && commitMode === "schedule";

  return (
    <ActionRail ariaLabel="Broadcast delivery and summary">
      <div className={cn("flex min-h-0 flex-col text-xs", RAIL_MAJOR_DIVIDE)}>
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
        ) : (
          <ActionRailSection className="pb-0">
            <p className="text-muted-foreground text-[11px] leading-snug">
              Scheduling is not available on your plan.
            </p>
          </ActionRailSection>
        )}

        <ActionRailSection className="space-y-3">
          <ActionRailLabel>Delivery options</ActionRailLabel>
          <div className="divide-border/60 divide-y">
            <div className="space-y-1.5 py-2 first:pt-0">
              <label
                htmlFor="broadcast-rail-delivery-mode"
                className="text-muted-foreground text-[11px] font-medium"
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
              <p className="text-muted-foreground text-[10px] leading-snug">
                {deliveryHelper}
              </p>
            </div>

            <div className="space-y-1.5 py-2">
              <label
                htmlFor="broadcast-rail-send-strategy"
                className="text-muted-foreground text-[11px] font-medium"
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

            <div className="flex justify-between gap-2 py-2">
              <span className="text-muted-foreground shrink-0 font-medium">
                Suppression
              </span>
              <span className="text-foreground text-right font-medium">
                Automatic
              </span>
            </div>

            {showSchedulePicker ? (
              <div className="space-y-2 py-2">
                <label
                  htmlFor="broadcast-rail-scheduled-for"
                  className="text-muted-foreground text-[11px] font-medium"
                >
                  Send time
                </label>
                <input
                  id="broadcast-rail-scheduled-for"
                  type="datetime-local"
                  name="scheduledFor"
                  value={scheduledForLocal}
                  min={minDatetime}
                  onChange={(e) => {
                    const v = e.target.value;
                    const min = minDatetime;
                    onScheduledForChange(v && v < min ? min : v);
                  }}
                  className={railFieldClassNames}
                />
                <p className="text-muted-foreground text-[10px] leading-snug">
                  {userTimezone}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {BROADCAST_QUICK_SCHEDULE_INTERVALS_HOURS.map((h) => (
                    <Button
                      key={h}
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={busy}
                      className="h-8 text-[11px]"
                      onClick={() => onQuickSchedule(h)}
                    >
                      {formatIntervalLabel(h, { compact: true })}
                    </Button>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </ActionRailSection>

        <ActionRailSection>
          <ActionRailLabel>Broadcast summary</ActionRailLabel>
          <div className={RAIL_STACK_ROWS}>
            <ActionRailRow label="Audience source" value={audienceHeadline} />
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
            <ActionRailRow label="Plan" value={planType} />
            <ActionRailRow
              label="Max / broadcast"
              value={String(limits.maxRecipientsPerCampaign)}
            />
            {limits.maxDailyBroadcastRecipients > 0 ? (
              <ActionRailRow
                label="Daily cap"
                value={String(limits.maxDailyBroadcastRecipients)}
              />
            ) : null}
            <ActionRailRow
              label="Compatibility"
              value={formatBroadcastDeliveryMode(
                deliveryMode as BroadcastDeliveryMode
              )}
            />
            <ActionRailRow label="Strategy" value={strategyLabel} />
            <ActionRailRow
              label="Send window"
              value={commitMode === "schedule" ? "Schedule" : "Now"}
            />
            <ActionRailRow
              label="Send time"
              value={scheduleSummaryRow}
              placeholder={Boolean(
                commitMode === "schedule" && !hasScheduleTimeForSubmit
              )}
            />
            <ActionRailRow label="Suppression" value="Active (automatic)" />
          </div>
          <p className="text-muted-foreground mt-2 text-[10px]">
            <Link
              to="/dashboard/broadcasts/suppression"
              className="text-primary font-medium hover:underline"
            >
              Suppression list
            </Link>
          </p>
        </ActionRailSection>

        {blockers.length > 0 ? (
          <ActionRailSection>
            <ActionRailNotice
              variant="error"
              title="Missing requirements"
              lines={blockers}
            />
          </ActionRailSection>
        ) : null}

        {advisories.length > 0 ? (
          <ActionRailSection>
            <ActionRailNotice
              variant="warning"
              title="Before you send"
              lines={advisories}
            />
          </ActionRailSection>
        ) : null}

        {outcomeHeadline || outcomeLine ? (
          <ActionRailSection className={cn(RAIL_SUMMARY_TO_FEEDBACK, "pb-2")}>
            <ActionRailOutcome
              headline={outcomeHeadline}
              outcomeLine={outcomeLine}
            />
          </ActionRailSection>
        ) : null}
      </div>

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
                ? "bg-primary/80 text-primary-foreground hover:bg-primary/80 pointer-events-auto cursor-not-allowed opacity-95"
                : "bg-primary text-primary-foreground hover:bg-primary/90"
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
    </ActionRail>
  );
}
/* eslint-enable sonarjs/cognitive-complexity */
