/**
 * Day view: compute single-post column placements and multi-post row data
 * for the two-column + multi-post row layout (Option 2).
 */

import {
  getDayViewMaxExpand,
  getExpandDown,
  getExpandDownDayView,
} from "../domain/expand-rules";
import { ROW_HEIGHT_PX } from "../domain/slot-state";
import type { CalendarPost } from "../PostBlock.types";

import type { PostsGrid } from "./posts-to-time-grid";

export interface DayViewPlacement {
  post: CalendarPost;
  time: string;
  rowIndex: number;
  blockHeightPx: number;
  slotKey: string;
}

export interface DayViewColumnPlacements {
  col0: DayViewPlacement[];
  col1: DayViewPlacement[];
}

export interface MultiPostRow {
  rowIndex: number;
  time: string;
  posts: CalendarPost[];
  blockHeightPx: number;
  /** When > 0, show "+N" in UI. */
  overflowCount: number;
}

/**
 * Single-post slots only (posts.length === 1). Uses getExpandDownDayView
 * so block height = (1 + expandDown) * ROW_HEIGHT_PX - 4, capped by getDayViewMaxExpand(1).
 */
export function getDayViewColumnPlacements(
  dateKey: string,
  hours: string[],
  postsGrid: PostsGrid,
  dayViewColumnMap: Record<string, 0 | 1>
): DayViewColumnPlacements {
  const col0: DayViewPlacement[] = [];
  const col1: DayViewPlacement[] = [];

  for (let rowIndex = 0; rowIndex < hours.length; rowIndex++) {
    const time = hours[rowIndex];
    if (time === undefined) continue;
    const posts = postsGrid[dateKey]?.[time] ?? [];
    if (posts.length !== 1) continue;
    const slotKey = `${dateKey}-${time}`;
    const col = dayViewColumnMap[slotKey];
    if (col === undefined) continue;
    const post = posts[0];
    if (!post) continue;

    const maxExpand = getDayViewMaxExpand(1);
    const expandDown = getExpandDownDayView(
      dateKey,
      time,
      postsGrid,
      hours,
      maxExpand,
      col,
      dayViewColumnMap
    );
    const baseRows = 1 + expandDown;
    const blockHeightPx = baseRows * ROW_HEIGHT_PX - 4;

    const placement: DayViewPlacement = {
      post,
      time,
      rowIndex,
      blockHeightPx,
      slotKey,
    };
    if (col === 0) col0.push(placement);
    else col1.push(placement);
  }

  capPlacementHeightsByNextInColumn(col0, hours.length);
  capPlacementHeightsByNextInColumn(col1, hours.length);
  return { col0, col1 };
}

/** Cap each block's height so it does not extend past the next block in the same column. */
function capPlacementHeightsByNextInColumn(
  placements: DayViewPlacement[],
  totalRows: number
): void {
  for (let i = 0; i < placements.length; i++) {
    const p = placements[i];
    if (!p) continue;
    const nextRow =
      i + 1 < placements.length
        ? (placements[i + 1] as DayViewPlacement).rowIndex
        : totalRows;
    const maxRows = nextRow - p.rowIndex;
    const maxHeightPx = maxRows * ROW_HEIGHT_PX - 4;
    if (p.blockHeightPx > maxHeightPx) {
      p.blockHeightPx = maxHeightPx;
    }
  }
}

/**
 * Time slots with 2+ posts: row height uses day-view expand rules when free rows exist below.
 */
export function getMultiPostRows(
  dateKey: string,
  hours: string[],
  postsGrid: PostsGrid
): MultiPostRow[] {
  const rows: MultiPostRow[] = [];
  for (let rowIndex = 0; rowIndex < hours.length; rowIndex++) {
    const time = hours[rowIndex];
    if (time === undefined) continue;
    const posts = postsGrid[dateKey]?.[time] ?? [];
    if (posts.length < 2) continue;
    const maxExpand = getDayViewMaxExpand(posts.length);
    const expandDown = getExpandDown(
      dateKey,
      time,
      postsGrid,
      hours,
      maxExpand
    );
    const baseRows = 1 + expandDown;
    const blockHeightPx = baseRows * ROW_HEIGHT_PX - 4;
    const displayPosts = posts.slice(0, 6);
    const overflowCount = Math.max(0, posts.length - 6);
    rows.push({
      rowIndex,
      time,
      posts: displayPosts,
      blockHeightPx,
      overflowCount,
    });
  }
  return rows;
}

/** Row indices that are covered by a placement (block spans multiple rows). */
function placementCoveredRowIndices(p: DayViewPlacement): number[] {
  const rows = Math.max(1, Math.ceil((p.blockHeightPx + 4) / ROW_HEIGHT_PX));
  const indices: number[] = [];
  for (let r = 0; r < rows && p.rowIndex + r < 48; r++) {
    indices.push(p.rowIndex + r);
  }
  return indices;
}

/**
 * For each column, set of row indices that are "free" (no single-post block, not multi-post row).
 * Used to render empty-slot divs for create post / drop.
 */
export function getDayViewEmptySlotRowIndices(
  placements: DayViewColumnPlacements,
  multiPostRows: MultiPostRow[],
  totalRows: number
): { col0: Set<number>; col1: Set<number> } {
  const multiPostSet = new Set(multiPostRows.map((r) => r.rowIndex));
  const covered0 = new Set<number>();
  const covered1 = new Set<number>();
  for (const p of placements.col0) {
    for (const r of placementCoveredRowIndices(p)) covered0.add(r);
  }
  for (const p of placements.col1) {
    for (const r of placementCoveredRowIndices(p)) covered1.add(r);
  }
  const col0 = new Set<number>();
  const col1 = new Set<number>();
  for (let r = 0; r < totalRows; r++) {
    if (multiPostSet.has(r)) continue;
    if (!covered0.has(r)) col0.add(r);
    if (!covered1.has(r)) col1.add(r);
  }
  return { col0, col1 };
}
