import { Link } from "@remix-run/react";
import { Check, Settings2 } from "lucide-react";
import { useRef, useState } from "react";

import { Card, CardContent, CardHeader } from "~/components/ui/card";
import {
  getQueueColorBundle,
  type QueueColorBundle,
} from "~/features/posts/queue-colors";
import type { QueueType } from "~/features/posts/types";
import { useFormattedDate } from "~/lib/hooks/useFormattedDate";
import type { DateDisplayLocale } from "~/lib/temporal";

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
}: ScheduleNext7DaysCardProps) {
  const { dateLocale } = useFormattedDate();
  const [colorsRevealed, setColorsRevealed] = useState(false);
  const wasRevealedAtPointerDownRef = useRef(false);
  const allSet =
    targetPerDay > 0 &&
    days.length > 0 &&
    days.every((d) => d.count >= targetPerDay);

  return (
    <div
      className={`group focus-visible:ring-ring flex min-w-0 flex-1 flex-col focus:outline-none focus-visible:ring-2 focus-visible:ring-inset ${colorsRevealed ? "colors-revealed" : ""}`}
      tabIndex={0}
      role="button"
      aria-label="Next 7 days schedule"
      aria-pressed={colorsRevealed}
      onPointerDown={(e) => {
        if ((e.target as HTMLElement).closest("button, a, [role='button']"))
          return;
        wasRevealedAtPointerDownRef.current = colorsRevealed;
        if (e.pointerType !== "mouse") {
          setColorsRevealed(true);
        }
      }}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest("button, a, [role='button']"))
          return;
        if (e.detail === 0) return;
        if (wasRevealedAtPointerDownRef.current) {
          setColorsRevealed(false);
        } else {
          setColorsRevealed(true);
        }
      }}
      onKeyDown={(e) => {
        if (e.target !== e.currentTarget) return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          setColorsRevealed((v) => !v);
        }
      }}
    >
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
                <li key={dateKey} className="flex min-h-[2.25rem] flex-col">
                  <Link
                    to={calendarDayUrl}
                    className={`focus:ring-ring queue-health-row card-lift flex min-h-[2.25rem] flex-1 items-center gap-2 rounded-lg border px-3 py-1.5 text-xs transition-shadow focus:ring-2 focus:outline-none ${
                      gap
                        ? "border-amber-500/50 bg-amber-500/10 hover:bg-amber-500/20 dark:border-amber-400/30 dark:bg-amber-500/10 dark:hover:bg-amber-500/20"
                        : "border-border/60 bg-muted/20 hover:bg-muted/50"
                    }`}
                    style={
                      // CSS custom property not in React.CSSProperties; assertion required
                      /* eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- CSS custom properties require type assertion */
                      {
                        "--queue-color": "hsl(var(--primary))",
                      } as React.CSSProperties
                    }
                    title={`View ${label} in Calendar`}
                  >
                    <span
                      className="text-foreground min-w-0 shrink-0 truncate font-medium sm:min-w-[10rem]"
                      title={label}
                      style={{ maxWidth: "12rem" }}
                    >
                      {label}
                    </span>
                    <div className="min-w-0 flex-1" aria-hidden />
                    <div
                      className="flex min-w-0 shrink items-center justify-end gap-1.5 overflow-hidden"
                      style={{
                        maxWidth: `calc(${MAX_BLOCKS} * 0.5rem + ${MAX_BLOCKS - 1} * 0.125rem + 1.5rem)`,
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
                            const unassignedAccent =
                              "hsl(var(--muted-foreground) / 0.55)";
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
                            const slots: Array<{ id: number; accent: string }> =
                              [];
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
                            const parts: React.ReactNode[] = slots.map(
                              (slot) => {
                                const blockStyle: React.CSSProperties &
                                  Record<string, string> = {
                                  "--block-accent": slot.accent,
                                };
                                return (
                                  <span
                                    key={slot.id}
                                    className="inline-block size-2 rounded-[1px] bg-[var(--block-accent)] opacity-65 transition-opacity duration-200 group-focus-within:opacity-100 group-hover:opacity-100 group-active:opacity-100 [.colors-revealed_&]:opacity-100"
                                    style={blockStyle}
                                    aria-hidden
                                  />
                                );
                              }
                            );
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
                      className={`shrink-0 whitespace-nowrap tabular-nums ${
                        gap
                          ? "text-amber-700 dark:text-amber-400"
                          : "text-muted-foreground"
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
        </CardContent>
      </Card>
    </div>
  );
}
