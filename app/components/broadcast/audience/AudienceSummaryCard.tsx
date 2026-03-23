import type { BroadcastDeliveryMode } from "@prisma/client";
import { Link } from "@remix-run/react";
import { HelpCircle } from "lucide-react";

import { Button } from "~/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";
import {
  audienceRiskForSource,
  type AudienceRiskLevel,
} from "~/features/broadcast/audience/audience-risk";
import {
  broadcastCompatibilityForecastNote,
  broadcastDeliveryModeComposerHelper,
  formatBroadcastDeliveryMode,
} from "~/features/broadcast/broadcast-delivery-copy";
import { cn } from "~/lib/utils";

export interface AudienceSummaryCardProps {
  planType: string;
  limits: {
    maxRecipientsPerCampaign: number;
    maxDailyBroadcastRecipients: number;
  };
  /** For risk chip */
  riskSource: "MUTUALS" | "CUSTOM";
  /** Display headline under Audience */
  audienceHeadline: string;
  /** Mutuals */
  estimatedGraphCount?: number | null;
  graphFetchFailed?: boolean;
  /** Selected recipients (live tray) */
  selectedCount?: number;
  selectedSuppressed?: number;
  selectedSendable?: number;
  deliveryMode: BroadcastDeliveryMode;
  sendStrategy: string;
  scheduleSummary: string;
  excludeRecentDays: number;
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

function kv(k: string, v: string) {
  return (
    <div className="flex justify-between gap-3 text-[11px] leading-tight">
      <span className="text-muted-foreground shrink-0">{k}</span>
      <span className="text-foreground text-right font-medium">{v}</span>
    </div>
  );
}

export function AudienceSummaryCard(props: AudienceSummaryCardProps) {
  const risk = audienceRiskForSource(props.riskSource);
  const modeShort = broadcastDeliveryModeComposerHelper(props.deliveryMode);
  const strategyLabel =
    props.sendStrategy === "STAGGERED" ? "Conservative" : "Standard";

  const audienceIsSelected = props.audienceHeadline === "Selected recipients";

  return (
    <aside className="border-border bg-muted/20 h-fit space-y-3 rounded-xl border p-3 text-sm lg:sticky lg:top-4">
      <h2 className="text-foreground px-0.5 text-sm font-semibold tracking-tight">
        Campaign summary
      </h2>

      <div className="border-border bg-background/40 space-y-2 rounded-lg border p-3">
        <h3 className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
          Audience
        </h3>
        {kv("Source", props.audienceHeadline)}
        {audienceIsSelected ? (
          <>
            {props.selectedCount != null
              ? kv("Selected", String(props.selectedCount))
              : null}
            {props.selectedSuppressed != null
              ? kv("Suppressed", String(props.selectedSuppressed))
              : null}
            {props.selectedSendable != null
              ? kv("Sendable", String(props.selectedSendable))
              : null}
            <p className="text-muted-foreground pt-1 text-[10px] leading-snug">
              Only eligible recipients are included at send time.
            </p>
          </>
        ) : (
          <>
            {kv(
              "Estimated",
              props.graphFetchFailed
                ? "—"
                : props.estimatedGraphCount != null
                  ? String(props.estimatedGraphCount)
                  : "At review"
            )}
            <p className="text-muted-foreground text-[10px] leading-snug">
              Final count when you resolve the audience.
            </p>
          </>
        )}
      </div>

      <div className="border-border bg-background/40 space-y-2 rounded-lg border p-3">
        <h3 className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
          Risk
        </h3>
        <span
          className={cn(
            "inline-block rounded-md px-2 py-0.5 text-[11px] font-medium",
            riskBadgeClass(risk.level)
          )}
        >
          {risk.label}
        </span>
        {props.excludeRecentDays > 0 ? (
          <p className="text-muted-foreground text-[10px] leading-snug">
            Exclusions: last {String(props.excludeRecentDays)}d messaged
          </p>
        ) : null}
        {props.overlapWarning ? (
          <p className="text-[11px] text-amber-800 dark:text-amber-200">
            {props.overlapWarning}
          </p>
        ) : null}
      </div>

      <div className="border-border bg-background/40 space-y-2 rounded-lg border p-3">
        <h3 className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
          Plan
        </h3>
        {kv("Current", props.planType)}
        {kv("Max / broadcast", String(props.limits.maxRecipientsPerCampaign))}
        {props.limits.maxDailyBroadcastRecipients > 0
          ? kv("Daily cap", String(props.limits.maxDailyBroadcastRecipients))
          : null}
      </div>

      <div className="border-border bg-background/40 space-y-2 rounded-lg border p-3">
        <h3 className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
          Delivery
        </h3>
        {kv("Mode", formatBroadcastDeliveryMode(props.deliveryMode))}
        <p className="text-muted-foreground text-[10px] leading-snug">
          {modeShort}
        </p>
        {kv("Strategy", strategyLabel)}
        {kv("Send time", props.scheduleSummary)}
        {kv("Suppression", "Active (automatic)")}
        <Popover>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-muted-foreground h-7 gap-1 px-1 text-[10px]"
            >
              <HelpCircle className="h-3 w-3" />
              Technical details
            </Button>
          </PopoverTrigger>
          <PopoverContent className="text-xs" align="start">
            {broadcastCompatibilityForecastNote(props.deliveryMode)}
          </PopoverContent>
        </Popover>
      </div>

      <p className="text-muted-foreground px-0.5 text-[10px] leading-snug">
        Suppressed recipients are always excluded automatically.{" "}
        <Link
          to="/dashboard/broadcasts/suppression"
          className="text-primary font-medium hover:underline"
        >
          Manage
        </Link>
      </p>
    </aside>
  );
}
