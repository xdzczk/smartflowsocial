import { Link, useRevalidator, useSearchParams } from "@remix-run/react";

import { getQueueAccentHex, getQueueColor } from "../queue-colors";
interface QueueType {
  name: string;
  color?: string | null;
}

interface RecyclablesQueueTabsProps {
  queueTypes: QueueType[] | string[];
  currentQueueType?: string;
  /** When true, omit outer border/margin for use in a single filter row (e.g. with date filter). */
  inRow?: boolean;
}

/**
 * Queue type tabs for filtering recyclables posts
 */
export function RecyclablesQueueTabs({
  queueTypes,
  currentQueueType,
  inRow = false,
}: RecyclablesQueueTabsProps) {
  const revalidator = useRevalidator();
  const [searchParams] = useSearchParams();
  const search = searchParams.toString();
  const searchSuffix = search ? `?${search}` : "";

  return (
    <div className={inRow ? "min-w-0 flex-1" : "border-border mb-6 border-b"}>
      <nav className="-mb-px flex flex-wrap space-x-8" aria-label="Queue Types">
        <Link
          to={`/dashboard/recyclables${searchSuffix}`}
          prefetch="intent"
          onClick={() => setTimeout(() => revalidator.revalidate(), 0)}
          className={`border-b-2 px-1 py-2 text-sm font-medium whitespace-nowrap ${
            !currentQueueType
              ? "border-border text-foreground dark:border-primary dark:text-primary"
              : "text-muted-foreground hover:border-border hover:text-foreground border-transparent"
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
            "border-transparent text-muted-foreground hover:border-border hover:text-foreground";

          if (isSelected && colorToken) {
            const accentHex = getQueueAccentHex(colorToken);
            return (
              <Link
                key={queueName}
                to={`/dashboard/recyclables/${queueName}${searchSuffix}`}
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
              key={queueName}
              to={`/dashboard/recyclables/${queueName}${searchSuffix}`}
              prefetch="intent"
              onClick={() => setTimeout(() => revalidator.revalidate(), 0)}
              className={`${baseClasses} ${
                isSelected
                  ? `${colors.border.replace("border-", "border-b-")} ${colors.text}`
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
