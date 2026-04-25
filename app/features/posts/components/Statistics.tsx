import { useLoaderData, Link } from "@remix-run/react";
import { CalendarDays, Check, Clock, Plus } from "lucide-react";

import { Card, CardContent } from "~/components/ui/card";
import type { PostStatistics } from "~/features/posts/server";
import { INLINE_ICON_STROKE } from "~/lib/icon-constants";
import { cn } from "~/lib/utils";

/** ~10–12% smaller than size-6 (24px); keeps tiles calm vs. oversized glyphs. */
const KPI_ICON_CLASS = "inline-block size-[1.35rem] sm:size-[1.4rem]";

// Category hues kept for scanability; fills and glyphs are ~half the old opacity so tiles stay calm.
const COMPOSE_ICON_WELL_CLASS =
  "bg-purple-500/7 text-purple-600/78 dark:bg-purple-400/9 dark:text-purple-400/72";

const SCHEDULED_ICON_WELL_CLASS =
  "bg-info/7 text-info/76 dark:bg-info/9 dark:text-info/72";

const PUBLISHED_ICON_WELL_CLASS =
  "bg-green-500/7 text-success/78 dark:bg-green-400/9 dark:text-success/75";

const COMPOSE_ICON_STROKE = 2.25;

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

  // Runway: same hue language as before, with lighter wells and softened icon contrast.
  const runwayDaysNum = runwayDays ?? 0;
  const runwayIconClass =
    runwayDaysNum <= 0 && !hasScheduledPosts
      ? "bg-slate-500/7 text-slate-600/72 dark:bg-slate-400/9 dark:text-slate-400/68"
      : runwayDaysNum < 2
        ? "bg-danger/7 text-danger/76 dark:bg-danger/9 dark:text-danger/72"
        : runwayDaysNum <= 7
          ? "bg-warning/7 text-warning/78 dark:bg-warning/9 dark:text-warning/74"
          : "bg-slate-500/7 text-slate-600/72 dark:bg-slate-400/9 dark:text-slate-400/68";

  const cardBase =
    "card-lift kpi-card border-border-subtle/80 min-h-[80px] overflow-hidden shadow-1";
  const contentBase =
    "focus-ring flex min-h-[80px] grow items-center justify-between gap-4 rounded-lg border border-transparent px-4 py-4 motion-fast hover:border-border-subtle hover:bg-surface-hover/35 sm:px-5";
  const composeContentClass = cn(contentBase, "gap-5");
  const iconBase =
    "flex size-10 shrink-0 items-center justify-center rounded-lg sm:size-11";
  const valueStackBase = "min-w-0 space-y-1 text-right";
  const dtNumericBase =
    "text-text text-[1.375rem] leading-none font-semibold tracking-tight tabular-nums sm:text-[1.5rem]";
  /** Compose: slightly larger + heavier so it leads the row (tile hue matches others’ muted level). */
  const dtComposeBase =
    "text-text text-[1.5rem] leading-none font-bold tracking-tight sm:text-[1.625rem]";
  const ddBase =
    "text-text-tertiary text-[11px] font-medium uppercase tracking-wider leading-snug";

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
      <Card className={cardBase}>
        <CardContent className="p-0">
          <Link
            to="/dashboard/compose?type=post"
            className={composeContentClass}
            aria-label="Compose, Add to Flow"
          >
            <div className={cn(iconBase, COMPOSE_ICON_WELL_CLASS)}>
              <Plus
                className={KPI_ICON_CLASS}
                strokeWidth={COMPOSE_ICON_STROKE}
                aria-hidden
              />
            </div>
            <dl className={valueStackBase}>
              <dt className={dtComposeBase}>Compose</dt>
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
            <div className={cn(iconBase, SCHEDULED_ICON_WELL_CLASS)}>
              <Clock
                className={KPI_ICON_CLASS}
                strokeWidth={INLINE_ICON_STROKE}
                aria-hidden
              />
            </div>
            <dl className={valueStackBase}>
              <dt className={dtNumericBase}>{stats.scheduledCount}</dt>
              <dd className={ddBase}>{scheduledCaption}</dd>
            </dl>
          </Link>
        </CardContent>
      </Card>

      <Card className={cardBase}>
        <CardContent className="p-0">
          <Link
            to="/dashboard/published"
            className={contentBase}
            aria-label={`Published, ${stats.successCount} posts`}
          >
            <div className={cn(iconBase, PUBLISHED_ICON_WELL_CLASS)}>
              <Check
                className={KPI_ICON_CLASS}
                strokeWidth={INLINE_ICON_STROKE}
                aria-hidden
              />
            </div>
            <dl className={valueStackBase}>
              <dt className={dtNumericBase}>{stats.successCount}</dt>
              <dd className={ddBase}>{publishedCaption}</dd>
            </dl>
          </Link>
        </CardContent>
      </Card>

      <Card className={cardBase}>
        <CardContent className="p-0">
          <button
            type="button"
            onClick={onRunwayClick}
            aria-label={`Runway, ${runwayLabel}. ${shouldUseRunwayPlaceholder ? "Schedule posts to build runway." : "Configure which queues count."}`}
            className={`${contentBase} w-full cursor-pointer text-left`}
          >
            <div className={cn(iconBase, runwayIconClass)}>
              <CalendarDays
                className={KPI_ICON_CLASS}
                strokeWidth={INLINE_ICON_STROKE}
                aria-hidden
              />
            </div>
            <dl className={valueStackBase}>
              <dt className={dtNumericBase}>{runwayLabel}</dt>
              <dd className={ddBase}>{runwayCaption}</dd>
            </dl>
          </button>
        </CardContent>
      </Card>
    </div>
  );
}
