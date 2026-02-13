import { Check, Settings2 } from "lucide-react";

import { Card, CardContent, CardHeader } from "~/components/ui/card";

export interface ScheduleNext7DaysCardProps {
  days: Array<{ dateKey: string; count: number }>;
  targetPerDay: number;
  userTimezone?: string;
  onOpenTargetModal: () => void;
}

/**
 * Format a dateKey (YYYY-MM-DD) as short label "Thu 13" in the given timezone.
 */
function formatDayLabel(dateKey: string, timezone: string): string {
  try {
    const date = new Date(dateKey + "T12:00:00.000Z");
    return date.toLocaleDateString("en-US", {
      timeZone: timezone,
      weekday: "short",
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
}: ScheduleNext7DaysCardProps) {
  const allSet =
    targetPerDay > 0 &&
    days.length > 0 &&
    days.every((d) => d.count >= targetPerDay);

  return (
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
          {days.map(({ dateKey, count }) => {
            const gap = isGap(count, targetPerDay);
            const label = formatDayLabel(dateKey, userTimezone);
            return (
              <li
                key={dateKey}
                className={`flex min-h-[2.25rem] items-center justify-between rounded-lg border px-3 py-1.5 text-xs ${
                  gap
                    ? "border-amber-500/50 bg-amber-500/10 dark:border-amber-400/30 dark:bg-amber-500/10"
                    : "border-border/60 bg-muted/20"
                }`}
              >
                <span className="text-foreground font-medium">{label}</span>
                <span
                  className={`tabular-nums ${
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
  );
}
