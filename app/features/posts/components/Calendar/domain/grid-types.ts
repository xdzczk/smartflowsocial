/**
 * Shared types for calendar grid and slot state.
 */

import type { CalendarPost } from "../PostBlock.types";

export type PostsGrid = Record<string, Record<string, CalendarPost[]>>;
export type PostsByDate = Record<string, CalendarPost[]>;

export interface SlotState {
  dateKey: string;
  posts: CalendarPost[];
  slotKey: string;
  isDragOver: boolean;
  singlePostKey: string | null;
  isHovered: boolean;
  expandRows: number;
  blockHeightPx: number;
  /** Week view: true when surrounding rows conflict; hover growth should be capped. */
  noExpandOnHover: boolean;
  /** Nearest occupied row below within current expand span (1 = immediate next row), null when no conflict. */
  firstConflictOffsetBelow: number | null;
  /** Nearest occupied row above within current expand span (1 = immediate previous row), null when no conflict. */
  firstConflictOffsetAbove: number | null;
}

export interface HoverOverlayPayload {
  key: string;
  post: CalendarPost;
  dateKey: string;
  time: string;
  rowIndex: number;
  columnIndex: number;
  topPx: number;
  heightPx: number;
  expandedRows: number;
  isLongform: boolean;
  isPast: boolean;
}

export interface GetSlotStateOptions {
  hoveredPostKey: string | null;
  /** Day view only: hover state per column so both columns can have an active block. */
  hoveredPostKeyByColumn?: Record<0 | 1, string | null>;
  dragOverSlot: string | null;
  isDayView: boolean;
  userTimezone: string;
  dayViewColumnMap?: Record<string, 0 | 1>;
  selectedPost?: CalendarPost | null;
}
