/**
 * Feature comparison: public recurring tiers from pricing grid.
 */

import { Check, HelpCircle, X } from "lucide-react";
import { Fragment } from "react";

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "~/components/ui/tooltip";
import { getPlanEntitlements } from "~/features/payments/entitlements/plan-entitlements";
import { formatBytesForPlanMarketing } from "~/features/payments/limit-display";
import { mapLegacyPlanIdToCommercialPlanType } from "~/features/payments/plan-mapping";
import { getCanonicalPlanPolicy } from "~/features/payments/plan-policy";
import type { PricingPagePlan } from "~/features/payments/types/plan-loader.types";

interface FeatureComparisonTableProps {
  plans: PricingPagePlan[];
}

const GROUP_CORE_WORKFLOWS = "Core workflows";
const GROUP_PLANNING = "Scheduling and execution";
const GROUP_CAMPAIGNS = "Campaigns";
const GROUP_MEDIA = "Hosted media";
const GROUP_POWER = "Distribution";

interface ComparisonRow {
  group: string;
  label: string;
  /** Short helper for infrastructure rows; hidden on small screens via trigger. */
  tooltip?: string;
  getValue: (plan: PricingPagePlan) => boolean | string | number | null;
}

function campaignCommissionPercent(planId: string): string | null {
  const planType = mapLegacyPlanIdToCommercialPlanType(planId);
  const pct =
    getCanonicalPlanPolicy(planType).campaigns.campaignCommissionPercent;
  if (pct == null) return null;
  return Number.isInteger(pct) ? `${pct}%` : `${pct.toFixed(1)}%`;
}

const COMPARISON_ROWS: ComparisonRow[] = [
  {
    group: GROUP_CORE_WORKFLOWS,
    label: "Composer and publishing",
    getValue: (plan) => (plan.isTeamsPlaceholder ? null : true),
  },
  {
    group: GROUP_CORE_WORKFLOWS,
    label: "Calendar",
    getValue: (plan) => (plan.isTeamsPlaceholder ? null : true),
  },
  {
    group: GROUP_CORE_WORKFLOWS,
    label: "Engagement feed",
    getValue: (plan) => (plan.isTeamsPlaceholder ? null : true),
  },
  {
    group: GROUP_CORE_WORKFLOWS,
    label: "Drafts and templates",
    getValue: (plan) => (plan.isTeamsPlaceholder ? null : true),
  },
  {
    group: GROUP_CORE_WORKFLOWS,
    label: "Accounts included",
    getValue: (plan) => {
      if (plan.isTeamsPlaceholder) return null;
      const planType = mapLegacyPlanIdToCommercialPlanType(plan.id);
      return getCanonicalPlanPolicy(planType).accountsIncluded;
    },
  },
  {
    group: GROUP_CORE_WORKFLOWS,
    label: "Draft/template limits",
    getValue: (plan) => {
      if (plan.isTeamsPlaceholder) return null;
      const ent = getPlanEntitlements(plan.id);
      if (ent.maxDrafts == null || ent.maxTemplates == null) return "-";
      return `${ent.maxDrafts} drafts / ${ent.maxTemplates} templates`;
    },
  },
  {
    group: GROUP_PLANNING,
    label: "Scheduled items included",
    getValue: (plan) => {
      if (plan.isTeamsPlaceholder) return null;
      const ent = getPlanEntitlements(plan.id);
      return ent.maxFutureScheduledItems ?? "-";
    },
  },
  {
    group: GROUP_PLANNING,
    label: "Queue count",
    getValue: (plan) => {
      if (plan.isTeamsPlaceholder) return null;
      const ent = getPlanEntitlements(plan.id);
      return ent.maxQueues ?? "-";
    },
  },
  {
    group: GROUP_PLANNING,
    label: "Broadcast workflow",
    getValue: (plan) => (plan.isTeamsPlaceholder ? null : true),
  },
  {
    group: GROUP_PLANNING,
    label: "Broadcast sending",
    getValue: (plan) => {
      if (plan.isTeamsPlaceholder) return null;
      const ent = getPlanEntitlements(plan.id);
      return ent.canSendBroadcast ? "Included" : "Browse only (no send)";
    },
  },
  {
    group: GROUP_PLANNING,
    label: "Bulk workflow",
    getValue: (plan) => {
      if (plan.isTeamsPlaceholder) return null;
      const ent = getPlanEntitlements(plan.id);
      return ent.canExecuteBulkActions;
    },
  },
  {
    group: GROUP_MEDIA,
    label: "Blossom-compatible hosted media",
    tooltip:
      "Hosted on Blossom-compatible infrastructure for broader Nostr media workflows.",
    getValue: (plan) => {
      if (plan.isTeamsPlaceholder) return null;
      const planType = mapLegacyPlanIdToCommercialPlanType(plan.id);
      return getCanonicalPlanPolicy(planType).media.canUseSfsBlossomStorage
        ? "Yes"
        : "No";
    },
  },
  {
    group: GROUP_MEDIA,
    label: "Monthly hosted storage",
    getValue: (plan) => {
      if (plan.isTeamsPlaceholder) return null;
      const planType = mapLegacyPlanIdToCommercialPlanType(plan.id);
      const media = getCanonicalPlanPolicy(planType).media;
      return media.canUseSfsBlossomStorage
        ? formatBytesForPlanMarketing(media.monthlyStorageBytes)
        : "-";
    },
  },
  {
    group: GROUP_MEDIA,
    label: "Monthly hosted uploads",
    getValue: (plan) => {
      if (plan.isTeamsPlaceholder) return null;
      const planType = mapLegacyPlanIdToCommercialPlanType(plan.id);
      const media = getCanonicalPlanPolicy(planType).media;
      return media.canUseSfsBlossomStorage
        ? formatBytesForPlanMarketing(media.monthlyUploadBytes)
        : "-";
    },
  },
  {
    group: GROUP_MEDIA,
    label: "Max hosted file size",
    getValue: (plan) => {
      if (plan.isTeamsPlaceholder) return null;
      const planType = mapLegacyPlanIdToCommercialPlanType(plan.id);
      const media = getCanonicalPlanPolicy(planType).media;
      return media.canUseSfsBlossomStorage
        ? formatBytesForPlanMarketing(media.maxFileBytes)
        : "-";
    },
  },
  {
    group: GROUP_CAMPAIGNS,
    label: "Giveaways and contests",
    getValue: (plan) => (plan.isTeamsPlaceholder ? null : true),
  },
  {
    group: GROUP_CAMPAIGNS,
    label: "Campaign commission",
    getValue: (plan) => {
      if (plan.isTeamsPlaceholder) return null;
      return campaignCommissionPercent(plan.id) ?? "-";
    },
  },
  {
    group: GROUP_POWER,
    label: "Blastr fanout distribution",
    tooltip:
      "Fanout relay infrastructure for stronger distribution on supported Nostr workflows.",
    getValue: (plan) => {
      if (plan.isTeamsPlaceholder) return null;
      // Only advertise this if it's explicitly enabled for the plan.
      return Boolean(plan.features["relayBlast"]);
    },
  },
];

