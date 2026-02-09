import { useLoaderData, Link } from "@remix-run/react";
import { CalendarDays, Check, Clock, Plus } from "lucide-react";

import { Card, CardContent } from "~/components/ui/card";
import { INLINE_ICON_STROKE } from "~/lib/icon-constants";
import type { PostStatistics } from "~/models/post.types";

const KPI_COLOR_CSS_VAR = "--kpi-color";

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

  const cardBase = "card-lift kpi-card min-h-[72px] shadow-sm dark:shadow-none";
  const contentBase =
    "hover:bg-muted/50 flex min-h-[72px] grow items-center justify-between rounded-xl p-4 transition-colors focus:outline-none focus:ring-2 focus:ring-ring";
  const iconBase = "flex size-12 items-center justify-center rounded-xl";
  const dtBase = "text-foreground text-2xl font-bold tabular-nums";
  const ddBase =
    "text-muted-foreground/90 text-[11px] font-medium uppercase tracking-tight leading-snug";

  const runwayKpiColor =
    runwayDaysNum <= 0 && !hasScheduledPosts
      ? "#64748b" /* slate */
      : runwayDaysNum < 2
        ? "#ef4444" /* red */
        : runwayDaysNum <= 7
          ? "#f59e0b" /* amber */
          : "#64748b"; /* slate */

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-6">
      <Card className={cardBase} style={{ [KPI_COLOR_CSS_VAR]: "#a855f7" }}>
        <CardContent className="p-0">
          <Link
            to="/dashboard/newpost"
            className={contentBase}
            aria-label="Compose, Add to Flow"
          >
            <div
              className={`${iconBase} bg-purple-500/12 text-purple-600 dark:bg-purple-400/15 dark:text-purple-400`}
            >
              <Plus
                className="inline-block size-6"
                strokeWidth={INLINE_ICON_STROKE}
                aria-hidden
              />
            </div>
            <dl className="space-y-0 text-right">
              <dt className={dtBase}>Compose</dt>
              <dd className={ddBase}>Add to Flow</dd>
            </dl>
          </Link>
        </CardContent>
      </Card>

      <Card className={cardBase} style={{ [KPI_COLOR_CSS_VAR]: "#3b82f6" }}>
        <CardContent className="p-0">
          <Link
            to="/dashboard/scheduled"
            className={contentBase}
            aria-label={`Scheduled, ${stats.scheduledCount} posts`}
          >
            <div
              className={`${iconBase} bg-blue-400/12 text-blue-600 dark:bg-blue-400/15 dark:text-blue-400`}
            >
              <Clock
                className="inline-block size-6"
                strokeWidth={INLINE_ICON_STROKE}
                aria-hidden
              />
            </div>
            <dl className="space-y-0 text-right">
              <dt className={dtBase}>{stats.scheduledCount}</dt>
              <dd className={ddBase}>Scheduled</dd>
            </dl>
          </Link>
        </CardContent>
      </Card>

      <Card className={cardBase} style={{ [KPI_COLOR_CSS_VAR]: "#22c55e" }}>
        <CardContent className="p-0">
          <Link
            to="/dashboard/published"
            className={contentBase}
            aria-label={`Published, ${stats.successCount} posts`}
          >
            <div
              className={`${iconBase} bg-green-500/12 text-green-600 dark:bg-green-400/15 dark:text-green-400`}
            >
              <Check
                className="inline-block size-6"
                strokeWidth={INLINE_ICON_STROKE}
                aria-hidden
              />
            </div>
            <dl className="space-y-0 text-right">
              <dt className={dtBase}>{stats.successCount}</dt>
              <dd className={ddBase}>Published</dd>
            </dl>
          </Link>
        </CardContent>
      </Card>

      <Card
        className={cardBase}
        style={{ [KPI_COLOR_CSS_VAR]: runwayKpiColor }}
      >
        <CardContent className="p-0">
          <button
            type="button"
            onClick={onRunwayClick}
            aria-label={`Runway, ${runwayLabel}. Configure which queues count.`}
            className={`${contentBase} w-full cursor-pointer text-left`}
          >
            <div className={`${iconBase} ${runwayIconClass}`}>
              <CalendarDays
                className="inline-block size-6"
                strokeWidth={INLINE_ICON_STROKE}
                aria-hidden
              />
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
