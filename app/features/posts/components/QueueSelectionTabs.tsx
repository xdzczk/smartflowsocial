import { Link, useParams, useRevalidator } from "@remix-run/react";

import { getQueueColor } from "~/features/posts/queueColors";
import type { QueueType } from "~/features/posts/types";
interface QueueSelectionTabsProps {
  currentTab: string;
  queueTypes: (QueueType | string)[];
  basePath?: string;
}

export default function QueueSelectionTabs({
  currentTab,
  queueTypes,
  basePath = "/dashboard",
}: QueueSelectionTabsProps) {
  const params = useParams();
  const revalidator = useRevalidator();

  const baseClasses =
    "whitespace-nowrap border-b-2 px-1 py-2 text-sm font-medium capitalize";
  const unselectedClasses =
    "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300";

  return (
    <div className="mb-6 border-b border-gray-200 dark:border-gray-700">
      <nav className="-mb-px flex space-x-8" aria-label="Queue Types">
        <Link
          to={`${basePath}?tab=${currentTab}`}
          prefetch="intent"
          onClick={() => setTimeout(() => revalidator.revalidate(), 0)}
          className={`whitespace-nowrap border-b-2 px-1 py-2 text-sm font-medium ${
            !params.queueType
              ? "border-blue-500 text-blue-600 dark:text-blue-400"
              : unselectedClasses
          }`}
        >
          All Queues
        </Link>
        {queueTypes.map((queueType) => {
          const queueName =
            typeof queueType === "string" ? queueType : queueType.name;
          const queueColor =
            typeof queueType === "object" ? queueType.color : null;
          const colors = getQueueColor(queueName, queueColor);
          const isSelected = params.queueType === queueName;

          if (isSelected && queueColor) {
            // Use inline styles for custom colors
            return (
              <Link
                key={typeof queueType === "object" ? queueType.id || queueName : queueName}
                to={`${basePath}/scheduled/${queueName}?tab=${currentTab}`}
                prefetch="intent"
                onClick={() => setTimeout(() => revalidator.revalidate(), 0)}
                className={`${baseClasses} border-b-2`}
                style={{
                  borderBottomColor: queueColor,
                  color: queueColor,
                }}
              >
                {queueName}
              </Link>
            );
          }

          return (
            <Link
              key={typeof queueType === "object" ? (queueType.id || queueName) : queueName}
              to={`${basePath}/scheduled/${queueName}?tab=${currentTab}`}
              prefetch="intent"
              onClick={() => setTimeout(() => revalidator.revalidate(), 0)}
              className={`${baseClasses} ${
                isSelected
                  ? `${colors.border?.replace("border-", "border-b-") || "border-b-blue-500"} ${colors.text || "text-blue-600"}`
                  : unselectedClasses
              }`}
            >
              {queueName}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
