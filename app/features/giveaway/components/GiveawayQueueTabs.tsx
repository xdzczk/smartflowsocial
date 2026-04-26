import { Link, useRevalidator } from "@remix-run/react";

import {
  getQueueAccentHex,
  getQueueColor,
} from "~/features/posts/queue-colors";
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
    <div className="border-border mb-6 border-b">
      <nav className="-mb-px flex space-x-8" aria-label="Queue Types">
        <Link
          to="/dashboard/giveaway"
          prefetch="intent"
          onClick={() => setTimeout(() => revalidator.revalidate(), 0)}
          className={`border-b-2 px-1 py-2 text-sm font-medium whitespace-nowrap ${
            !currentQueueType
              ? "border-selection-border text-selection-foreground"
              : "text-text-secondary hover:border-border hover:text-text border-transparent"
          }`}
        >
          All Queues
        </Link>
        {queueTypes.map((queueType) => {
          const queueName =
            typeof queueType === "string" ? queueType : queueType.name;
          const colorToken =
            typeof queueType === "object"
              ? (queueType as { colorToken?: string | null }).colorToken
              : null;
          const colors = getQueueColor(queueName, colorToken);
          const isSelected = currentQueueType === queueName;

          const baseClasses =
            "whitespace-nowrap border-b-2 px-1 py-2 text-sm font-medium capitalize";
          const unselectedClasses =
            "border-transparent text-text-secondary hover:border-border hover:text-text";

          if (isSelected && colorToken) {
            const accentHex = getQueueAccentHex(colorToken);
            return (
              <Link
                key={typeof queueType === "object" ? queueType.id : queueName}
                to={`/dashboard/giveaway/${queueName}`}
                prefetch="intent"
                onClick={() => setTimeout(() => revalidator.revalidate(), 0)}
                className={`${baseClasses} border-b-2`}
                style={{
                  borderBottomColor: accentHex,
                  color: accentHex,
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
                  ? `border-selection-border text-selection-foreground ${colors.text}`
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
