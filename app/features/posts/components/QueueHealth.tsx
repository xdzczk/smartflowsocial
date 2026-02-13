import { Link } from "@remix-run/react";
import type { CSSProperties } from "react";

import { Card, CardContent, CardHeader } from "~/components/ui/card";

import {
  getQueueAccentHex,
  getQueueColorBundle,
  type QueueColorBundle,
} from "../queue-colors";
import type { QueueType } from "../types";

const QUEUE_COLOR_CSS_VAR = "--queue-color";

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
    /* eslint-disable jsx-a11y/no-noninteractive-tabindex -- div is focusable so touch can reveal full queue colors via :focus-within */
    <div
      className="group focus-visible:ring-ring flex min-w-0 flex-1 flex-col focus:outline-none focus-visible:ring-2 focus-visible:ring-inset"
      tabIndex={0}
      role="group"
      aria-label="Queue Health"
    >
      {/* eslint-enable jsx-a11y/no-noninteractive-tabindex */}
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
              className={`flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-4 ${
                countsByQueue.length <= 6
                  ? "[&>li]:flex [&>li]:min-h-0 [&>li]:flex-1"
                  : ""
              }`}
              aria-label="Scheduled posts per queue"
            >
              {countsByQueue.map(({ queueName, count }) => {
                const bundle = getQueueBundle(queueName, queueTypes);
                const accentHex = getQueueAccentHexOrNull(
                  queueName,
                  queueTypes
                );
                const widthPercent = (count / maxCount) * 100;
                const scheduledUrl = `/dashboard/scheduled?queueType=${encodeURIComponent(queueName)}`;
                const linkStyle:
                  | (CSSProperties & Record<string, string>)
                  | undefined = bundle
                  ? { [QUEUE_COLOR_CSS_VAR]: bundle.accent }
                  : undefined;

                return (
                  <li key={queueName} className="flex min-h-[2.75rem] flex-col">
                    <Link
                      to={scheduledUrl}
                      className={`focus:ring-ring card-lift bg-muted/30 hover:bg-muted/50 flex h-full min-h-[2.75rem] flex-col justify-center gap-1.5 rounded-lg px-3 py-1.5 transition-shadow focus:ring-2 focus:outline-none ${bundle ? "queue-health-row" : ""}`}
                      style={linkStyle}
                    >
                      <div className="flex min-w-0 flex-1 items-center justify-between gap-2">
                        <span className="text-foreground min-w-0 truncate text-xs font-medium">
                          {queueName}
                        </span>
                        <span
                          className={`flex-shrink-0 text-xs tabular-nums transition-opacity duration-200 ${bundle ? "font-bold opacity-50 group-focus-within:opacity-100 group-hover:opacity-100 group-active:opacity-100" : "text-muted-foreground"}`}
                          style={bundle ? { color: bundle.accent } : undefined}
                        >
                          {count}
                        </span>
                      </div>
                      <div
                        className={`h-2.5 min-w-0 overflow-hidden rounded-[1px] ${bundle ? "" : "bg-muted/30"}`}
                        role="presentation"
                        aria-hidden
                        style={
                          bundle
                            ? { backgroundColor: bundle.surface }
                            : undefined
                        }
                      >
                        <div
                          className={`h-full min-w-0 rounded-[1px] transition-[width,opacity] duration-200 ${accentHex ? "opacity-40 group-focus-within:opacity-100 group-hover:opacity-100 group-active:opacity-100" : getBarFillClass(queueName)}`}
                          style={{
                            width: `${widthPercent}%`,
                            ...(accentHex
                              ? { backgroundColor: accentHex }
                              : undefined),
                          }}
                        />
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
