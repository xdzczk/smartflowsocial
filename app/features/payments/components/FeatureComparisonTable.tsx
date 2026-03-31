/**
 * Feature comparison: Free, Basic, Premium, Teams (no Founder column).
 */

import { Check, X } from "lucide-react";
import { Fragment } from "react";

import type { PricingPagePlan } from "~/features/payments/types/plan-loader.types";

interface FeatureComparisonTableProps {
  plans: PricingPagePlan[];
}

const GROUP_CORE_PUBLISHING = "Core publishing";
const GROUP_PLANNING = "Planning and scheduling";
const GROUP_ENGAGEMENT = "Engagement and campaigns";
const GROUP_POWER = "Power and infrastructure";

const COMPARISON_ROWS: Array<{
  group: string;
  key: keyof PricingPagePlan["features"] | string;
  label: string;
}> = [
  {
    group: GROUP_CORE_PUBLISHING,
    key: "basicScheduling",
    label: "Scheduling & composer core",
  },
  {
    group: GROUP_CORE_PUBLISHING,
    key: "repostsAndQuotes",
    label: "Reposts, quotes, richer note types",
  },
  {
    group: GROUP_CORE_PUBLISHING,
    key: "nativeS3BlossomStorage",
    label: "Media uploads & storage paths",
  },
  {
    group: GROUP_PLANNING,
    key: "multipleQueues",
    label: "Queues & parallel publishing",
  },
  {
    group: GROUP_PLANNING,
    key: "bulkScheduling",
    label: "Bulk & power scheduling",
  },
  {
    group: GROUP_ENGAGEMENT,
    key: "engagementFeed",
    label: "Engagement feed & workflows",
  },
  {
    group: GROUP_ENGAGEMENT,
    key: "giveaways",
    label: "Giveaways & contests",
  },
  {
    group: GROUP_ENGAGEMENT,
    key: "commissions",
    label: "Campaign fee economics",
  },
  {
    group: GROUP_POWER,
    key: "advancedAnalytics",
    label: "Analytics depth",
  },
  {
    group: GROUP_POWER,
    key: "multiAccountSwitching",
    label: "Multi-account switching",
  },
  {
    group: GROUP_POWER,
    key: "relayBlast",
    label: "Relay blast & distribution",
  },
  {
    group: GROUP_POWER,
    key: "wolfFilteringAndVortex",
    label: "WoT filtering & relay tooling",
  },
];

function renderCell(
  plan: PricingPagePlan,
  featureKey: string
): React.ReactNode {
  if (plan.isTeamsPlaceholder) {
    return (
      <span className="text-muted-foreground text-center text-xs">
        Coming soon
      </span>
    );
  }

  const value = plan.features[featureKey];

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
                      key={`${groupTitle}-${feature.key}-${feature.label}`}
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
                          {renderCell(plan, feature.key)}
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
