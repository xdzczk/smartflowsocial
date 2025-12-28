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
  plan: Plan,
) {
  const value = plan.features[feature.key];

  if (typeof value === "boolean") {
    return value ? (
      <Check className="mx-auto h-5 w-5 text-green-500" />
    ) : (
      <X className="mx-auto h-5 w-5 text-gray-400" />
    );
  }

  if (typeof value === "string") {
    return <span className="px-2 text-center text-sm">{value}</span>;
  }

  return <span className="text-gray-400">-</span>;
}

export function FeatureComparisonTable({
  plans,
}: FeatureComparisonTableProps) {
  return (
    <div className="overflow-hidden rounded-lg bg-white shadow-lg dark:bg-gray-800">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-700">
              <th className="p-4 text-left font-medium text-black dark:text-white">
                Features
              </th>
              {plans.map((plan) => (
                <th
                  key={plan.id}
                  className="p-4 text-center font-medium text-black dark:text-white"
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
                className={`border-b border-gray-200 dark:border-gray-700 ${
                  index % 2 === 0
                    ? "dark:bg-gray-750 bg-gray-50"
                    : "bg-white dark:bg-gray-800"
                }`}
              >
                <td className="p-4 font-medium text-black dark:text-white">
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










