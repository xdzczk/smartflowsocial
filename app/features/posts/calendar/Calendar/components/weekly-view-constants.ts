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

/**
 * Calendar layering invariant:
 * Keep all Calendar z-index values below app modal/popover baseline z-50.
 */

/** Row z-index baseline (kept low so row stacking stays below indicator/modals). */
export const CALENDAR_ROW_Z_BASE = 0;
/** Hovered bottom-row expand-up content must render above all regular row layers. */
export const CALENDAR_ROW_Z_EXPANDED_UP = 40;
/** Hovered slot cell wrapper should sit above base row layers. */
export const CALENDAR_HOVERED_CELL_Z = 20;
/** Current-time indicator must render above all row layers. */
export const CURRENT_TIME_INDICATOR_Z = 45;
/** Shared overlay layer for expanded hover blocks in Week/Day views. */
export const CALENDAR_HOVER_OVERLAY_Z = 46;
/** Sticky layers for weekly headers/rails (above hover overlay so day strip is never covered). */
export const CALENDAR_DAYS_HEADER_Z = 47;
export const CALENDAR_DAYS_HEADER_TIME_SPACER_Z = 48;
/**
 * Single sticky time-rail overlay rendered in TimeGrid ABOVE the
 * rows-wrapper stacking context (TIME_GRID_ROWS_LAYER_Z = 1).
 * Must be > rows-wrapper but well below the hover overlay (46) and
 * DaysHeader (47) so those elements are never covered.
 */
export const CALENDAR_TIME_RAIL_OVERLAY_Z = 2;
/** @deprecated kept only for DayViewTwoColumnGrid; WeeklyView uses CALENDAR_TIME_RAIL_OVERLAY_Z */
export const CALENDAR_TIME_RAIL_STICKY_Z = 22;
export const CALENDAR_MOBILE_HEADER_Z = 23;
/** Post block wrapper z-levels inside local cell contexts. */
export const CALENDAR_BLOCK_BASE_Z = 0;
export const CALENDAR_BLOCK_EXPANDED_Z = 10;
export const CALENDAR_BLOCK_MULTI_HOVER_Z = 20;
/** Week/day time-grid shared layers. */
export const TIME_GRID_LINES_Z = 0;
export const TIME_GRID_ROWS_LAYER_Z = 1;
export const TIME_GRID_ROW_CONTENT_Z = 1;

/** Day view layer stack inside grid content area. */
export const DAY_VIEW_GRID_LINES_Z = 0;
/** Multi-post rows should be interactive above single-post layer. */
export const DAY_VIEW_SINGLE_POSTS_Z = 2;
export const DAY_VIEW_MULTI_POSTS_Z = 3;
export const DAY_VIEW_DROP_LAYER_Z = 4;
export const DAY_VIEW_POST_BLOCK_CONTAINER_Z = 10;

/** Class for expanded post block wrapper: fully opaque and on top so grid/content behind don't show through. */
export const EXPANDED_BLOCK_WRAPPER_CLASS =
  "opacity-100 overflow-hidden bg-[hsl(var(--calendar-surface-2-bg))] rounded-[var(--calendar-radius-md)] shadow-1";

/** Day/week grid: selected post in sidebar  -  purple ring only here (not grid chrome). */
export const CALENDAR_SELECTED_POST_RING =
  "ring-2 ring-inset ring-brand-strong";

export const CLASS_OVERFLOW_HIDDEN = "overflow-hidden";
export const CLASS_DAY_COLUMN_EXPAND_UP =
  "overflow-x-hidden overflow-y-visible";

/** Bottom time rows: expand blocks upward (row index >= this; 45 = 22:30–23:30). */
export const BOTTOM_ROWS_EXPAND_UP_THRESHOLD = 45;
/** First row index where we stack row above on top of row below (same as expand-up zone). */
export const BOTTOM_ROWS_STACK_ABOVE_THRESHOLD = 45;

export const EMPTY_SLOT_ICON_CLASS = "size-4 shrink-0 opacity-50";
