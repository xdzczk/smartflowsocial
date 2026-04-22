/** Match `RailSegmentedTabGroup` / composer rail segmented height. */
export const PUBLISHING_SEGMENTED_ROW_H = "h-10";

/**
 * Unified filter control system (Scheduled / Published top toolbar).
 * Use these tokens for dropdown triggers, date fields, and future toolbar controls.
 */
export const PUBLISHING_FILTER_CONTROL_H = "h-9";
export const PUBLISHING_FILTER_CONTROL_RADIUS = "rounded-lg";
export const PUBLISHING_FILTER_CONTROL_BASE_CLASS =
  "border-border/60 bg-canvas text-text shadow-none focus-visible:ring-focus-ring focus-visible:ring-2 focus-visible:ring-offset-0 disabled:opacity-50 disabled:cursor-not-allowed";

/** Width tokens: type + queue should match; From/To should match. */
export const PUBLISHING_FILTER_WIDTH_STANDARD =
  "w-full min-w-[10rem] sm:w-[14rem]";
export const PUBLISHING_FILTER_WIDTH_DATE = "w-full min-w-[9rem] sm:w-[12rem]";

/** Shared with `content-helpers` post-kind badges for suite consistency. */
export const PUBLISHING_CONTENT_KIND_BADGE_CLASS =
  "inline-flex shrink-0 rounded-full bg-surface-hover px-2 py-1 text-xs font-medium text-text dark:text-text";

/** Outer layout for Drafts, Templates, Scheduled, Published, Recyclables. */
export const PUBLISHING_LIBRARY_SHELL_CLASS =
  "mx-auto flex min-h-screen w-full max-w-[1400px] flex-col px-4 pb-8 sm:px-6";

/** Table/list surface inside library pages. */
export const PUBLISHING_LIST_SURFACE_CLASS =
  "border-border bg-surface min-w-full overflow-x-auto rounded-xl border";

/** Batch selection bar: same radius family as list surfaces; calm, inline (not sticky). */
export const PUBLISHING_BATCH_SELECTION_BAR_CLASS =
  "border-border bg-surface-hover/30 text-text animate-in fade-in-0 duration-150 mb-4 flex w-full max-w-full flex-col gap-3 rounded-xl border px-4 py-3 sm:flex-row sm:items-center sm:justify-between";

/** Gap between adjacent metadata chips in a row. */
export const PUBLISHING_METADATA_CHIP_GAP_CLASS = "gap-1.5";

/** Unassigned / no queue — intentional neutral, same footprint as assigned queue chips. */
export const PUBLISHING_QUEUE_NEUTRAL_CHIP_CLASS =
  "inline-flex max-w-[12rem] truncate rounded-full border border-border/60 bg-surface-hover/25 px-2 py-1 text-xs font-medium text-text-secondary";

/** Interactive data row hover (tables). */
export const PUBLISHING_TABLE_ROW_CLASS =
  "group border-border cursor-pointer border-b transition-colors last:border-b-0 hover:bg-surface-hover/35";

/** Emphasized datetime cells (Scheduled / Published tables). */
export const PUBLISHING_DATETIME_CELL_CLASS =
  "text-text min-w-[9rem] font-semibold tabular-nums";

/**
 * Shared sort / queue / type filter trigger.
 * Prefer combining the unified tokens above (height/radius/base/width) in new code.
 */
export const PUBLISHING_FILTER_SELECT_TRIGGER_CLASS = `border-border ${PUBLISHING_FILTER_CONTROL_H} ${PUBLISHING_FILTER_CONTROL_RADIUS} ${PUBLISHING_FILTER_CONTROL_BASE_CLASS} ${PUBLISHING_FILTER_WIDTH_STANDARD}`;

/** Templates type filter: slightly wider min width (combine with PUBLISHING_FILTER_SELECT_TRIGGER_CLASS). */
export const PUBLISHING_TEMPLATE_TYPE_SELECT_TRIGGER_CLASS =
  "min-w-[12rem] sm:min-w-[16rem]";
