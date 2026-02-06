import { Link } from "@remix-run/react";

import { Card, CardContent, CardHeader } from "~/components/ui/card";

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
  const maxCount =
    queueCounts.length > 0
      ? Math.max(...queueCounts.map((c) => c.count), 1)
      : 1;

  return (
    <Card className="flex min-w-0 flex-1 flex-col shadow-sm dark:shadow-none">
      <CardHeader className="px-4 pt-2 pb-1.5">
        <h3 className="text-muted-foreground/90 text-[11px] font-medium tracking-tight uppercase">
          Queue Health
        </h3>
      </CardHeader>
      <CardContent className="flex flex-col gap-1 px-4 pt-0 pb-3">
        {queueCounts.length === 0 ? (
          <p className="text-muted-foreground text-xs">
            No queues with scheduled posts.
          </p>
        ) : (
          <ul
            className="flex flex-col gap-1.5"
            aria-label="Scheduled posts per queue"
          >
            {queueCounts.map(({ queueName, count }) => {
              const customColor = getQueueColorHex(queueName, queueTypes);
              const widthPercent = (count / maxCount) * 100;

              return (
                <li key={queueName} className="flex flex-col gap-0.5">
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <Link
                      to={`/dashboard/scheduled?queueType=${encodeURIComponent(queueName)}`}
                      className="text-foreground focus:ring-primary min-w-0 truncate rounded font-medium hover:underline focus:ring-2 focus:outline-none"
                    >
                      {queueName}
                    </Link>
                    <span className="text-muted-foreground flex-shrink-0 tabular-nums">
                      {count}
                    </span>
                  </div>
                  <div
                    className="bg-muted/30 h-2 w-full overflow-hidden rounded-md"
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
