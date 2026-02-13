import { Check, Settings2 } from "lucide-react";

import { Card, CardContent, CardHeader } from "~/components/ui/card";

import { getQueueColorBundle, type QueueColorBundle } from "../queue-colors";
import type { QueueType } from "../types";

export type ScheduleNext7DaysQueueTypes = Array<
  | QueueType
  | { name: string; color?: string | null; colorToken?: string | null }
>;

export interface ScheduleNext7DaysCardProps {
  days: Array<{
    dateKey: string;
    count: number;
    byQueue?: Array<{ queueName: string; count: number }>;
  }>;
  targetPerDay: number;
  userTimezone?: string;
  onOpenTargetModal: () => void;
  /** Queue types for resolving block colors (same as Queue Health). */
  queueTypes?: ScheduleNext7DaysQueueTypes;
}

const MAX_BLOCKS = 14;

function getQueueBundleForName(
  queueName: string,
  queueTypes: ScheduleNext7DaysQueueTypes | undefined
): QueueColorBundle | null {
  if (!queueTypes) return null;
  const qt = queueTypes.find(
    (q) => (typeof q === "object" ? q.name : q) === queueName
  );
  if (typeof qt !== "object") return null;
  const token = (qt as { colorToken?: string | null }).colorToken ?? null;
  if (!token) return null;
  return getQueueColorBundle(token);
}

/**
 * Format a dateKey (YYYY-MM-DD) as full label "Friday, February 13" in the given timezone.
 */
function formatDayLabel(dateKey: string, timezone: string): string {
  try {
    const date = new Date(dateKey + "T12:00:00.000Z");
    return date.toLocaleDateString("en-US", {
      timeZone: timezone,
      weekday: "long",
      month: "long",
      day: "numeric",
    });
  } catch {
    const sliced = dateKey.slice(5);
    return sliced || dateKey;
  }
}

function isGap(count: number, targetPerDay: number): boolean {
  if (targetPerDay === 0) {
    return count === 0;
  }
  return count < targetPerDay;
}

export function ScheduleNext7DaysCard({
  days,
  targetPerDay,
  userTimezone = "Etc/UTC",
  onOpenTargetModal,
  queueTypes,
}: ScheduleNext7DaysCardProps) {
  const allSet =
    targetPerDay > 0 &&
    days.length > 0 &&
    days.every((d) => d.count >= targetPerDay);

  return (
    /* eslint-disable jsx-a11y/no-noninteractive-tabindex -- div is focusable so touch can reveal full queue colors via :focus-within */
    <div
      className="group focus-visible:ring-ring flex min-w-0 flex-1 flex-col focus:outline-none focus-visible:ring-2 focus-visible:ring-inset"
      tabIndex={0}
      role="group"
      aria-label="Next 7 days schedule"
    >
      {/* eslint-enable jsx-a11y/no-noninteractive-tabindex */}
      <Card className="bg-muted/30 flex min-w-0 flex-1 flex-col shadow-sm dark:shadow-none">
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-1.5 px-4 pt-2 pb-1.5">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <h3 className="text-foreground text-[11px] font-medium tracking-tight uppercase">
              Next 7 days
            </h3>
            {allSet ? (
              <span
                className="text-muted-foreground flex items-center gap-1 text-xs"
                aria-label="All days meet your target"
              >
                <Check className="text-success size-3.5 shrink-0" />
                All set
              </span>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onOpenTargetModal}
            className="text-muted-foreground hover:text-foreground focus:ring-ring inline-flex flex-shrink-0 items-center gap-1 rounded p-1 text-xs focus:ring-2 focus:outline-none"
            title="Set target per day"
            aria-label="Set target posts per day"
          >
            <Settings2 className="size-3.5" />
            <span>Target</span>
          </button>
        </CardHeader>
        <CardContent className="px-4 pt-0 pb-4">
          <ul
            className="flex flex-col gap-2"
            aria-label="Scheduled posts per day for the next 7 days"
          >
            {days.map(({ dateKey, count, byQueue }) => {
              const gap = isGap(count, targetPerDay);
              const label = formatDayLabel(dateKey, userTimezone);
              const hasBlocks =
                Array.isArray(byQueue) &&
                byQueue.length > 0 &&
                byQueue.some((q) => q.count > 0);
              const blockSummary = hasBlocks
                ? byQueue
                    .filter((q) => q.count > 0)
                    .map((q) => `${q.count} ${q.queueName}`)
                    .join(", ")
                : "";

              return (
                <li
                  key={dateKey}
                  className={`flex min-h-[2.25rem] items-center gap-2 rounded-lg border px-3 py-1.5 text-xs ${
                    gap
                      ? "border-amber-500/50 bg-amber-500/10 dark:border-amber-400/30 dark:bg-amber-500/10"
                      : "border-border/60 bg-muted/20"
                  }`}
                >
                  <span
                    className="text-foreground min-w-[10rem] shrink-0 truncate overflow-hidden font-medium"
                    title={label}
                  >
                    {label}
                  </span>
                  <div
                    className="flex shrink-0 items-center justify-end gap-1.5 overflow-hidden"
                    style={{
                      width: `calc(${MAX_BLOCKS} * 0.5rem + ${MAX_BLOCKS - 1} * 0.125rem + 1.5rem)`,
                    }}
                  >
                    {hasBlocks ? (
                      <span
                        className="flex shrink-0 items-center gap-0.5"
                        title={blockSummary}
                        aria-label={blockSummary}
                      >
                        {(() => {
                          const totalBlocks = byQueue.reduce(
                            (sum, q) => sum + (q.count > 0 ? q.count : 0),
                            0
                          );
                          let rendered = 0;
                          const parts: React.ReactNode[] = [];
                          for (const { queueName, count: n } of byQueue) {
                            if (n <= 0 || rendered >= MAX_BLOCKS) continue;
                            const bundle = getQueueBundleForName(
                              queueName,
                              queueTypes
                            );
                            const accent =
                              queueName === "Unassigned" || !bundle
                                ? "var(--muted)"
                                : bundle.accent;
                            const toShow = Math.min(n, MAX_BLOCKS - rendered);
                            for (let i = 0; i < toShow; i++) {
                              const blockStyle: React.CSSProperties &
                                Record<string, string> = {
                                "--block-accent": accent,
                              };
                              parts.push(
                                <span
                                  key={`${queueName}-${i}`}
                                  className="inline-block size-2 rounded-[1px] bg-[var(--block-accent)] opacity-40 transition-opacity duration-200 group-focus-within:opacity-100 group-hover:opacity-100"
                                  style={blockStyle}
                                  aria-hidden
                                />
                              );
                              rendered += toShow;
                            }
                          }
                          if (totalBlocks > MAX_BLOCKS) {
                            parts.push(
                              <span
                                key="more"
                                className="text-muted-foreground text-[10px]"
                                aria-hidden
                              >
                                +{totalBlocks - MAX_BLOCKS}
                              </span>
                            );
                          }
                          return parts;
                        })()}
                      </span>
                    ) : null}
                  </div>
                  <span
                    className={`shrink-0 tabular-nums ${
                      gap
                        ? "text-amber-700 dark:text-amber-400"
                        : "text-muted-foreground"
                    }`}
                  >
                    {count} {count === 1 ? "post" : "posts"}
                  </span>
                </li>
              );
            })}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
