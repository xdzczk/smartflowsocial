/**
 * Feature comparison: Free, Creator, Pro (no Teams/Founder columns).
 */

import { Check, X } from "lucide-react";
import { Fragment } from "react";

import { getPlanEntitlements } from "~/features/payments/entitlements/plan-entitlements";
import {
  formatBytesForPlanMarketing,
  formatPlanCapForDisplay,
  higherTierLabelFromLegacyPlanId,
} from "~/features/payments/limit-display";
import { mapLegacyPlanIdToCommercialPlanType } from "~/features/payments/plan-mapping";
import { getCanonicalPlanPolicy } from "~/features/payments/plan-policy";
import type { PricingPagePlan } from "~/features/payments/types/plan-loader.types";

interface FeatureComparisonTableProps {
  plans: PricingPagePlan[];
}

const GROUP_CORE_WORKFLOWS = "Core workflows";
const GROUP_PLANNING = "Planning and execution";
const GROUP_CAMPAIGNS = "Campaigns";
const GROUP_MEDIA = "Media";
const GROUP_POWER = "Power features";

interface ComparisonRow {
  group: string;
  label: string;
  getValue: (plan: PricingPagePlan) => boolean | string | number | null;
}

function campaignCommissionPercent(planId: string): string | null {
  if (planId === "free") return "10%";
  if (planId === "basic") return "5%";
  if (planId === "premium") return "0%";
  return null;
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
    label: "Engagement Feed",
    getValue: (plan) => (plan.isTeamsPlaceholder ? null : true),
  },
  {
    group: GROUP_CORE_WORKFLOWS,
    label: "Drafts & Templates",
    getValue: (plan) => (plan.isTeamsPlaceholder ? null : true),
  },
  {
    group: GROUP_CORE_WORKFLOWS,
    label: "Draft/template limits",
    getValue: (plan) => {
      if (plan.isTeamsPlaceholder) return null;
      const ent = getPlanEntitlements(plan.id);
      if (ent.maxDrafts == null && ent.maxTemplates == null) {
        return higherTierLabelFromLegacyPlanId(plan.id) ?? "—";
      }
      return `${formatPlanCapForDisplay({ planId: plan.id, value: ent.maxDrafts })} drafts / ${formatPlanCapForDisplay({ planId: plan.id, value: ent.maxTemplates })} templates`;
    },
  },
  {
    group: GROUP_PLANNING,
    label: "Scheduled items included",
    getValue: (plan) => {
      if (plan.isTeamsPlaceholder) return null;
      const ent = getPlanEntitlements(plan.id);
      if (ent.maxFutureScheduledItems == null) {
        return higherTierLabelFromLegacyPlanId(plan.id) ?? "—";
      }
      return ent.maxFutureScheduledItems;
    },
  },
  {
    group: GROUP_PLANNING,
    label: "Queue count",
    getValue: (plan) => {
      if (plan.isTeamsPlaceholder) return null;
      const ent = getPlanEntitlements(plan.id);
      if (ent.maxQueues == null) {
        return higherTierLabelFromLegacyPlanId(plan.id) ?? "—";
      }
      return ent.maxQueues;
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
      return ent.canSendBroadcast ? "Yes" : "Explore only";
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
    label: "SFS-hosted media",
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
        : "—";
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
        : "—";
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
        : "—";
    },
  },
  {
    group: GROUP_CAMPAIGNS,
    label: "Giveaways & Contests",
    getValue: (plan) => (plan.isTeamsPlaceholder ? null : true),
  },
  {
    group: GROUP_CAMPAIGNS,
    label: "Campaign commission",
    getValue: (plan) => {
      if (plan.isTeamsPlaceholder) return null;
      return campaignCommissionPercent(plan.id) ?? "—";
    },
  },
  {
    group: GROUP_POWER,
    label: "Relay blast & distribution",
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
      <span className="text-muted-foreground text-center text-xs">
        Coming soon
      </span>
    );
  }

  if (typeof value === "boolean") {
    return value ? (
      <Check className="text-success dark:text-success mx-auto h-5 w-5" />
    ) : (
      <X className="text-muted-foreground mx-auto h-5 w-5" />
    );
  }

  if (typeof value === "string") {
    return (
      <span className="text-foreground px-2 text-center text-sm">{value}</span>
    );
  }

  if (typeof value === "number") {
    return (
      <span className="text-foreground px-2 text-center text-sm tabular-nums">
        {value}
      </span>
    );
  }

  return <span className="text-muted-foreground">—</span>;
}

export function FeatureComparisonTable({ plans }: FeatureComparisonTableProps) {
  const groupOrder = [
    ...new Set(COMPARISON_ROWS.map((r) => r.group)),
  ] as string[];

  return (
    <div className="border-border bg-card overflow-hidden rounded-lg border shadow-lg">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-border border-b">
              <th className="text-foreground w-[30%] p-4 text-left font-medium">
                Features
              </th>
              {plans.map((plan) => (
                <th
                  key={plan.id}
                  className="text-foreground p-4 text-center font-medium"
                >
                  {plan.name}
                  {plan.isComingSoon ? (
                    <span className="text-muted-foreground ml-1 block text-xs font-normal">
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
                  <tr className="border-border bg-muted/40 border-b">
                    <td
                      colSpan={plans.length + 1}
                      className="text-foreground p-3 pl-4 text-xs font-semibold tracking-wide uppercase"
                    >
                      {groupTitle}
                    </td>
                  </tr>
                  {rows.map((feature, index) => (
                    <tr
                      key={`${groupTitle}-${feature.label}`}
                      className={`border-border border-b ${
                        index % 2 === 0 ? "bg-muted/15" : "bg-card"
                      }`}
                    >
                      <td className="text-foreground p-4 text-sm font-medium">
                        {feature.label}
                      </td>
                      {plans.map((plan) => (
                        <td
                          key={plan.id}
                          className="p-4 text-center align-middle"
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
