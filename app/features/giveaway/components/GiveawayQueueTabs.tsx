import { Link } from "@remix-run/react";
import { useRevalidator } from "@remix-run/react";

import { getQueueColor } from "~/features/posts/queueColors";

interface QueueType {
  id: string;
  name: string;
  color?: string | null;
}

interface GiveawayQueueTabsProps {
  queueTypes: QueueType[] | string[];
  currentQueueType?: string;
}

/**
 * Queue type tabs for filtering giveaway posts
 */
export function GiveawayQueueTabs({
  queueTypes,
  currentQueueType,
}: GiveawayQueueTabsProps) {
  const revalidator = useRevalidator();

  return (
    <div className="mb-6 border-b border-gray-200 dark:border-gray-700">
      <nav className="-mb-px flex space-x-8" aria-label="Queue Types">
        <Link
          to="/dashboard/giveaway"
          prefetch="intent"
          onClick={() => setTimeout(() => revalidator.revalidate(), 0)}
          className={`whitespace-nowrap border-b-2 px-1 py-2 text-sm font-medium ${
            !currentQueueType
              ? "border-blue-500 text-blue-600 dark:text-blue-400"
              : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
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
          const isSelected = currentQueueType === queueName;

          const baseClasses =
            "whitespace-nowrap border-b-2 px-1 py-2 text-sm font-medium capitalize";
          const unselectedClasses =
            "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300";

          if (isSelected && queueColor) {
            // Use inline styles for custom colors
            return (
              <Link
                key={typeof queueType === "object" ? queueType.id : queueName}
                to={`/dashboard/giveaway/${queueName}`}
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
              key={typeof queueType === "object" ? queueType.id : queueName}
              to={`/dashboard/giveaway/${queueName}`}
              prefetch="intent"
              onClick={() => setTimeout(() => revalidator.revalidate(), 0)}
              className={`${baseClasses} ${
                isSelected
                  ? `border-blue-500 ${colors.text}`
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




