import { Link, useRevalidator } from "@remix-run/react";

import { getQueueColor } from "../queue-colors";
interface QueueType {
  name: string;
  color?: string | null;
}

interface RecyclablesQueueTabsProps {
  queueTypes: QueueType[] | string[];
  currentQueueType?: string;
}

/**
 * Queue type tabs for filtering recyclables posts
 */
export function RecyclablesQueueTabs({
  queueTypes,
  currentQueueType,
}: RecyclablesQueueTabsProps) {
  const revalidator = useRevalidator();

  return (
    <div className="border-border mb-6 border-b">
      <nav className="-mb-px flex space-x-8" aria-label="Queue Types">
        <Link
          to="/dashboard/recyclables"
          prefetch="intent"
          onClick={() => setTimeout(() => revalidator.revalidate(), 0)}
          className={`border-b-2 px-1 py-2 text-sm font-medium whitespace-nowrap ${
            !currentQueueType
              ? "border-primary text-primary"
              : "text-muted-foreground hover:border-border hover:text-foreground border-transparent"
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
          const safeColors = colors ?? getQueueColor("unassigned");
          const isSelected = currentQueueType === queueName;

          const baseClasses =
            "whitespace-nowrap border-b-2 px-1 py-2 text-sm font-medium capitalize";
          const unselectedClasses =
            "border-transparent text-muted-foreground hover:border-border hover:text-foreground";

          if (isSelected && queueColor) {
            // Use inline styles for custom colors
            return (
              <Link
                key={queueName}
                to={`/dashboard/recyclables/${queueName}`}
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

          if (!safeColors) {
            return null;
          }

          return (
            <Link
              key={queueName}
              to={`/dashboard/recyclables/${queueName}`}
              prefetch="intent"
              onClick={() => setTimeout(() => revalidator.revalidate(), 0)}
              className={`${baseClasses} ${
                isSelected
                  ? `${safeColors.border.replace("border-", "border-b-")} ${safeColors.text}`
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
