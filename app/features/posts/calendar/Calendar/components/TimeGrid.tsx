import { fromDate } from "~/lib/temporal";

import type { HoverOverlayPayload, SlotState } from "../domain/grid-types";
import { PostBlock } from "../PostBlock";

import { TimeGridRow, type TimeGridRowProps } from "./TimeGridRow";
import {
  CALENDAR_HOVER_OVERLAY_Z,
  EXPANDED_BLOCK_WRAPPER_CLASS,
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
  hoverOverlayPayload: HoverOverlayPayload | null;
  setHoverOverlayPayload: (payload: HoverOverlayPayload | null) => void;
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
  hoverOverlayPayload,
  setHoverOverlayPayload,
  onClearSelection,
  isMobile,
}: TimeGridProps) {
  const dayCount = Math.max(1, weekDays.length);
  const overlayLeft = hoverOverlayPayload
    ? isMobile
      ? `${(hoverOverlayPayload.columnIndex / dayCount) * 100}%`
      : `calc(4rem + (${hoverOverlayPayload.columnIndex} * (100% - 4rem) / ${dayCount}))`
    : undefined;
  const overlayWidth = hoverOverlayPayload
    ? isMobile
      ? `${100 / dayCount}%`
      : `calc((100% - 4rem) / ${dayCount})`
    : undefined;

  const getDropSlotFromPointer = (clientX: number, clientY: number) => {
    const gridEl = document
      .elementFromPoint(clientX, clientY)
      ?.closest('[data-calendar-week-grid="true"]') as HTMLDivElement | null;
    if (!gridEl) return null;
    const rect = gridEl.getBoundingClientRect();
    const localY = clientY - rect.top;
    if (localY < 0 || localY >= rect.height) return null;
    const rowIndex = Math.max(
      0,
      Math.min(hours.length - 1, Math.floor(localY / ROW_HEIGHT_PX))
    );
    const time = hours[rowIndex];
    if (!time) return null;

    const timeRailWidth = isMobile ? 0 : 64;
    const contentWidth = rect.width - timeRailWidth;
    if (contentWidth <= 0) return null;
    const localX = clientX - rect.left - timeRailWidth;
    if (localX < 0 || localX >= contentWidth) return null;
    const columnWidth = contentWidth / dayCount;
    const columnIndex = Math.max(
      0,
      Math.min(dayCount - 1, Math.floor(localX / columnWidth))
    );
    const day = weekDays[columnIndex];
    if (!day) return null;
    const dayZoned = fromDate(day, userTimezone);
    const dateKey = `${dayZoned.year}-${String(dayZoned.month).padStart(2, "0")}-${String(dayZoned.day).padStart(2, "0")}`;
    return { dateKey, time };
  };

  return (
    <div
      className="relative min-h-0 w-full flex-none"
      data-calendar-week-grid="true"
    >
      {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions -- Root drag surface maps pointer coordinates to calendar slots */}
      <div
        className="relative flex w-full flex-col flex-nowrap"
        style={{
          height: `${TOTAL_TIME_SLOTS * ROW_HEIGHT_PX}px`,
          minHeight: `${TOTAL_TIME_SLOTS * ROW_HEIGHT_PX}px`,
        }}
        onDragOverCapture={(e) => {
          const slot = getDropSlotFromPointer(e.clientX, e.clientY);
          if (!slot) {
            onDragLeave();
            return;
          }
          onDragOver(e, slot.dateKey, slot.time);
        }}
        onDropCapture={(e) => {
          const slot = getDropSlotFromPointer(e.clientX, e.clientY);
          if (!slot) return;
          onDrop(e, slot.dateKey, slot.time);
        }}
        onDragLeave={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const outside =
            e.clientX < rect.left ||
            e.clientX > rect.right ||
            e.clientY < rect.top ||
            e.clientY > rect.bottom;
          if (outside) onDragLeave();
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
          className="relative flex w-full flex-col flex-nowrap overflow-visible"
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
              onHoverOverlayChange={setHoverOverlayPayload}
              onClearSelection={onClearSelection}
              isMobile={isMobile}
            />
          ))}
        </div>
        {/* Permanent separator at the time-column/day-columns boundary.
            Drawn above the rows-wrapper stacking context (z=1) so it stays
            visible even when overflow-visible post blocks expand across rows
            and would otherwise cover the per-row border-r lines. */}
        <div
          aria-hidden
          className="border-border/40 pointer-events-none absolute inset-y-0 border-r"
          style={{ left: "calc(4rem - 1px)", width: "1px", zIndex: 3 }}
        />
        {!isMobile && hoverOverlayPayload ? (
          <div
            className="pointer-events-none absolute inset-0"
            style={{ zIndex: CALENDAR_HOVER_OVERLAY_Z }}
          >
            {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions -- Overlay hover retention area for expanded post preview */}
            <div
              className={`pointer-events-auto absolute ${EXPANDED_BLOCK_WRAPPER_CLASS}`}
              style={{
                top: hoverOverlayPayload.topPx,
                left: overlayLeft,
                width: overlayWidth,
                height: hoverOverlayPayload.heightPx,
              }}
              onMouseEnter={() => {
                setHoveredPostKey(hoverOverlayPayload.key);
                setHoverOverlayPayload(hoverOverlayPayload);
              }}
              onMouseLeave={() => {
                setHoveredPostKey(null);
                setHoverOverlayPayload(null);
              }}
            >
              <PostBlock
                post={hoverOverlayPayload.post}
                compact={true}
                user={user}
                queueTypes={queueTypes}
                onEdit={(editedPost) => {
                  setActiveEmptySlotKey(null);
                  onPostEdit(editedPost);
                }}
                isLongform={hoverOverlayPayload.isLongform}
                isPast={hoverOverlayPayload.isPast}
                forceOpaque={true}
                hideTimeRowPreview={true}
                slotExpandRows={hoverOverlayPayload.expandedRows}
              />
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
