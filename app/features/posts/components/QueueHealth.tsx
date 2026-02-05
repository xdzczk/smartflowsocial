import { Link } from "@remix-run/react";

import { Card, CardContent, CardHeader } from "~/components/ui/card";

import type { QueueType } from "../types";

const BLOCK_CAP = 24;

/** Solid Tailwind background class per named queue for block fill (no arbitrary values). */
const BLOCK_FILL_CLASS: Record<string, string> = {
  main: "bg-primary",
  memes: "bg-success",
  quotes: "bg-accent",
  unassigned: "bg-muted",
};

function getBlockFillClass(queueName: string): string {
  return BLOCK_FILL_CLASS[queueName.toLowerCase()] ?? "bg-muted";
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
  return (
    <Card className="flex min-w-0 flex-1 flex-col shadow-sm dark:shadow-none">
      <CardHeader className="px-3 pt-2 pb-1.5">
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
            className="flex flex-col gap-1.5"
            aria-label="Scheduled posts per queue"
          >
            {queueCounts.map(({ queueName, count }) => {
              const customColor = getQueueColorHex(queueName, queueTypes);
              const displayCount = Math.min(count, BLOCK_CAP);
              const overflow = count > BLOCK_CAP ? count - BLOCK_CAP : 0;

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
                    className="flex w-full items-center gap-0.5"
                    aria-hidden="true"
                  >
                    {Array.from({ length: BLOCK_CAP }, (_, i) => {
                      const filled = count > 0 && i < displayCount;
                      return (
                        <span
                          key={`${queueName}-${i}`}
                          className={`h-1.5 min-w-0 flex-1 rounded-none ${filled ? (customColor ? "" : getBlockFillClass(queueName)) : "bg-muted/30"}`}
                          style={
                            filled && customColor
                              ? { backgroundColor: customColor }
                              : undefined
                          }
                        />
                      );
                    })}
                    {overflow > 0 ? (
                      <span className="text-muted-foreground ml-0.5 shrink-0 text-[10px] leading-none">
                        +{overflow}
                      </span>
                    ) : null}
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
