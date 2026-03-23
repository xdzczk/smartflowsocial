import type { BroadcastDeliveryMode } from "@prisma/client";
import { Link } from "@remix-run/react";

import {
  audienceRiskForSource,
  type AudienceRiskLevel,
} from "~/features/broadcast/audience/audience-risk";
import { broadcastCompatibilityForecastNote } from "~/features/broadcast/broadcast-delivery-copy";
import { cn } from "~/lib/utils";

export interface AudienceSummaryCardProps {
  planType: string;
  limits: {
    maxRecipientsPerCampaign: number;
    maxDailyBroadcastRecipients: number;
  };
  audienceSource: "FOLLOWERS" | "MUTUALS" | "CUSTOM" | "SAVED";
  /** Custom list metrics */
  parsed?: number;
  valid?: number;
  duplicates?: number;
  invalid?: number;
  finalSendable?: number;
  suppressed?: number;
  estimatedGraphCount?: number | null;
  graphFetchFailed?: boolean;
  deliveryMode: BroadcastDeliveryMode;
  sendStrategy: string;
  /** When scheduling */
  scheduleLabel: string | null;
  broadcastNowLabel: boolean;
  excludeRecentDays: number;
  /** Overlap vs prior sends (optional) */
  overlapWarning?: string | null;
}

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

export function AudienceSummaryCard(props: AudienceSummaryCardProps) {
  const risk = audienceRiskForSource(props.audienceSource);
  const srcLabel =
    props.audienceSource === "FOLLOWERS"
      ? "Followers"
      : props.audienceSource === "MUTUALS"
        ? "Mutuals"
        : props.audienceSource === "SAVED"
          ? "Saved audience"
          : "Custom list";

  return (
    <aside className="border-border bg-muted/20 h-fit space-y-4 rounded-lg border p-4 text-sm lg:sticky lg:top-4">
      <h2 className="font-medium">Campaign summary</h2>

      <section>
        <h3 className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
          Audience
        </h3>
        <ul className="mt-2 space-y-1 text-xs">
          <li>
            <span className="text-muted-foreground">Source: </span>
            <span className="text-foreground font-medium">{srcLabel}</span>
          </li>
          {props.audienceSource === "CUSTOM" ||
          props.audienceSource === "SAVED" ? (
            <>
              {props.parsed != null ? (
                <li>
                  <span className="text-muted-foreground">Parsed: </span>
                  {String(props.parsed)}
                </li>
              ) : null}
              {props.valid != null ? (
                <li>
                  <span className="text-muted-foreground">Valid: </span>
                  {String(props.valid)}
                </li>
              ) : null}
              {props.duplicates != null ? (
                <li>
                  <span className="text-muted-foreground">Duplicates: </span>
                  {String(props.duplicates)}
                </li>
              ) : null}
              {props.invalid != null ? (
                <li>
                  <span className="text-muted-foreground">Invalid: </span>
                  {String(props.invalid)}
                </li>
              ) : null}
              {props.suppressed != null ? (
                <li>
                  <span className="text-muted-foreground">Suppressed: </span>
                  {String(props.suppressed)}
                </li>
              ) : null}
              {props.finalSendable != null ? (
                <li>
                  <span className="text-muted-foreground">Sendable: </span>
                  <strong className="text-foreground">
                    {String(props.finalSendable)}
                  </strong>
                </li>
              ) : null}
            </>
          ) : (
            <>
              <li>
                <span className="text-muted-foreground">Estimated: </span>
                {props.graphFetchFailed
                  ? "—"
                  : props.estimatedGraphCount != null
                    ? String(props.estimatedGraphCount)
                    : "—"}
              </li>
              <li className="text-muted-foreground text-[11px]">
                Final count is determined when you resolve (suppression applied
                then).
              </li>
            </>
          )}
        </ul>
      </section>

      <section>
        <h3 className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
          Risk
        </h3>
        <p className="mt-2">
          <span
            className={cn(
              "inline-block rounded-md px-2 py-1 text-xs font-medium",
              riskBadgeClass(risk.level)
            )}
          >
            {risk.label}
          </span>
        </p>
        {props.excludeRecentDays > 0 ? (
          <p className="text-muted-foreground mt-1 text-xs">
            Excluding recipients you messaged in the last{" "}
            {String(props.excludeRecentDays)} days (at resolve).
          </p>
        ) : null}
        {props.overlapWarning ? (
          <p className="mt-2 text-xs text-amber-800 dark:text-amber-200">
            {props.overlapWarning}
          </p>
        ) : null}
      </section>

      <section>
        <h3 className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
          Plan
        </h3>
        <ul className="mt-2 space-y-1 text-xs">
          <li>
            <span className="text-muted-foreground">Plan: </span>
            {props.planType}
          </li>
          <li>
            <span className="text-muted-foreground">Max per broadcast: </span>
            {String(props.limits.maxRecipientsPerCampaign)}
          </li>
          {props.limits.maxDailyBroadcastRecipients > 0 ? (
            <li>
              <span className="text-muted-foreground">Daily cap: </span>
              {String(props.limits.maxDailyBroadcastRecipients)}
            </li>
          ) : null}
        </ul>
      </section>

      <section>
        <h3 className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
          Delivery
        </h3>
        <ul className="mt-2 space-y-1 text-xs">
          <li>
            <span className="text-muted-foreground">Mode: </span>
            {String(props.deliveryMode)}
          </li>
          <li>
            <span className="text-muted-foreground">Strategy: </span>
            {props.sendStrategy === "STAGGERED" ? "Staggered" : "Standard"}
          </li>
          <li>
            <span className="text-muted-foreground">When: </span>
            {props.scheduleLabel ??
              (props.broadcastNowLabel ? "Broadcast now (after review)" : "—")}
          </li>
        </ul>
        <p className="text-muted-foreground mt-2 text-xs">
          {broadcastCompatibilityForecastNote(props.deliveryMode)}
        </p>
      </section>

      <p className="text-muted-foreground text-xs">
        Suppression is applied automatically.{" "}
        <Link
          to="/dashboard/broadcasts/suppression"
          className="text-primary font-medium hover:underline"
        >
          Manage suppression
        </Link>
      </p>
    </aside>
  );
}
