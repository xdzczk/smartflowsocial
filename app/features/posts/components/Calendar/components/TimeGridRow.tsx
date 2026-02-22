import type { QueueType, UserData } from "../../../types";
import type { SlotState } from "../domain/grid-types";
import type { CalendarPost } from "../PostBlock.types";

import { SlotCell } from "./SlotCell";
import {
  BOTTOM_ROWS_EXPAND_UP_THRESHOLD,
  BOTTOM_ROWS_STACK_ABOVE_THRESHOLD,
  CALENDAR_ROW_Z_BASE,
  CALENDAR_ROW_Z_EXPANDED_UP,
  ROW_HEIGHT_PX,
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
  onClearSelection,
  isMobile,
}: TimeGridRowProps) {
  const expandUp = index >= BOTTOM_ROWS_EXPAND_UP_THRESHOLD;
  const rowHasHoveredExpandedUp =
    expandUp &&
    weekDays.some((day) => {
      const slotState = getSlotState(day, time);
      return slotState.posts.some((p) => {
        const key = `${slotState.dateKey}-${time}-${p.id}`;
        return hoveredPostKey === key;
      });
    });
  const rowZIndex = rowHasHoveredExpandedUp
    ? CALENDAR_ROW_Z_EXPANDED_UP
    : index >= BOTTOM_ROWS_STACK_ABOVE_THRESHOLD
      ? CALENDAR_ROW_Z_BASE - index + BOTTOM_ROWS_STACK_ABOVE_THRESHOLD
      : Math.max(1, CALENDAR_ROW_Z_BASE - index);

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
        className="relative z-[1] flex min-h-0 w-full min-w-0 flex-1 items-stretch"
        style={{ height: ROW_HEIGHT_PX - 1 }}
      >
        <div className="text-muted-foreground/85 w-16 flex-shrink-0 pr-2 text-right text-xs leading-none">
          {hourLabel}
        </div>
        {weekDays.map((day) => {
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
