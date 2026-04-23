import { fromDate } from "~/lib/temporal";

import type { HoverOverlayPayload, SlotState } from "../domain/grid-types";
import { PostBlock } from "../PostBlock";

import { TimeGridRow, type TimeGridRowProps } from "./TimeGridRow";
import {
  CALENDAR_HOVER_OVERLAY_Z,
  CALENDAR_TIME_RAIL_OVERLAY_Z,
  CURRENT_TIME_INDICATOR_Z,
  EXPANDED_BLOCK_WRAPPER_CLASS,
  ROW_HEIGHT_PX,
  TIME_GRID_LINES_Z,
  TIME_GRID_ROWS_LAYER_Z,
  TOTAL_TIME_SLOTS,
} from "./weekly-view-constants";

export interface TimeGridProps extends Omit<
  TimeGridRowProps,
  "time" | "index"
> {
  hours: string[];
  hourLabels: string[];
  weekDays: Date[];
  getSlotState: (day: Date, time: string) => SlotState;
  hoverOverlayPayload: HoverOverlayPayload | null;
  setHoverOverlayPayload: (payload: HoverOverlayPayload | null) => void;
  /** Pixel offset from the time-grid top (row 00:00) to the current time.
   *  Null when today is not in the visible week or during SSR. */
  indicatorTopOffset?: number | null;
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
  indicatorTopOffset,
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
        {/*
         * Sticky time-label overlay — first flex child so its y=0 matches
         * the rows-wrapper's y=0. height:0 keeps it out of the flex column
         * flow; overflow:visible lets the absolutely-positioned labels render
         * at top = N × ROW_HEIGHT_PX. position:sticky left:0 pins the strip
         * to the scroll viewport's left edge during horizontal panning.
         *
         * Placed INSIDE this container (sharing its position:relative
         * containing block) so the hover overlay at z=46 is never split into
         * a separate compositor layer from the time-rail overlay at z=2.
         * Previously, having the sticky overlay as a sibling of this container
         * caused Chrome's compositor to treat the container as z=0, putting
         * post-block hover overlays behind the sticky layer.
         */}
        <div
          aria-hidden
          className="pointer-events-none sticky left-0 w-16 overflow-visible"
          style={{ height: 0, zIndex: CALENDAR_TIME_RAIL_OVERLAY_Z }}
        >
          {hourLabels.map((label, index) => (
            <div
              key={index}
              className="border-border/30 text-text-secondary/85 absolute right-0 left-0 border-r bg-[hsl(var(--calendar-surface-2-bg))] pr-2 text-right text-xs leading-none"
              style={{
                top: index * ROW_HEIGHT_PX,
                height: ROW_HEIGHT_PX,
                boxShadow: "2px 0 4px rgba(0,0,0,0.05)",
              }}
            >
              {label}
            </div>
          ))}
        </div>
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
        {indicatorTopOffset !== null && indicatorTopOffset !== undefined ? (
          <>
            {/* Horizontal line: from time-column right edge across all day columns.
                Positioned absolutely inside the inner container so vertical scroll
                is handled natively by the browser (no React state tracking needed). */}
            <div
              aria-hidden
              className="bg-brand/90 pointer-events-none absolute h-px"
              style={{
                top: indicatorTopOffset,
                left: "4rem",
                right: 0,
                zIndex: CURRENT_TIME_INDICATOR_Z,
              }}
            />
            {/* Dot: same height:0 + sticky left trick as the time-label overlay.
                The wrapper is absolute at the correct vertical position; the sticky
                inner element keeps the dot pinned at the time-column right edge even
                when the user pans horizontally. */}
            <div
              aria-hidden
              className="pointer-events-none absolute right-0 left-0"
              style={{ top: indicatorTopOffset - 5, height: 10 }}
            >
              <div
                className="bg-brand pointer-events-none sticky rounded-full"
                style={{
                  width: 10,
                  height: 10,
                  left: "calc(4rem - 5px)",
                  zIndex: CURRENT_TIME_INDICATOR_Z,
                }}
              />
            </div>
          </>
        ) : null}
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
