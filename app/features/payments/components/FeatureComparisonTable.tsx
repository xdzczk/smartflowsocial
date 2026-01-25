/**
 * Feature comparison table component
 */

import { Check, X } from "lucide-react";
interface Plan {
  id: string;
  name: string;
  features: Record<string, boolean | string>;
}

interface FeatureComparisonTableProps {
  plans: Plan[];
}

const featureLabels = [
  { key: "basicScheduling", label: "Basic scheduling" },
  { key: "multipleQueues", label: "Multiple queues" },
  { key: "bulkScheduling", label: "Bulk scheduling" },
  { key: "repostsAndQuotes", label: "Reposts & quotes" },
  { key: "engagementFeed", label: "Engagement Feed" },
  { key: "giveaways", label: "Giveaways" },
  { key: "commissions", label: "Commissions" },
  { key: "leaderboards", label: "Leaderboards" },
  { key: "advancedAnalytics", label: "Advanced analytics" },
  { key: "multiAccountSwitching", label: "Multi-account switching" },
  { key: "wolfFilteringAndVortex", label: "WoT filtering & Vertex relay" },
  { key: "nativeS3BlossomStorage", label: "Native SFS Blosstr storage" },
  { key: "relayBlast", label: "Relay blast" },
  { key: "visualPerks", label: "Visual Perks" },
  { key: "lifetimeAccess", label: "Lifetime Access" },
];

function renderFeatureValue(
  feature: { key: string; label: string },
  plan: Plan
) {
  const value = plan.features[feature.key];

  if (typeof value === "boolean") {
    return value ? (
      <Check className="mx-auto h-5 w-5 text-green-500 dark:text-green-400" />
    ) : (
      <X className="text-muted-foreground mx-auto h-5 w-5" />
    );
  }

  if (typeof value === "string") {
    return (
      <span className="text-foreground px-2 text-center text-sm">{value}</span>
    );
  }

  return <span className="text-muted-foreground">-</span>;
}

export function FeatureComparisonTable({ plans }: FeatureComparisonTableProps) {
  return (
    <div className="border-border bg-card overflow-hidden rounded-lg border shadow-lg">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-border border-b">
              <th className="text-foreground p-4 text-left font-medium">
                Features
              </th>
              {plans.map((plan) => (
                <th
                  key={plan.id}
                  className="text-foreground p-4 text-center font-medium"
                >
                  {plan.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {featureLabels.map((feature, index) => (
              <tr
                key={feature.key}
                className={`border-border border-b ${
                  index % 2 === 0 ? "bg-secondary/30" : "bg-card"
                }`}
              >
                <td className="text-foreground p-4 font-medium">
                  {feature.label}
                </td>
                {plans.map((plan) => (
                  <td key={plan.id} className="p-4 text-center">
                    {renderFeatureValue(feature, plan)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
