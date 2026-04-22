import { useLoaderData, Link } from "@remix-run/react";
import { CalendarDays, Check, Clock, Plus } from "lucide-react";
import type { CSSProperties } from "react";

import { Card, CardContent } from "~/components/ui/card";
import type { PostStatistics } from "~/features/posts/server";
import { INLINE_ICON_STROKE } from "~/lib/icon-constants";

// KPI category palette — purple/blue/green/slate are intentionally raw decorative
// hues used to differentiate Compose/Scheduled/Published/Runway tiles. Not status
// colors. Do not migrate to --warning/--success/--info tokens.
const KPI_COLOR_CSS_VAR = "--kpi-color";

function kpiColorStyle(color: string): CSSProperties {
  const style: CSSProperties & Record<string, string> = {
    [KPI_COLOR_CSS_VAR]: color,
  };
  return style;
}

export interface StatisticsProps {
  /** Runway in days until last scheduled post; null when none or in the past */
  runwayDays?: number | null;
  /** Called when the Runway card is clicked (open settings modal) */
  onRunwayClick?: () => void;
  /** Red when runway ≤ this (default 3). */
  runwayRedThresholdDays?: number;
  /** Orange when runway ≤ this (default 7). */
  runwayOrangeThresholdDays?: number;
  /** True when onboarding is complete but no scheduled/published activity exists yet. */
  isPostActivationEmpty?: boolean;
}

const DEFAULT_RUNWAY_RED_DAYS = 3;
const DEFAULT_RUNWAY_ORANGE_DAYS = 7;

export default function Statistics({
  runwayDays,
  onRunwayClick,
  runwayRedThresholdDays: _runwayRedThresholdDays = DEFAULT_RUNWAY_RED_DAYS,
  runwayOrangeThresholdDays:
    _runwayOrangeThresholdDays = DEFAULT_RUNWAY_ORANGE_DAYS,
  isPostActivationEmpty = false,
}: StatisticsProps) {
  const { postStatistics } = useLoaderData<{
    postStatistics: PostStatistics | undefined;
  }>();

  const stats = postStatistics ?? { scheduledCount: 0, successCount: 0 };
  const hasScheduledPosts = stats.scheduledCount > 0;
  const shouldUseRunwayPlaceholder =
    isPostActivationEmpty && !hasScheduledPosts;
  const runwayLabel = shouldUseRunwayPlaceholder
    ? "—"
    : runwayDays != null && runwayDays > 0
      ? `${runwayDays} day${runwayDays !== 1 ? "s" : ""}`
      : "0 days";

  // Runway icon color: muted (0 days, no posts); muted red (< 2 days); amber (2–7 days); neutral blue (7+ days)
  const runwayDaysNum = runwayDays ?? 0;
  const runwayIconClass =
    runwayDaysNum <= 0 && !hasScheduledPosts
      ? "bg-surface-hover text-text-secondary dark:bg-surface-hover/80"
      : runwayDaysNum < 2
        ? "bg-danger/15 text-danger dark:bg-danger/20 dark:text-danger"
        : runwayDaysNum <= 7
          ? "bg-warning/10 text-warning dark:bg-warning/15 dark:text-warning"
          : "bg-slate-500/15 text-slate-600 dark:bg-slate-400/20 dark:text-slate-400";

  const cardBase = "card-lift kpi-card min-h-[72px] shadow-1 dark:shadow-none";
  const contentBase =
    "focus-ring hover:bg-surface-hover/50 flex min-h-[72px] grow items-center justify-between rounded-xl p-4 motion-fast";
  const iconBase = "flex size-12 items-center justify-center rounded-xl";
  const dtBase = "text-text text-h1 tabular-nums";
  const ddBase = "text-text-secondary/90 text-overline";

  const runwayKpiColor =
    runwayDaysNum <= 0 && !hasScheduledPosts
      ? "#64748b" /* slate */
      : runwayDaysNum < 2
        ? "#ef4444" /* red */
        : runwayDaysNum <= 7
          ? "#f59e0b" /* amber */
          : "#64748b"; /* slate */

  const scheduledCaption =
    isPostActivationEmpty && stats.scheduledCount === 0
      ? "Not started yet"
      : "Scheduled";
  const publishedCaption =
    isPostActivationEmpty && stats.successCount === 0
      ? "Nothing live yet"
      : "Published";
  const runwayCaption =
    shouldUseRunwayPlaceholder && runwayDaysNum <= 0
      ? "Schedule to build"
      : "Runway";

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-6">
      <Card className={cardBase} style={kpiColorStyle("#a855f7")}>
        <CardContent className="p-0">
          <Link
            to="/dashboard/compose?type=post"
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

      <Card className={cardBase} style={kpiColorStyle("#3b82f6")}>
        <CardContent className="p-0">
          <Link
            to="/dashboard/scheduled"
            className={contentBase}
            aria-label={`Scheduled, ${stats.scheduledCount} posts`}
          >
            <div
              className={`${iconBase} bg-info/12 text-info dark:bg-info/15 dark:text-info`}
            >
              <Clock
                className="inline-block size-6"
                strokeWidth={INLINE_ICON_STROKE}
                aria-hidden
              />
            </div>
            <dl className="space-y-0 text-right">
              <dt className={dtBase}>{stats.scheduledCount}</dt>
              <dd className={ddBase}>{scheduledCaption}</dd>
            </dl>
          </Link>
        </CardContent>
      </Card>

      <Card className={cardBase} style={kpiColorStyle("#22c55e")}>
        <CardContent className="p-0">
          <Link
            to="/dashboard/published"
            className={contentBase}
            aria-label={`Published, ${stats.successCount} posts`}
          >
            <div
              className={`${iconBase} text-success dark:text-success bg-green-500/12 dark:bg-green-400/15`}
            >
              <Check
                className="inline-block size-6"
                strokeWidth={INLINE_ICON_STROKE}
                aria-hidden
              />
            </div>
            <dl className="space-y-0 text-right">
              <dt className={dtBase}>{stats.successCount}</dt>
              <dd className={ddBase}>{publishedCaption}</dd>
            </dl>
          </Link>
        </CardContent>
      </Card>

      <Card className={cardBase} style={kpiColorStyle(runwayKpiColor)}>
        <CardContent className="p-0">
          <button
            type="button"
            onClick={onRunwayClick}
            aria-label={`Runway, ${runwayLabel}. ${shouldUseRunwayPlaceholder ? "Schedule posts to build runway." : "Configure which queues count."}`}
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
              <dd className={ddBase}>{runwayCaption}</dd>
            </dl>
          </button>
        </CardContent>
      </Card>
    </div>
  );
}
