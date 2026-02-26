/**
 * Constants and layout values for WeeklyView / Day view time grid.
 */

import { ROW_HEIGHT_PX } from "../domain/slot-state";

export { ROW_HEIGHT_PX };

/** Default scroll: show 6:00 at top (Apple Calendar–style). */
export const DEFAULT_SCROLL_HOUR = 6;

/** Full day range: 00:00–23:30 (24 hours × 2 slots). */
export const HOURS_PER_DAY = 24;
/** Number of half-hour slots in the time grid (must match hours.length). */
export const TOTAL_TIME_SLOTS = HOURS_PER_DAY * 2;

/** Week view: min width so horizontal scroll works on narrow screens. */
export const WEEK_VIEW_MIN_WIDTH = "28.5rem";
export const MOBILE_WEEK_DAY_COLUMN_WIDTH = "calc((100vw - 4rem) / 3)";
export const MOBILE_WEEK_GRID_MIN_WIDTH =
  "calc(4rem + 7 * ((100vw - 4rem) / 3))";

/** Row z-index (below Dialog z-50). */
export const CALENDAR_ROW_Z_BASE = 39;
/** Hovered bottom-row expand-up content must render above all regular row layers. */
export const CALENDAR_ROW_Z_EXPANDED_UP = 200;
/** Hovered slot cell wrapper should sit above base row layers. */
export const CALENDAR_HOVERED_CELL_Z = 40;
/** Current-time indicator must render above all row layers. */
export const CURRENT_TIME_INDICATOR_Z = 210;
/** Week/day time-grid shared layers. */
export const TIME_GRID_LINES_Z = 0;
export const TIME_GRID_ROWS_LAYER_Z = 1;
export const TIME_GRID_ROW_CONTENT_Z = 1;

/** Day view layer stack inside grid content area. */
export const DAY_VIEW_GRID_LINES_Z = 0;
/** Single-post blocks should render above multi-post rows (day-view expand rules). */
export const DAY_VIEW_SINGLE_POSTS_Z = 2;
export const DAY_VIEW_MULTI_POSTS_Z = 1;
export const DAY_VIEW_DROP_LAYER_Z = 3;
export const DAY_VIEW_POST_BLOCK_CONTAINER_Z = 10;

/** Class for expanded post block wrapper: fully opaque and on top so grid/content behind don't show through. */
export const EXPANDED_BLOCK_WRAPPER_CLASS =
  "z-10 opacity-100 bg-[hsl(var(--calendar-surface-2-bg))] rounded-[var(--calendar-radius-md)] shadow-sm";

export const CLASS_OVERFLOW_HIDDEN = "overflow-hidden";
export const CLASS_DAY_COLUMN_EXPAND_UP =
  "overflow-x-hidden overflow-y-visible";

/** Bottom time rows: expand blocks upward (row index >= this; 45 = 22:30–23:30). */
export const BOTTOM_ROWS_EXPAND_UP_THRESHOLD = 45;
/** First row index where we stack row above on top of row below (same as expand-up zone). */
export const BOTTOM_ROWS_STACK_ABOVE_THRESHOLD = 45;

export const EMPTY_SLOT_ICON_CLASS = "size-4 shrink-0 opacity-50";
