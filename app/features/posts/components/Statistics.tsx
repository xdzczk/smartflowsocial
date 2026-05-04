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
  "bg-brand-strong/7 text-brand-strong/78 dark:bg-brand-strong/9 dark:text-brand-strong/72";

const SCHEDULED_ICON_WELL_CLASS =
  "bg-info/7 text-info/76 dark:bg-info/9 dark:text-info/72";

const PUBLISHED_ICON_WELL_CLASS =
  "bg-green-500/7 text-success/78 dark:bg-green-400/9 dark:text-success/75";

/** Orange/warning runway band  -  matches semantic `warning` tokens (dashboard language). */
const RUNWAY_ORANGE_ICON_WELL_CLASS =
  "bg-warning/7 text-warning/78 dark:bg-warning/9 dark:text-warning/74";

/**
 * Yellow runway band  -  chart accent (golden), distinct from warning orange on the ladder.
 */
const RUNWAY_YELLOW_ICON_WELL_CLASS =
  "bg-chart-5/8 text-chart-5/82 dark:bg-chart-5/10 dark:text-chart-5/84";

const COMPOSE_ICON_STROKE = 2.25;

export interface StatisticsProps {
  /** Runway in days until last scheduled post; null when none or in the past */
  runwayDays?: number | null;
  /** Called when the Runway card is clicked (open settings modal) */
  onRunwayClick?: () => void;
  /**
   * Max days for orange/warning KPI accent (persisted as `redThresholdDays`). Default 3.
   */
  runwayOrangeMaxDays?: number;
  /**
   * Max days for yellow KPI accent (persisted as `orangeThresholdDays`). Default 7. Should be ≥ orange max.
   */
  runwayYellowMaxDays?: number;
  /** True when onboarding is complete but no scheduled/published activity exists yet. */
  isPostActivationEmpty?: boolean;
}

const DEFAULT_RUNWAY_ORANGE_MAX_DAYS = 3;
const DEFAULT_RUNWAY_YELLOW_MAX_DAYS = 7;

export default function Statistics({
  runwayDays,
  onRunwayClick,
  runwayOrangeMaxDays = DEFAULT_RUNWAY_ORANGE_MAX_DAYS,
  runwayYellowMaxDays = DEFAULT_RUNWAY_YELLOW_MAX_DAYS,
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

  // Runway KPI: orange (warning) when ≤ orange max; yellow (chart-5) when ≤ yellow max but above orange; neutral otherwise.
  const runwayDaysNum = runwayDays ?? 0;
  const orangeMax = runwayOrangeMaxDays;
  const yellowMax = Math.max(runwayYellowMaxDays, orangeMax);
  const runwayIconClass =
    runwayDaysNum <= 0 && !hasScheduledPosts
      ? "bg-text-tertiary/10 text-text-secondary dark:bg-text-tertiary/15 dark:text-text-tertiary"
      : runwayDaysNum <= orangeMax
        ? RUNWAY_ORANGE_ICON_WELL_CLASS
        : runwayDaysNum <= yellowMax
          ? RUNWAY_YELLOW_ICON_WELL_CLASS
          : "bg-text-tertiary/10 text-text-secondary dark:bg-text-tertiary/15 dark:text-text-tertiary";

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
