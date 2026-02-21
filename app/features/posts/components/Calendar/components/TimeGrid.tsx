import type { RefObject } from "react";

import type { SlotState } from "../domain/grid-types";

import { CurrentTimeIndicator } from "./CurrentTimeIndicator";
import { TimeGridRow, type TimeGridRowProps } from "./TimeGridRow";
import { ROW_HEIGHT_PX, TOTAL_TIME_SLOTS } from "./weekly-view-constants";

export interface TimeGridProps extends Omit<
  TimeGridRowProps,
  "time" | "index" | "hourLabel"
> {
  gridScrollRef: RefObject<HTMLDivElement | null>;
  hours: string[];
  hourLabels: string[];
  weekDays: Date[];
  getSlotState: (day: Date, time: string) => SlotState;
}

export function TimeGrid({
  gridScrollRef,
  hours,
  hourLabels,
  weekDays,
  getSlotState,
  hoveredPostKey,
  setHoveredPostKey,
  dragOverSlot,
  isDayView,
  userTimezone,
  dayViewColumnMap,
  selectedPost,
  hoveredSlotKey,
  setHoveredSlotKey,
  onDragOver,
  onDrop,
  onDragLeave,
  formatDropSlotAriaLabel,
  dateLocale,
  onPostEdit,
  user,
  queueTypes,
  isLongform,
  isAll,
  activeEmptySlotKey,
  setActiveEmptySlotKey,
  onClearSelection,
  isMobile,
}: TimeGridProps) {
  return (
    <div className="relative min-h-0 flex-1">
      <div
        ref={gridScrollRef}
        className="absolute inset-0 isolate overflow-x-hidden overflow-y-scroll"
      >
        <div
          className="relative flex w-full flex-col flex-nowrap"
          style={{
            height: `${TOTAL_TIME_SLOTS * ROW_HEIGHT_PX}px`,
            minHeight: `${TOTAL_TIME_SLOTS * ROW_HEIGHT_PX}px`,
            transform: "translateZ(0)",
          }}
        >
          {hours.map((time, index) => (
            <TimeGridRow
              key={time}
              time={time}
              index={index}
              hourLabel={hourLabels[index] ?? ""}
              weekDays={weekDays}
              hours={hours}
              getSlotState={getSlotState}
              hoveredPostKey={hoveredPostKey}
              setHoveredPostKey={setHoveredPostKey}
              dragOverSlot={dragOverSlot}
              isDayView={isDayView}
              userTimezone={userTimezone}
              dayViewColumnMap={dayViewColumnMap}
              selectedPost={selectedPost}
              hoveredSlotKey={hoveredSlotKey}
              setHoveredSlotKey={setHoveredSlotKey}
              onDragOver={onDragOver}
              onDrop={onDrop}
              onDragLeave={onDragLeave}
              formatDropSlotAriaLabel={formatDropSlotAriaLabel}
              dateLocale={dateLocale}
              onPostEdit={onPostEdit}
              user={user}
              queueTypes={queueTypes}
              isLongform={isLongform}
              isAll={isAll}
              activeEmptySlotKey={activeEmptySlotKey}
              setActiveEmptySlotKey={setActiveEmptySlotKey}
              onClearSelection={onClearSelection}
              isMobile={isMobile}
            />
          ))}
          <CurrentTimeIndicator user={user} weekDays={weekDays} />
        </div>
      </div>
    </div>
  );
}
