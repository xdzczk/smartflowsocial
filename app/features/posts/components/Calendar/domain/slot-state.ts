/**
 * Pure function: compute SlotState from grid + view-owned state (hover, drag, selected).
 * Views own UI state and pass it in; domain does not hold state.
 */

import type { CalendarPost } from "../PostBlock.types";

import {
  getDayViewMaxExpand,
  getExpandDown,
  getExpandDownDayView,
  getWeekViewMaxExpand,
  hasBlocksAbove,
  WEEK_VIEW_BOTTOM_ROWS_EXPAND_UP_THRESHOLD,
} from "./expand-rules";
import type { GetSlotStateOptions, PostsGrid, SlotState } from "./grid-types";

/** Row height in px; used for blockHeightPx. Must match view's ROW_HEIGHT_PX. */
const ROW_HEIGHT_PX = 52;

function computeWeekViewBaseRows(
  dateKey: string,
  time: string,
  baseRows: number,
  postsGrid: PostsGrid,
  hours: string[]
): number {
  let rows = baseRows;
  const rowIndex = hours.indexOf(time);
  if (
    rowIndex >= WEEK_VIEW_BOTTOM_ROWS_EXPAND_UP_THRESHOLD &&
    hasBlocksAbove(dateKey, time, postsGrid, hours)
  ) {
    rows = Math.min(rows, 3);
  }
  return rows;
}

function getSinglePostKey(
  dateKey: string,
  time: string,
  posts: CalendarPost[]
): string | null {
  return posts.length === 1 && posts[0]
    ? `${dateKey}-${time}-${posts[0].id}`
    : null;
}

function computeExpandDownForSlot(
  dateKey: string,
  time: string,
  postsGrid: PostsGrid,
  hours: string[],
  maxExpand: number,
  isDayView: boolean,
  postsCount: number,
  dayViewColumnMap?: Record<string, 0 | 1>
): number {
  const slotKey = `${dateKey}-${time}`;
  if (isDayView && dayViewColumnMap && postsCount === 1) {
    return getExpandDownDayView(
      dateKey,
      time,
      postsGrid,
      hours,
      maxExpand,
      dayViewColumnMap[slotKey] ?? 0,
      dayViewColumnMap
    );
  }
  return getExpandDown(dateKey, time, postsGrid, hours, maxExpand);
}

function computeEffectiveHoveredKey(
  isDayView: boolean,
  hoveredPostKey: string | null,
  hoveredPostKeyByColumn: GetSlotStateOptions["hoveredPostKeyByColumn"],
  dayViewColumnMap: GetSlotStateOptions["dayViewColumnMap"],
  slotKey: string,
  singlePostKey: string | null
): string | null {
  if (
    !isDayView ||
    !hoveredPostKeyByColumn ||
    !dayViewColumnMap ||
    singlePostKey === null
  ) {
    return hoveredPostKey;
  }
  return hoveredPostKeyByColumn[dayViewColumnMap[slotKey] ?? 0] ?? null;
}

function isSinglePostSelected(
  posts: CalendarPost[],
  selectedPost: GetSlotStateOptions["selectedPost"]
): boolean {
  return (
    !!selectedPost &&
    posts.length === 1 &&
    (posts[0] as CalendarPost | undefined)?.id === selectedPost.id
  );
}

function computeWeekNoExpandOnHover(
  dateKey: string,
  time: string,
  rowIndex: number,
  postsGrid: PostsGrid,
  hours: string[],
  isDayView: boolean
): boolean {
  if (isDayView) return false;
  // Any occupied slot in the next 3 rows should cap week-view hover growth to 3 rows.
  const hasConflictBelow = [1, 2, 3].some((offset) => {
    const belowSlot = hours[rowIndex + offset];
    if (belowSlot === undefined) return false;
    return (postsGrid[dateKey]?.[belowSlot]?.length ?? 0) > 0;
  });
  const hasConflictAbove =
    rowIndex >= WEEK_VIEW_BOTTOM_ROWS_EXPAND_UP_THRESHOLD &&
    hasBlocksAbove(dateKey, time, postsGrid, hours);
  // Week view: any collision above/below should cap hover growth.
  return hasConflictBelow || hasConflictAbove;
}

