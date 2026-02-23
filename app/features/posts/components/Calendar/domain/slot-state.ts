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
  hasBlocksUnderneath,
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
  if (hasBlocksUnderneath(dateKey, time, rows, postsGrid, hours)) {
    rows = Math.min(rows, 3);
  }
  const rowIndex = hours.indexOf(time);
  if (
    rowIndex >= WEEK_VIEW_BOTTOM_ROWS_EXPAND_UP_THRESHOLD &&
    hasBlocksAbove(dateKey, time, postsGrid, hours)
  ) {
    rows = Math.min(rows, 3);
  }
  return rows;
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
  const expandDown =
    isDayView && dayViewColumnMap && posts.length === 1
      ? getExpandDownDayView(
          dateKey,
          time,
          postsGrid,
          hours,
          maxExpand,
          dayViewColumnMap[slotKey] ?? 0,
          dayViewColumnMap
        )
      : getExpandDown(dateKey, time, postsGrid, hours, maxExpand);
  const singlePostKey =
    posts.length === 1 && posts[0] ? `${dateKey}-${time}-${posts[0].id}` : null;
  const effectiveHoveredKey =
    isDayView &&
    hoveredPostKeyByColumn &&
    dayViewColumnMap &&
    singlePostKey !== null
      ? (hoveredPostKeyByColumn[dayViewColumnMap[slotKey] ?? 0] ?? null)
      : hoveredPostKey;
  const isHovered =
    (singlePostKey !== null && effectiveHoveredKey === singlePostKey) ||
    (!!selectedPost &&
      posts.length === 1 &&
      (posts[0] as CalendarPost | undefined)?.id === selectedPost.id);
  const baseRows = isDayView
    ? 1 + expandDown
    : computeWeekViewBaseRows(dateKey, time, 1 + expandDown, postsGrid, hours);
  const rowIndex = hours.indexOf(time);
  const hasConflictBelow = hasBlocksUnderneath(
    dateKey,
    time,
    baseRows,
    postsGrid,
    hours
  );
  const hasConflictAbove =
    rowIndex >= WEEK_VIEW_BOTTOM_ROWS_EXPAND_UP_THRESHOLD &&
    hasBlocksAbove(dateKey, time, postsGrid, hours);
  const noExpandOnHover =
    !isDayView && baseRows === 3 && (hasConflictBelow || hasConflictAbove);
  const expandRows = isDayView
    ? isHovered
      ? baseRows <= 4
        ? 5
        : baseRows
      : baseRows
    : isHovered
      ? noExpandOnHover
        ? baseRows
        : baseRows >= 4
          ? baseRows
          : Math.min(baseRows + 2, 4)
      : baseRows;
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
  };
}

export { ROW_HEIGHT_PX };
