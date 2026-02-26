import type { SlotState } from "../domain/grid-types";

import { CurrentTimeIndicator } from "./CurrentTimeIndicator";
import { TimeGridRow, type TimeGridRowProps } from "./TimeGridRow";
import {
  ROW_HEIGHT_PX,
  TIME_GRID_LINES_Z,
  TIME_GRID_ROWS_LAYER_Z,
  TOTAL_TIME_SLOTS,
} from "./weekly-view-constants";

export interface TimeGridProps extends Omit<
  TimeGridRowProps,
  "time" | "index" | "hourLabel"
> {
  hours: string[];
  hourLabels: string[];
  weekDays: Date[];
  getSlotState: (day: Date, time: string) => SlotState;
  scrollLeft?: number;
}

export function TimeGrid({
  hours,
  hourLabels,
  weekDays,
  getSlotState,
  hoveredPostKey,
  setHoveredPostKey,
  dragOverSlot,
  userTimezone,
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
  scrollLeft = 0,
}: TimeGridProps) {
  return (
    <div className="relative min-h-0 w-full flex-none">
      {isMobile ? (
        <div
          className="border-border/30 pointer-events-none absolute top-0 left-0 z-[280] w-16"
          style={{ transform: `translateX(${scrollLeft}px)` }}
        >
          <div
            className="bg-[hsl(var(--calendar-surface-2-bg))]"
            style={{
              height: `${TOTAL_TIME_SLOTS * ROW_HEIGHT_PX}px`,
              minHeight: `${TOTAL_TIME_SLOTS * ROW_HEIGHT_PX}px`,
            }}
          >
            {hourLabels.map((label, index) => (
              <div
                key={hours[index] ?? `mobile-rail-${label}-${index}`}
                className="text-muted-foreground/85 border-border/30 flex w-16 items-start justify-end border-r pr-2 text-right text-xs leading-none"
                style={{ height: ROW_HEIGHT_PX - 1 }}
              >
                {label}
              </div>
            ))}
          </div>
        </div>
      ) : null}
      <div
        className={`relative flex w-full flex-col flex-nowrap ${isMobile ? "pl-16" : ""}`}
        style={{
          height: `${TOTAL_TIME_SLOTS * ROW_HEIGHT_PX}px`,
          minHeight: `${TOTAL_TIME_SLOTS * ROW_HEIGHT_PX}px`,
        }}
      >
        {/* Grid lines in a single layer behind rows so they don't cut through post blocks */}
        <div
          className="pointer-events-none absolute inset-0"
          aria-hidden
          style={{
            zIndex: TIME_GRID_LINES_Z,
            backgroundImage: `repeating-linear-gradient(to bottom, transparent 0, transparent ${ROW_HEIGHT_PX - 1}px, hsl(var(--border) / 0.4) 0, hsl(var(--border) / 0.4) 1px)`,
            backgroundSize: `100% ${ROW_HEIGHT_PX}px`,
          }}
        />
        <div
          className="relative flex w-full flex-col flex-nowrap"
          style={{ zIndex: TIME_GRID_ROWS_LAYER_Z }}
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
              userTimezone={userTimezone}
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
