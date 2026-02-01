import { Link } from "@remix-run/react";

import { Card, CardContent, CardHeader } from "~/components/ui/card";

import { getQueueColor } from "../queue-colors";
import type { QueueType } from "../types";

export interface QueueHealthProps {
  queueCounts: Array<{ queueName: string; count: number }>;
  queueTypes?: Array<QueueType | { name: string; color?: string | null }>;
}

function getQueueColorHex(
  queueName: string,
  queueTypes: QueueHealthProps["queueTypes"]
): string | null {
  if (!queueTypes) return null;
  const qt = queueTypes.find(
    (q) => (typeof q === "object" ? q.name : q) === queueName
  );
  if (typeof qt !== "object") return null;
  const withColor = qt as { color?: string | null };
  return withColor.color ?? null;
}

export default function QueueHealth({
  queueCounts,
  queueTypes,
}: QueueHealthProps) {
  const maxCount = Math.max(...queueCounts.map((q) => q.count), 1);

  return (
    <Card className="flex min-w-0 flex-1 flex-col">
      <CardHeader className="px-3 pt-2 pb-0.5">
        <h3 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
          Queue Health
        </h3>
      </CardHeader>
      <CardContent className="flex flex-col gap-1 px-3 pt-0 pb-3">
        {queueCounts.length === 0 ? (
          <p className="text-muted-foreground text-xs">
            No queues with scheduled posts.
          </p>
        ) : (
          <ul
            className="flex flex-col gap-1"
            aria-label="Scheduled posts per queue"
          >
            {queueCounts.map(({ queueName, count }) => {
              const customColor = getQueueColorHex(queueName, queueTypes);
              const colors = getQueueColor(queueName, customColor) ?? {
                bg: "bg-muted",
                text: "text-muted-foreground",
                hover: "hover:bg-muted/80",
                border: "border-border",
              };
              const widthPercent = maxCount > 0 ? (count / maxCount) * 100 : 0;
              return (
                <li key={queueName} className="flex flex-col gap-0.5">
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <Link
                      to={`/dashboard/scheduled?queueType=${encodeURIComponent(queueName)}`}
                      className="text-foreground focus:ring-primary min-w-0 truncate rounded font-medium hover:underline focus:ring-2 focus:ring-offset-2 focus:outline-none"
                    >
                      {queueName}
                    </Link>
                    <span className="text-muted-foreground flex-shrink-0 tabular-nums">
                      {count}
                    </span>
                  </div>
                  <div
                    className="bg-muted h-1 w-full overflow-hidden rounded-full"
                    role="presentation"
                  >
                    <div
                      className={`h-full rounded-full ${colors.bg} ${colors.border} border`}
                      style={{ width: `${widthPercent}%` }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
