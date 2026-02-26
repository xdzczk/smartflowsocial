/**
 * Pure expand rules for time grid slots (day vs week view).
 */

import type { PostsGrid } from "./grid-types";

/** Day view: 1-2 posts → up to 7 rows (max 6 empty below); 3-4 → up to 5 rows (max 4 below); 5+ → up to 3 rows (max 2 below). */
export function getDayViewMaxExpand(postsCount: number): number {
  if (postsCount <= 0) return 0;
  if (postsCount <= 2) return 6;
  if (postsCount <= 4) return 4;
  return 2;
}

/** Week view: 1 post → up to 4 rows (max 3 empty below); 2 posts → up to 3 rows (max 2 below); 3-4 → up to 2 rows (max 1 below). */
export function getWeekViewMaxExpand(postsCount: number): number {
  if (postsCount <= 0) return 0;
  if (postsCount === 1) return 3;
  if (postsCount <= 2) return 2;
  if (postsCount <= 4) return 1;
  return 0;
}

/** Number of empty slots below to fill. Counts consecutive empty slots for the same date. */
export function getExpandDown(
  dateKey: string,
  timeSlot: string,
  postsGrid: PostsGrid,
  hours: string[],
  maxEmptySlots: number
): number {
  const idx = hours.indexOf(timeSlot);
  if (idx < 0 || idx >= hours.length - 1) return 0;
  let count = 0;
  for (let i = 1; i <= maxEmptySlots && idx + i < hours.length; i++) {
    const nextSlot = hours[idx + i];
    if (nextSlot === undefined) break;
    if ((postsGrid[dateKey]?.[nextSlot]?.length ?? 0) > 0) break;
    count = i;
  }
  return count;
}

/** Day view: expand down until a conflicting slot appears (same-column single post or any multi-post row). */
export function getExpandDownDayView(
  dateKey: string,
  timeSlot: string,
  postsGrid: PostsGrid,
  hours: string[],
  maxEmptySlots: number,
  myColumn: 0 | 1,
  dayViewColumnMap: Record<string, 0 | 1>
): number {
  const idx = hours.indexOf(timeSlot);
  if (idx < 0 || idx >= hours.length - 1) return 0;
  let count = 0;
  for (let i = 1; i <= maxEmptySlots && idx + i < hours.length; i++) {
    const nextSlot = hours[idx + i];
    if (nextSlot === undefined) break;
    const slotKeyBelow = `${dateKey}-${nextSlot}`;
    const postsBelow = postsGrid[dateKey]?.[nextSlot] ?? [];
    const colBelow = dayViewColumnMap[slotKeyBelow];
    const hasSinglePostInMyColumn =
      postsBelow.length === 1 && colBelow === myColumn;
    const hasMultiPostConflict = postsBelow.length >= 2;
    if (hasSinglePostInMyColumn || hasMultiPostConflict) break;
    count = i;
  }
  return count;
}

/** True when this slot's block spans baseRows and the next slot below it (same date) has posts. */
export function hasBlocksUnderneath(
  dateKey: string,
  time: string,
  baseRows: number,
  postsGrid: PostsGrid,
  hours: string[]
): boolean {
  const idx = hours.indexOf(time);
  const belowIndex = idx + baseRows;
  if (idx < 0 || belowIndex >= hours.length) return false;
  const slotBelow = hours[belowIndex];
  if (slotBelow === undefined) return false;
  return (postsGrid[dateKey]?.[slotBelow]?.length ?? 0) > 0;
}

/** True when the slot immediately above this one (same date) has posts. */
export function hasBlocksAbove(
  dateKey: string,
  time: string,
  postsGrid: PostsGrid,
  hours: string[]
): boolean {
  const idx = hours.indexOf(time);
  if (idx <= 0) return false;
  const slotAbove = hours[idx - 1];
  if (slotAbove === undefined) return false;
  return (postsGrid[dateKey]?.[slotAbove]?.length ?? 0) > 0;
}

/** Week view: row index at and above which blocks expand upward (22:30 = index 45). */
export const WEEK_VIEW_BOTTOM_ROWS_EXPAND_UP_THRESHOLD = 45;
