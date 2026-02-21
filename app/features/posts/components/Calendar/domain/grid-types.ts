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
  /** Week view: true when slot is 3 rows and the next slot below has posts (no expand on hover). */
  noExpandOnHover: boolean;
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
