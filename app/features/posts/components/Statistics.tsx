import { useLoaderData, Link } from "@remix-run/react";

import { Card, CardContent } from "~/components/ui/card";
import type { PostStatistics } from "~/models/post.types";

export interface StatisticsProps {
  /** Runway in days until last scheduled post; null when none or in the past */
  runwayDays?: number | null;
  /** Called when the Runway card is clicked (open settings modal) */
  onRunwayClick?: () => void;
  /** Red when runway ≤ this (default 3). */
  runwayRedThresholdDays?: number;
  /** Orange when runway ≤ this (default 7). */
  runwayOrangeThresholdDays?: number;
}

const DEFAULT_RUNWAY_RED_DAYS = 3;
const DEFAULT_RUNWAY_ORANGE_DAYS = 7;

export default function Statistics({
  runwayDays,
  onRunwayClick,
  runwayRedThresholdDays: _runwayRedThresholdDays = DEFAULT_RUNWAY_RED_DAYS,
  runwayOrangeThresholdDays:
    _runwayOrangeThresholdDays = DEFAULT_RUNWAY_ORANGE_DAYS,
}: StatisticsProps) {
  const { postStatistics } = useLoaderData<{
    postStatistics: PostStatistics | undefined;
  }>();

  const stats = postStatistics ?? { scheduledCount: 0, successCount: 0 };
  const runwayLabel =
    runwayDays != null && runwayDays > 0
      ? `${runwayDays} day${runwayDays !== 1 ? "s" : ""}`
      : "0 days";

  // Runway icon color: muted (0 days, no posts); muted red (< 2 days); amber (2–7 days); neutral blue (7+ days)
  const runwayDaysNum = runwayDays ?? 0;
  const hasScheduledPosts = stats.scheduledCount > 0;
  const runwayIconClass =
    runwayDaysNum <= 0 && !hasScheduledPosts
      ? "bg-muted text-muted-foreground dark:bg-muted/80"
      : runwayDaysNum < 2
        ? "bg-red-400/15 text-red-600 dark:bg-red-400/20 dark:text-red-400"
        : runwayDaysNum <= 7
          ? "bg-amber-500/10 text-amber-600 dark:bg-amber-400/15 dark:text-amber-400"
          : "bg-slate-500/15 text-slate-600 dark:bg-slate-400/20 dark:text-slate-400";

  const cardBase = "card-lift min-h-[72px] shadow-sm dark:shadow-none";
  const contentBase =
    "hover:bg-muted/50 flex min-h-[72px] grow items-center justify-between rounded-xl p-4 transition-colors focus:outline-none focus:ring-2 focus:ring-primary";
  const iconBase = "flex size-12 items-center justify-center rounded-xl";
  const dtBase = "text-foreground text-2xl font-bold tabular-nums";
  const ddBase =
    "text-muted-foreground/90 text-[11px] font-medium uppercase tracking-tight leading-snug";

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-6">
      <Card className={cardBase}>
        <CardContent className="p-0">
          <Link
            to="/dashboard/newpost"
            className={contentBase}
            aria-label="Compose, Add to Flow"
          >
            <div
              className={`${iconBase} bg-purple-500/12 text-purple-600 dark:bg-purple-400/15 dark:text-purple-400`}
            >
              <svg
                className="hi-solid hi-plus-circle inline-block size-6"
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25zM12.75 9a.75.75 0 00-1.5 0v2.25H9a.75.75 0 000 1.5h2.25V15a.75.75 0 001.5 0v-2.25H15a.75.75 0 000-1.5h-2.25V9z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <dl className="space-y-0 text-right">
              <dt className={dtBase}>Compose</dt>
              <dd className={ddBase}>Add to Flow</dd>
            </dl>
          </Link>
        </CardContent>
      </Card>

      <Card className={cardBase}>
        <CardContent className="p-0">
          <Link
            to="/dashboard/scheduled"
            className={contentBase}
            aria-label={`Scheduled, ${stats.scheduledCount} posts`}
          >
            <div
              className={`${iconBase} bg-blue-400/12 text-blue-600 dark:bg-blue-400/15 dark:text-blue-400`}
            >
              <svg
                className="hi-solid hi-clock inline-block size-6"
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25zM12.75 6a.75.75 0 00-1.5 0v6c0 .414.336.75.75.75h4.5a.75.75 0 000-1.5h-3.75V6z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <dl className="space-y-0 text-right">
              <dt className={dtBase}>{stats.scheduledCount}</dt>
              <dd className={ddBase}>Scheduled</dd>
            </dl>
          </Link>
        </CardContent>
      </Card>

      <Card className={cardBase}>
        <CardContent className="p-0">
          <Link
            to="/dashboard/posted"
            className={contentBase}
            aria-label={`Published, ${stats.successCount} posts`}
          >
            <div
              className={`${iconBase} bg-green-500/12 text-green-600 dark:bg-green-400/15 dark:text-green-400`}
            >
              <svg
                className="hi-solid hi-check-circle inline-block size-6"
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12zm13.36-1.814a.75.75 0 10-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.14-.094l3.75-5.25z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <dl className="space-y-0 text-right">
              <dt className={dtBase}>{stats.successCount}</dt>
              <dd className={ddBase}>Published</dd>
            </dl>
          </Link>
        </CardContent>
      </Card>

      <Card className={cardBase}>
        <CardContent className="p-0">
          <button
            type="button"
            onClick={onRunwayClick}
            aria-label={`Runway, ${runwayLabel}. Configure which queues count.`}
            className={`${contentBase} w-full cursor-pointer text-left`}
          >
            <div className={`${iconBase} ${runwayIconClass}`}>
              <svg
                className="hi-solid hi-calendar-days inline-block size-6"
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M6.75 2.25A.75.75 0 017.5 3v1.5h9V3A.75.75 0 0118 3v1.5h.75a3 3 0 013 3v11.25a3 3 0 01-3 3H5.25a3 3 0 01-3-3V7.5a3 3 0 013-3H6V3a.75.75 0 01.75-.75zm13.5 9a1.5 1.5 0 00-1.5-1.5H5.25a1.5 1.5 0 00-1.5 1.5v7.5a1.5 1.5 0 001.5 1.5h13.5a1.5 1.5 0 001.5-1.5v-7.5z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <dl className="space-y-0 text-right">
              <dt className={dtBase}>{runwayLabel}</dt>
              <dd className={ddBase}>Runway</dd>
            </dl>
          </button>
        </CardContent>
      </Card>
    </div>
  );
}
