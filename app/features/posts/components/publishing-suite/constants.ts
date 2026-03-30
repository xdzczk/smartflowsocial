/** Match `RailSegmentedTabGroup` / composer rail segmented height. */
export const PUBLISHING_SEGMENTED_ROW_H = "h-10";

/** Shared with `content-helpers` post-kind badges for suite consistency. */
export const PUBLISHING_CONTENT_KIND_BADGE_CLASS =
  "inline-flex shrink-0 rounded-full bg-muted px-2 py-1 text-xs font-medium text-foreground dark:text-foreground";

/** Outer layout for Drafts, Templates, Scheduled, Published, Recyclables. */
export const PUBLISHING_LIBRARY_SHELL_CLASS =
  "mx-auto flex min-h-screen w-full max-w-[1400px] flex-col px-4 pb-8 sm:px-6";

/** Table/list surface inside library pages. */
export const PUBLISHING_LIST_SURFACE_CLASS =
  "border-border bg-card min-w-full overflow-x-auto rounded-xl border";

/** Batch selection bar: same radius family as list surfaces; calm, inline (not sticky). */
export const PUBLISHING_BATCH_SELECTION_BAR_CLASS =
  "border-border bg-muted/30 text-foreground animate-in fade-in-0 duration-150 mb-4 flex w-full max-w-full flex-col gap-3 rounded-xl border px-4 py-3 sm:flex-row sm:items-center sm:justify-between";

/** Gap between adjacent metadata chips in a row. */
export const PUBLISHING_METADATA_CHIP_GAP_CLASS = "gap-1.5";

/** Unassigned / no queue — intentional neutral, same footprint as assigned queue chips. */
export const PUBLISHING_QUEUE_NEUTRAL_CHIP_CLASS =
  "inline-flex max-w-[12rem] truncate rounded-full border border-border/60 bg-muted/25 px-2 py-1 text-xs font-medium text-muted-foreground";

/** Interactive data row hover (tables). */
export const PUBLISHING_TABLE_ROW_CLASS =
  "group border-border cursor-pointer border-b transition-colors last:border-b-0 hover:bg-muted/35";

/** Emphasized datetime cells (Scheduled / Published tables). */
export const PUBLISHING_DATETIME_CELL_CLASS =
  "text-foreground min-w-[9rem] font-semibold tabular-nums";

/** Shared sort / queue filter trigger (h-9, bordered). */
export const PUBLISHING_FILTER_SELECT_TRIGGER_CLASS =
  "border-border h-9 w-full min-w-[10rem] sm:w-[14rem]";

/** Templates type filter: slightly wider min width (combine with PUBLISHING_FILTER_SELECT_TRIGGER_CLASS). */
export const PUBLISHING_TEMPLATE_TYPE_SELECT_TRIGGER_CLASS =
  "min-w-[12rem] sm:min-w-[16rem]";
