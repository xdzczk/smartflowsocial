import { Link } from "@remix-run/react";
import { LayoutList } from "lucide-react";
import type { CSSProperties } from "react";

import { Card, CardContent, CardHeader } from "~/components/ui/card";
import { INLINE_ICON_STROKE } from "~/lib/icon-constants";

import {
  getQueueAccentHex,
  getQueueColorBundle,
  type QueueColorBundle,
} from "../queue-colors";
import type { QueueType } from "../types";

const QUEUE_COLOR_CSS_VAR = "--queue-color";

/** Row style including custom --queue-color (valid CSS, not in React's CSSProperties). */
type QueueHealthRowStyle = CSSProperties & {
  [QUEUE_COLOR_CSS_VAR]?: string;
};

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

function getQueueToken(
  queueName: string,
  queueTypes: QueueHealthProps["queueTypes"]
): string | null {
  if (!queueTypes) return null;
  const qt = queueTypes.find(
    (q) => (typeof q === "object" ? q.name : q) === queueName
  );
  if (typeof qt !== "object") return null;
  const withToken = qt as { colorToken?: string | null };
  return withToken.colorToken ?? null;
}

function getQueueBundle(
  queueName: string,
  queueTypes: QueueHealthProps["queueTypes"]
): QueueColorBundle | null {
  const token = getQueueToken(queueName, queueTypes);
  if (!token) return null;
  return getQueueColorBundle(token);
}

/** Accent hex for bar fill when using token; null when using Tailwind fallback. */
function getQueueAccentHexOrNull(
  queueName: string,
  queueTypes: QueueHealthProps["queueTypes"]
): string | null {
  const token = getQueueToken(queueName, queueTypes);
  if (!token) return null;
  return getQueueAccentHex(token);
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
      <CardContent className="flex min-h-0 flex-1 flex-col gap-3 px-4 pt-0 pb-3">
        {countsByQueue.length === 0 ? (
          <p className="text-muted-foreground text-xs">
            No queues with scheduled posts.
          </p>
        ) : (
          <ul
            className="flex min-h-0 flex-1 flex-col gap-3"
            aria-label="Scheduled posts per queue"
          >
            {countsByQueue.map(({ queueName, count }) => {
              const bundle = getQueueBundle(queueName, queueTypes);
              const accentHex = getQueueAccentHexOrNull(queueName, queueTypes);
              const widthPercent = (count / maxCount) * 100;

              const rowStyle: QueueHealthRowStyle | undefined = bundle
                ? {
                    [QUEUE_COLOR_CSS_VAR]: bundle.accent,
                    backgroundColor: bundle.soft,
                    borderLeftColor: bundle.accent,
                  }
                : undefined;

              return (
                <li
                  key={queueName}
                  className={`flex min-h-[3.5rem] flex-1 flex-col justify-center gap-1.5 rounded-lg transition-shadow ${bundle ? "queue-health-row card-lift border-l-[3px]" : ""}`}
                  style={rowStyle}
                >
                  <div className="flex items-center justify-between gap-2 px-2 pt-1">
                    <div className="flex min-w-0 flex-1 items-center gap-2">
                      {bundle ? (
                        <div
                          className="flex size-8 flex-shrink-0 items-center justify-center rounded-lg"
                          style={{
                            backgroundColor: bundle.surface,
                            color: bundle.accent,
                          }}
                          aria-hidden
                        >
                          <LayoutList
                            className="size-4"
                            strokeWidth={INLINE_ICON_STROKE}
                          />
                        </div>
                      ) : null}
                      <Link
                        to={`/dashboard/scheduled?queueType=${encodeURIComponent(queueName)}`}
                        className="text-foreground focus:ring-ring min-w-0 truncate rounded text-xs font-medium hover:underline focus:ring-2 focus:outline-none"
                      >
                        {queueName}
                      </Link>
                    </div>
                    <span
                      className={`flex-shrink-0 text-xs tabular-nums ${bundle ? "font-bold" : "text-muted-foreground"}`}
                      style={bundle ? { color: bundle.accent } : undefined}
                    >
                      {count}
                    </span>
                  </div>
                  <div
                    className={`mx-2 mb-1 h-2.5 w-full overflow-hidden rounded-md ${bundle ? "" : "bg-muted/30"}`}
                    role="presentation"
                    aria-label={`${count} posts in ${queueName}`}
                    style={
                      bundle ? { backgroundColor: bundle.surface } : undefined
                    }
                  >
                    <div
                      className={`h-full rounded-md transition-[width] ${accentHex ? "" : getBarFillClass(queueName)}`}
                      style={{
                        width: `${widthPercent}%`,
                        ...(accentHex
                          ? { backgroundColor: accentHex }
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
