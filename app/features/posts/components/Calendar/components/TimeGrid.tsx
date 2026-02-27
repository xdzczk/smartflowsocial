import { useState } from "react";

import type { HoverOverlayPayload, SlotState } from "../domain/grid-types";
import { PostBlock } from "../PostBlock";

import { CurrentTimeIndicator } from "./CurrentTimeIndicator";
import { TimeGridRow, type TimeGridRowProps } from "./TimeGridRow";
import {
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
  const [isDraggingPostBlock, setIsDraggingPostBlock] = useState(false);
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

  return (
    <div className="relative min-h-0 w-full flex-none">
      <div
        className="relative flex w-full flex-col flex-nowrap"
        style={{
          height: `${TOTAL_TIME_SLOTS * ROW_HEIGHT_PX}px`,
          minHeight: `${TOTAL_TIME_SLOTS * ROW_HEIGHT_PX}px`,
        }}
        onDragStartCapture={() => {
          setIsDraggingPostBlock(true);
          setHoverOverlayPayload(null);
          setHoveredPostKey(null);
        }}
        onDragEndCapture={() => {
          setIsDraggingPostBlock(false);
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
          <CurrentTimeIndicator
            user={user}
            weekDays={weekDays}
            isMobile={isMobile}
          />
        </div>
        {hoverOverlayPayload && !isDraggingPostBlock ? (
          <div className="pointer-events-none absolute inset-0 z-[500]">
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
