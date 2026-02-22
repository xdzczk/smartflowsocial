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
  hoveredPostKeyByColumn,
  setHoveredPostKeyForColumn,
  dragOverSlot,
  isDayView,
  userTimezone,
  dayViewColumnMap,
  dayViewBlockFromAboveMap,
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
          {/* Grid lines in a single layer behind rows so they don't cut through post blocks */}
          <div
            className="pointer-events-none absolute inset-0 z-0"
            aria-hidden
            style={{
              backgroundImage: `repeating-linear-gradient(to bottom, transparent 0, transparent ${ROW_HEIGHT_PX - 1}px, hsl(var(--border) / 0.4) 0, hsl(var(--border) / 0.4) 1px)`,
              backgroundSize: `100% ${ROW_HEIGHT_PX}px`,
            }}
          />
          <div className="relative z-[1] flex w-full flex-col flex-nowrap">
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
                hoveredPostKeyByColumn={hoveredPostKeyByColumn}
                setHoveredPostKeyForColumn={setHoveredPostKeyForColumn}
                dragOverSlot={dragOverSlot}
                isDayView={isDayView}
                userTimezone={userTimezone}
                dayViewColumnMap={dayViewColumnMap}
                dayViewBlockFromAboveMap={dayViewBlockFromAboveMap}
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
    </div>
  );
}