function renderCell(plan: PricingPagePlan, value: unknown): React.ReactNode {
  if (plan.isTeamsPlaceholder) {
    return (
      <span className="text-muted-foreground text-center text-xs font-medium">
        Coming soon
      </span>
    );
  }

  if (typeof value === "boolean") {
    return value ? (
      <Check className="text-success dark:text-success mx-auto h-[18px] w-[18px]" />
    ) : (
      <X className="text-muted-foreground mx-auto h-[18px] w-[18px]" />
    );
  }

  if (typeof value === "string") {
    return (
      <span className="text-foreground px-2 text-center text-sm leading-relaxed">
        {value}
      </span>
    );
  }

  if (typeof value === "number") {
    return (
      <span className="text-foreground px-2 text-center text-sm font-medium tabular-nums">
        {value}
      </span>
    );
  }

  return <span className="text-muted-foreground">-</span>;
}

export function FeatureComparisonTable({ plans }: FeatureComparisonTableProps) {
  const groupOrder = [
    ...new Set(COMPARISON_ROWS.map((r) => r.group)),
  ] as string[];

  return (
    <div className="border-border bg-card overflow-hidden rounded-xl border shadow-md">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-border border-b">
              <th className="text-foreground w-[30%] px-4 py-3.5 text-left text-sm font-semibold">
                Features
              </th>
              {plans.map((plan) => (
                <th
                  key={plan.id}
                  className="text-foreground px-4 py-3.5 text-center text-sm font-semibold"
                >
                  {plan.name}
                  {plan.isComingSoon ? (
                    <span className="text-muted-foreground mt-0.5 block text-xs font-medium">
                      Coming soon
                    </span>
                  ) : null}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {groupOrder.map((groupTitle) => {
              const rows = COMPARISON_ROWS.filter(
                (r) => r.group === groupTitle
              );
              return (
                <Fragment key={groupTitle}>
                  <tr className="border-border bg-muted/35 border-y">
                    <td
                      colSpan={plans.length + 1}
                      className="text-foreground/90 px-4 py-2.5 text-[11px] font-semibold tracking-[0.14em] uppercase"
                    >
                      {groupTitle}
                    </td>
                  </tr>
                  {rows.map((feature, index) => (
                    <tr
                      key={`${groupTitle}-${feature.label}`}
                      className={`border-border border-b ${
                        index % 2 === 0 ? "bg-muted/10" : "bg-card"
                      }`}
                    >
                      <td className="text-foreground px-4 py-3 text-sm font-medium">
                        <span className="inline-flex items-center gap-1.5">
                          {feature.label}
                          {feature.tooltip ? (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button
                                  type="button"
                                  className="text-muted-foreground hover:text-foreground hidden shrink-0 transition md:inline-flex"
                                  aria-label={`More about ${feature.label}`}
                                >
                                  <HelpCircle className="h-3.5 w-3.5" />
                                </button>
                              </TooltipTrigger>
                              <TooltipContent
                                side="top"
                                className="max-w-xs text-xs leading-snug"
                              >
                                {feature.tooltip}
                              </TooltipContent>
                            </Tooltip>
                          ) : null}
                        </span>
                      </td>
                      {plans.map((plan) => (
                        <td
                          key={plan.id}
                          className="px-4 py-3 text-center align-middle"
                        >
                          {renderCell(plan, feature.getValue(plan))}
                        </td>
                      ))}
                    </tr>
                  ))}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
