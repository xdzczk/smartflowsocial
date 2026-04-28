import { Link } from "@remix-run/react";
import { Check, Settings2 } from "lucide-react";

import { Card, CardContent, CardHeader } from "~/components/ui/card";
import {
  DASHBOARD_PAIR_CARD_CLASS,
  DASHBOARD_PAIR_CARD_CONTENT_CLASS,
  DASHBOARD_PAIR_CARD_HEADER_CLASS,
  DASHBOARD_PAIR_HEADER_ACTION_CLASS,
} from "~/features/posts/components/dashboard-pair-card";
import {
  getQueueColorBundle,
  type QueueColorBundle,
} from "~/features/posts/queue-colors";
import type { QueueType } from "~/features/posts/types";
import { useFormattedDate } from "~/lib/hooks/useFormattedDate";
import type { DateDisplayLocale } from "~/lib/temporal";
import { cn } from "~/lib/utils";

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
  /** Queue types for resolving block colors (same as Queues panel). */
  queueTypes?: ScheduleNext7DaysQueueTypes;
  /** True when onboarding is complete but dashboard has no scheduled/published activity yet. */
  isPostActivationEmpty?: boolean;
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
function formatDayLabel(
  dateKey: string,
  timezone: string,
  dateLocale: DateDisplayLocale = "en-GB"
): string {
  try {
    const date = new Date(dateKey + "T12:00:00.000Z");
    return date.toLocaleDateString(dateLocale, {
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
  if (targetPerDay === 0) return false;
  return count < targetPerDay;
}

export function ScheduleNext7DaysCard({
  days,
  targetPerDay,
  userTimezone = "Etc/UTC",
  onOpenTargetModal,
  queueTypes,
  isPostActivationEmpty = false,
}: ScheduleNext7DaysCardProps) {
  const { dateLocale } = useFormattedDate();
  const allSet =
    targetPerDay > 0 &&
    days.length > 0 &&
    days.every((d) => d.count >= targetPerDay);

  return (
    <div className="flex w-full min-w-0 flex-col lg:min-h-0 lg:flex-1">
      <Card className={DASHBOARD_PAIR_CARD_CLASS}>
        <CardHeader className={DASHBOARD_PAIR_CARD_HEADER_CLASS}>
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <h3 className="text-overline text-text-secondary">Next 7 days</h3>
            {allSet ? (
              <span
                className="text-text-secondary cluster-tight text-xs"
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
            className={DASHBOARD_PAIR_HEADER_ACTION_CLASS}
            title="Set target per day"
            aria-label="Set target posts per day"
          >
            <Settings2 className="size-3.5" />
            <span>Target</span>
          </button>
        </CardHeader>
        <CardContent className={DASHBOARD_PAIR_CARD_CONTENT_CLASS}>
          {isPostActivationEmpty ? (
            <div className="flex flex-col justify-start gap-3 py-3 lg:min-h-0 lg:flex-1">
              <p className="text-text-secondary text-sm">
                No scheduled posts yet. Schedule your first post to start
                building your flow across the week. Your flow starts once
                content is scheduled.
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <Link
                  to="/dashboard/compose?type=post"
                  className="focus-ring bg-action-primary text-action-primary-foreground hover:bg-action-primary/90 rounded-md px-3 py-1.5 text-xs font-medium"
                >
                  Schedule first post
                </Link>
                <Link
                  to="/dashboard/compose"
                  className="focus-ring border-border-subtle text-text hover:bg-surface-hover/50 rounded-md border px-3 py-1.5 text-xs font-medium"
                >
                  Open composer
                </Link>
              </div>
            </div>
          ) : (
            <ul
              className="flex flex-col gap-1.5"
              aria-label="Scheduled posts per day for the next 7 days"
            >
              {days.map(({ dateKey, count, byQueue }) => {
                const gap = isGap(count, targetPerDay);
                const label = formatDayLabel(dateKey, userTimezone, dateLocale);
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

                const calendarDayUrl = `/dashboard/calendar?date=${encodeURIComponent(dateKey)}&view=day`;
                return (
                  <li key={dateKey} className="flex min-h-[2rem] flex-col">
                    <Link
                      to={calendarDayUrl}
                      className={`focus-ring motion-fast flex min-h-[2.25rem] flex-1 items-center gap-2 rounded-lg border px-3 py-2 text-xs ${
                        gap
                          ? "border-warning/45 bg-warning/9 hover:border-warning/55 hover:bg-warning/12 dark:border-warning/35 dark:bg-warning/10 dark:hover:border-warning/42 dark:hover:bg-warning/13"
                          : "border-border-subtle/80 bg-surface-hover/38 hover:border-border-subtle hover:bg-surface-hover/52 dark:bg-surface-hover/18 dark:hover:bg-surface-hover/26"
                      }`}
                      title={`View ${label} in Calendar`}
                    >
                      <span
                        className="text-text min-w-0 shrink-0 truncate font-medium sm:min-w-[10rem]"
                        title={label}
                        style={{ maxWidth: "12rem" }}
                      >
                        {label}
                      </span>
                      <div className="min-w-0 flex-1" aria-hidden />
                      <div className="flex min-w-0 shrink-0 items-center justify-end gap-2 overflow-hidden">
                        {hasBlocks ? (
                          <span
                            className="flex min-w-0 shrink-0 items-center gap-2"
                            title={blockSummary}
                            aria-label={blockSummary}
                          >
                            {(() => {
                              const totalBlocks = byQueue.reduce(
                                (sum, q) => sum + (q.count > 0 ? q.count : 0),
                                0
                              );
                              const unassignedAccent =
                                "hsl(var(--text-secondary) / 0.45)";
                              const queuesWithCount = byQueue
                                .filter((q) => q.count > 0)
                                .map((q) => {
                                  const bundle = getQueueBundleForName(
                                    q.queueName,
                                    queueTypes
                                  );
                                  const accent =
                                    q.queueName === "Unassigned" || !bundle
                                      ? unassignedAccent
                                      : bundle.accent;
                                  return {
                                    queueName: q.queueName,
                                    count: q.count,
                                    accent,
                                  };
                                });
                              const slots: Array<{
                                id: number;
                                accent: string;
                              }> = [];
                              let slotId = 0;
                              const remaining = queuesWithCount.map(
                                (q) => q.count
                              );
                              for (let i = 0; i < MAX_BLOCKS; i++) {
                                let j = i % queuesWithCount.length;
                                let tried = 0;
                                while (tried < queuesWithCount.length) {
                                  const count = remaining[j];
                                  const queue = queuesWithCount[j];
                                  if (
                                    typeof count === "number" &&
                                    count > 0 &&
                                    queue
                                  ) {
                                    slots.push({
                                      id: slotId++,
                                      accent: queue.accent,
                                    });
                                    remaining[j] = count - 1;
                                    break;
                                  }
                                  j = (j + 1) % queuesWithCount.length;
                                  tried += 1;
                                }
                              }
                              const n = slots.length;
                              /** Same visual density as legacy discrete blocks: 0.5rem per post (cap {@link MAX_BLOCKS}). */
                              const barWidthRem = n * 0.5;
                              const bar = (
                                <span
                                  className="ring-border-subtle/25 inline-flex h-2 shrink-0 overflow-hidden rounded-[3px] ring-1"
                                  style={{ width: `${barWidthRem}rem` }}
                                  aria-hidden
                                >
                                  {slots.map((slot, idx) => {
                                    const blockStyle: React.CSSProperties &
                                      Record<string, string> = {
                                      "--block-accent": slot.accent,
                                    };
                                    return (
                                      <span
                                        key={slot.id}
                                        className={cn(
                                          "h-full min-w-0 flex-1 bg-[var(--block-accent)] opacity-[0.92]",
                                          n === 1 && "rounded-[2px]",
                                          n > 1 &&
                                            idx === 0 &&
                                            "rounded-l-[2px]",
                                          n > 1 &&
                                            idx === n - 1 &&
                                            "rounded-r-[2px]"
                                        )}
                                        style={blockStyle}
                                      />
                                    );
                                  })}
                                </span>
                              );
                              const more =
                                totalBlocks > MAX_BLOCKS ? (
                                  <span
                                    className="text-text-secondary shrink-0 text-[10px] tabular-nums"
                                    aria-hidden
                                  >
                                    +{totalBlocks - MAX_BLOCKS}
                                  </span>
                                ) : null;
                              return (
                                <>
                                  {bar}
                                  {more}
                                </>
                              );
                            })()}
                          </span>
                        ) : null}
                      </div>
                      <span
                        className={`shrink-0 whitespace-nowrap tabular-nums ${
                          gap ? "text-warning-text" : "text-text-secondary"
                        }`}
                        style={{ minWidth: "4rem" }}
                      >
                        {count} {count === 1 ? "post" : "posts"}
                      </span>
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
