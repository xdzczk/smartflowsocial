import type { QueueType, UserData } from "~/features/posts/types";

import type { HoverOverlayPayload, SlotState } from "../domain/grid-types";
import type { CalendarPost } from "../PostBlock.types";

import { SlotCell } from "./SlotCell";
import {
  CALENDAR_TIME_RAIL_STICKY_Z,
  ROW_HEIGHT_PX,
  TIME_GRID_ROW_CONTENT_Z,
} from "./weekly-view-constants";

export interface TimeGridRowProps {
  time: string;
  index: number;
  hourLabel: string;
  weekDays: Date[];
  hours: string[];
  getSlotState: (day: Date, time: string) => SlotState;
  hoveredPostKey: string | null;
  setHoveredPostKey: (key: string | null) => void;
  dragOverSlot: string | null;
  userTimezone: string;
  selectedPost?: { id: string } | null;
  hoveredSlotKey: string | null;
  setHoveredSlotKey: (key: string | null) => void;
  onDragOver: (
    e: React.DragEvent<HTMLDivElement>,
    dateKey: string,
    time: string
  ) => void;
  onDrop: (
    e: React.DragEvent<HTMLDivElement>,
    dateKey: string,
    time: string
  ) => void;
  onDragLeave: () => void;
  formatDropSlotAriaLabel: (
    dateKey: string,
    time: string,
    userTimezone: string,
    dateLocale?: string
  ) => string;
  dateLocale: string;
  onPostEdit: (post: CalendarPost) => void;
  user?: UserData | null;
  queueTypes?: QueueType[];
  isLongform: boolean;
  isAll: boolean;
  activeEmptySlotKey: string | null;
  setActiveEmptySlotKey: (key: string | null) => void;
  onHoverOverlayChange?: (payload: HoverOverlayPayload | null) => void;
  onClearSelection?: () => void;
  isMobile: boolean;
}

export function TimeGridRow({
  time,
  index,
  hourLabel,
  weekDays,
  hours,
  getSlotState,
  formatDropSlotAriaLabel,
  dateLocale,
  userTimezone,
  hoveredPostKey,
  setHoveredPostKey,
  dragOverSlot: _dragOverSlot,
  selectedPost: _selectedPost,
  hoveredSlotKey,
  setHoveredSlotKey,
  onDragOver,
  onDrop,
  onDragLeave,
  onPostEdit,
  user,
  queueTypes,
  isLongform,
  isAll,
  activeEmptySlotKey,
  setActiveEmptySlotKey,
  onHoverOverlayChange,
  onClearSelection,
  isMobile,
}: TimeGridRowProps) {
  // Keep a monotonic stack: upper rows always render above lower rows.
  const rowZIndex = hours.length - index;

  return (
    <div
      key={time}
      className="relative flex w-full flex-none items-start overflow-visible"
      style={{
        zIndex: rowZIndex,
        flexBasis: ROW_HEIGHT_PX,
        height: ROW_HEIGHT_PX,
        minHeight: ROW_HEIGHT_PX,
      }}
    >
      <div
        className="relative flex min-h-0 w-full min-w-0 flex-1 items-stretch overflow-visible"
        style={{ height: ROW_HEIGHT_PX - 1, zIndex: TIME_GRID_ROW_CONTENT_Z }}
      >
        <div
          className={`text-muted-foreground/85 border-border/30 w-16 flex-shrink-0 border-r pr-2 text-right text-xs leading-none ${
            isMobile
              ? "hidden"
              : "sticky left-0 bg-[hsl(var(--calendar-surface-2-bg))]"
          }`}
          style={isMobile ? undefined : { zIndex: CALENDAR_TIME_RAIL_STICKY_Z }}
        >
          {hourLabel}
        </div>
        {weekDays.map((day, dayIndex) => {
          const slotState = getSlotState(day, time);
          return (
            <SlotCell
              key={slotState.slotKey}
              slotState={slotState}
              time={time}
              rowIndex={index}
              availableRowsBelow={hours.length - index}
              hoveredPostKey={hoveredPostKey}
              setHoveredPostKey={setHoveredPostKey}
              onPostEdit={onPostEdit}
              user={user}
              queueTypes={queueTypes}
              isLongform={isLongform}
              isAll={isAll}
              activeEmptySlotKey={activeEmptySlotKey}
              setActiveEmptySlotKey={setActiveEmptySlotKey}
              columnIndex={dayIndex}
              onHoverOverlayChange={onHoverOverlayChange}
              onClearSelection={onClearSelection}
              hoveredSlotKey={hoveredSlotKey}
              setHoveredSlotKey={setHoveredSlotKey}
              onDragOver={(e) => onDragOver(e, slotState.dateKey, time)}
              onDrop={(e) => onDrop(e, slotState.dateKey, time)}
              onDragLeave={onDragLeave}
              formatDropSlotAriaLabel={formatDropSlotAriaLabel}
              dateLocale={dateLocale}
              userTimezone={userTimezone}
              isMobile={isMobile}
            />
          );
        })}
      </div>
    </div>
  );
}
