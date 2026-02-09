import { Link } from "@remix-run/react";

import { Card, CardContent, CardHeader } from "~/components/ui/card";

import { getQueueAccentHex } from "../queue-colors";
import type { QueueType } from "../types";

/** Solid Tailwind background class per named queue for bar fill (no arbitrary values). */
const BAR_FILL_CLASS: Record<string, string> = {
  main: "bg-primary",
  memes: "bg-success",
  quotes: "bg-accent",
  unassigned: "bg-muted",
};

function getBarFillClass(queueName: string): string {
  return BAR_FILL_CLASS[queueName.toLowerCase()] ?? "bg-muted";
}

export interface QueueHealthProps {
  queueCounts: Array<{ queueName: string; count: number }>;
  queueTypes?: Array<
    | QueueType
    | { name: string; color?: string | null; colorToken?: string | null }
  >;
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
  const withToken = qt as { colorToken?: string | null; color?: string | null };
  if (withToken.colorToken) {
    return getQueueAccentHex(withToken.colorToken);
  }
  return null;
}

export default function QueueHealth({
  queueCounts,
  queueTypes,
}: QueueHealthProps) {
  const countsByQueue = queueCounts.filter((c) => c.queueName !== "Unassigned");
  const maxCount =
    countsByQueue.length > 0
      ? Math.max(...countsByQueue.map((c) => c.count), 1)
      : 1;

  return (
    <Card className="flex min-w-0 flex-1 flex-col shadow-sm dark:shadow-none">
      <CardHeader className="px-4 pt-2 pb-1.5">
        <h3 className="text-foreground text-[11px] font-medium tracking-tight uppercase">
          Queue Health
        </h3>
      </CardHeader>
      <CardContent className="flex min-h-0 flex-1 flex-col px-4 pt-0 pb-3">
        {countsByQueue.length === 0 ? (
          <p className="text-muted-foreground text-xs">
            No queues with scheduled posts.
          </p>
        ) : (
          <ul
            className="flex min-h-0 flex-1 flex-col"
            aria-label="Scheduled posts per queue"
          >
            {countsByQueue.map(({ queueName, count }) => {
              const customColor = getQueueColorHex(queueName, queueTypes);
              const widthPercent = (count / maxCount) * 100;

              return (
                <li
                  key={queueName}
                  className="flex max-h-[5rem] min-h-[2.5rem] flex-1 flex-col justify-center gap-0.5"
                >
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <Link
                      to={`/dashboard/scheduled?queueType=${encodeURIComponent(queueName)}`}
                      className="text-foreground focus:ring-ring min-w-0 truncate rounded font-medium hover:underline focus:ring-2 focus:outline-none"
                    >
                      {queueName}
                    </Link>
                    <span className="text-muted-foreground flex-shrink-0 tabular-nums">
                      {count}
                    </span>
                  </div>
                  <div
                    className="bg-muted/30 h-2.5 w-full overflow-hidden rounded-md"
                    role="presentation"
                    aria-label={`${count} posts in ${queueName}`}
                  >
                    <div
                      className={`h-full rounded-md transition-[width] ${customColor ? "" : getBarFillClass(queueName)}`}
                      style={{
                        width: `${widthPercent}%`,
                        ...(customColor
                          ? { backgroundColor: customColor }
                          : undefined),
                      }}
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