function computeExpandRows(
  isDayView: boolean,
  isHovered: boolean,
  baseRows: number,
  postsCount: number,
  noExpandOnHover: boolean
): number {
  if (isDayView) {
    if (!isHovered) return baseRows;
    return baseRows <= 4 ? 5 : baseRows;
  }

  if (!isHovered) return baseRows;
  if (postsCount === 1) {
    return Math.max(baseRows, noExpandOnHover ? 3 : 4);
  }
  if (noExpandOnHover) return baseRows;
  return baseRows >= 4 ? baseRows : Math.min(baseRows + 2, 4);
}

function getFirstConflictOffsetBelow(
  dateKey: string,
  time: string,
  postsGrid: PostsGrid,
  hours: string[],
  maxOffset: number
): number | null {
  const rowIndex = hours.indexOf(time);
  if (rowIndex < 0 || maxOffset <= 0) return null;
  for (let offset = 1; offset <= maxOffset; offset++) {
    const belowTime = hours[rowIndex + offset];
    if (belowTime === undefined) break;
    if ((postsGrid[dateKey]?.[belowTime]?.length ?? 0) > 0) {
      return offset;
    }
  }
  return null;
}

function getFirstConflictOffsetAbove(
  dateKey: string,
  time: string,
  postsGrid: PostsGrid,
  hours: string[],
  maxOffset: number
): number | null {
  const rowIndex = hours.indexOf(time);
  if (rowIndex <= 0 || maxOffset <= 0) return null;
  for (let offset = 1; offset <= maxOffset; offset++) {
    const aboveTime = hours[rowIndex - offset];
    if (aboveTime === undefined) break;
    if ((postsGrid[dateKey]?.[aboveTime]?.length ?? 0) > 0) {
      return offset;
    }
  }
  return null;
}

export function getSlotState(
  dateKey: string,
  time: string,
  postsGrid: PostsGrid,
  hours: string[],
  options: GetSlotStateOptions
): SlotState {
  const {
    hoveredPostKey,
    hoveredPostKeyByColumn,
    dragOverSlot,
    isDayView,
    userTimezone: _userTimezone,
    dayViewColumnMap,
    selectedPost,
  } = options;
  const posts = postsGrid[dateKey]?.[time] ?? [];
  const slotKey = `${dateKey}-${time}`;
  const isDragOver = dragOverSlot === slotKey;
  const maxExpand = isDayView
    ? getDayViewMaxExpand(posts.length)
    : getWeekViewMaxExpand(posts.length);
  const expandDown = computeExpandDownForSlot(
    dateKey,
    time,
    postsGrid,
    hours,
    maxExpand,
    isDayView,
    posts.length,
    dayViewColumnMap
  );
  const singlePostKey = getSinglePostKey(dateKey, time, posts);
  const effectiveHoveredKey = computeEffectiveHoveredKey(
    isDayView,
    hoveredPostKey,
    hoveredPostKeyByColumn,
    dayViewColumnMap,
    slotKey,
    singlePostKey
  );
  const isHovered =
    (singlePostKey !== null && effectiveHoveredKey === singlePostKey) ||
    isSinglePostSelected(posts, selectedPost);
  const baseRows = isDayView
    ? 1 + expandDown
    : computeWeekViewBaseRows(dateKey, time, 1 + expandDown, postsGrid, hours);
  const rowIndex = hours.indexOf(time);
  const noExpandOnHover = computeWeekNoExpandOnHover(
    dateKey,
    time,
    rowIndex,
    postsGrid,
    hours,
    isDayView
  );
  const expandRows = computeExpandRows(
    isDayView,
    isHovered,
    baseRows,
    posts.length,
    noExpandOnHover
  );
  // Scan at least 4 rows so hover expansion (up to 4 rows) has reliable
  // conflict-above/below signals even when base expandRows is small.
  const conflictScanRows = Math.max(4, Math.max(0, expandRows - 1));
  const firstConflictOffsetBelow = getFirstConflictOffsetBelow(
    dateKey,
    time,
    postsGrid,
    hours,
    conflictScanRows
  );
  const firstConflictOffsetAbove = getFirstConflictOffsetAbove(
    dateKey,
    time,
    postsGrid,
    hours,
    conflictScanRows
  );
  const blockHeightPx = expandRows * ROW_HEIGHT_PX - 4;
  return {
    dateKey,
    posts,
    slotKey,
    isDragOver,
    singlePostKey,
    isHovered,
    expandRows,
    blockHeightPx,
    noExpandOnHover,
    firstConflictOffsetBelow,
    firstConflictOffsetAbove,
  };
}

export { ROW_HEIGHT_PX };
