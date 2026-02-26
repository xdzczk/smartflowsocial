/**
 * Day view: two full-height columns + multi-post row layer (Option 2).
 * Renders single-post blocks in two columns (absolute) and multi-post slots as rows with 2–6 equal cells.
 */

import { useCallback, useState } from "react";
import type { RefObject } from "react";

import type { QueueType, UserData } from "../../../types";
import { buildDropIsoString } from "../calendar-helpers";
import type {
  DayViewColumnPlacements,
  DayViewPlacement,
  MultiPostRow,
} from "../data/day-view-placements";
import { parseDropToDateTime } from "../data/parse-drop-to-date-time";
import { PostBlock } from "../PostBlock";
import type { CalendarPost } from "../PostBlock.types";

import { CurrentTimeIndicator } from "./CurrentTimeIndicator";
import { DayViewEmptyColumnArea } from "./EmptySlot";
import {
  DAY_VIEW_DROP_LAYER_Z,
  DAY_VIEW_GRID_LINES_Z,
  DAY_VIEW_MULTI_POSTS_Z,
  DAY_VIEW_POST_BLOCK_CONTAINER_Z,
  DAY_VIEW_SINGLE_POSTS_Z,
  EXPANDED_BLOCK_WRAPPER_CLASS,
  ROW_HEIGHT_PX,
  TOTAL_TIME_SLOTS,
} from "./weekly-view-constants";

export interface DayViewTwoColumnGridProps {
  dateKey: string;
  currentDate: Date;
  hours: string[];
  hourLabels: string[];
  placements: DayViewColumnPlacements;
  multiPostRows: MultiPostRow[];
  emptySlotRowIndices: { col0: Set<number>; col1: Set<number> };
  gridScrollRef: RefObject<HTMLDivElement | null>;
  onPostDrop: (post: CalendarPost, newDateTime: Date) => void;
  onPostEdit: (post: CalendarPost) => void;
  selectedPost?: CalendarPost | null;
  activeEmptySlotKey: string | null;
  setActiveEmptySlotKey: (key: string | null) => void;
  onClearSelection?: () => void;
  user?: UserData | null;
  queueTypes?: QueueType[];
  isLongform?: boolean;
  isAll?: boolean;
}

function BlockInColumn({
  placement,
  isHovered,
  onHoverChange,
  onPostEdit,
  user,
  queueTypes,
  isLongform,
  isAll,
}: {
  placement: DayViewPlacement;
  isHovered: boolean;
  onHoverChange: (hovered: boolean) => void;
  onPostEdit: (post: CalendarPost) => void;
  user?: UserData | null;
  queueTypes?: QueueType[];
  isLongform?: boolean;
  isAll?: boolean;
}) {
  const baseRows = Math.max(
    1,
    Math.ceil((placement.blockHeightPx + 4) / ROW_HEIGHT_PX)
  );
  const expandedHeightPx =
    baseRows <= 4 ? 5 * ROW_HEIGHT_PX - 4 : placement.blockHeightPx;
  const heightPx = isHovered ? expandedHeightPx : placement.blockHeightPx;
  const isPast =
    typeof placement.post.isPast === "boolean" ? placement.post.isPast : false;

  return (
    // eslint-disable-next-line jsx-a11y/no-static-element-interactions -- hover expand; focus/blur already mirror mouse for keyboard
    <div
      className={`w-full min-w-0 transition-[height] duration-200 ease-out ${
        isHovered ? EXPANDED_BLOCK_WRAPPER_CLASS : "relative z-0"
      }`}
      style={{ height: heightPx }}
      onMouseEnter={() => onHoverChange(true)}
      onMouseLeave={() => onHoverChange(false)}
      onFocus={() => onHoverChange(true)}
      onBlur={() => onHoverChange(false)}
    >
      <PostBlock
        post={placement.post}
        compact
        user={user}
        queueTypes={queueTypes}
        onEdit={onPostEdit}
        isLongform={
          isAll
            ? Boolean(placement.post.title && placement.post.publishedAt)
            : (isLongform ?? false)
        }
        isPast={isPast}
        forceOpaque={isHovered}
        hideTimeRowPreview
        slotExpandRows={Math.ceil((heightPx + 4) / ROW_HEIGHT_PX)}
      />
    </div>
  );
}

export function DayViewTwoColumnGrid({
  dateKey,
  currentDate,
  hours,
  hourLabels,
  placements,
  multiPostRows,
  emptySlotRowIndices,
  gridScrollRef,
  onPostDrop,
  onPostEdit,
  selectedPost,
  activeEmptySlotKey,
  setActiveEmptySlotKey,
  onClearSelection,
  user,
  queueTypes,
  isLongform = false,
  isAll = false,
}: DayViewTwoColumnGridProps) {
  const [hoveredSlotKey, setHoveredSlotKey] = useState<string | null>(null);
  const [hoveredMultiPostKey, setHoveredMultiPostKey] = useState<string | null>(
    null
  );
  const [dragOverSlot, setDragOverSlot] = useState<string | null>(null);
  const [isDragOverGrid, setIsDragOverGrid] = useState(false);
  const userTimezone = user?.timezone ?? "Etc/UTC";

  const handleDragOver = useCallback(
    (e: React.DragEvent<HTMLDivElement>, time: string) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      setDragOverSlot(`${dateKey}-${time}`);
    },
    [dateKey]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>, time: string) => {
      e.preventDefault();
      setDragOverSlot(null);
      setIsDragOverGrid(false);
      const postData = JSON.parse(
        e.dataTransfer.getData("text/plain")
      ) as CalendarPost;
      const isoString = buildDropIsoString(dateKey, time);
      const newDateTime = parseDropToDateTime(isoString, userTimezone);
      onPostDrop(postData, newDateTime);
    },
    [dateKey, userTimezone, onPostDrop]
  );

  const handleDragLeave = useCallback(() => {
    setDragOverSlot(null);
  }, []);

  const handleGridDragOver = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragOverGrid(true);
    },
    []
  );

  const handleGridDragLeave = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      const related = e.relatedTarget as Node | null;
      if (related === null || !e.currentTarget.contains(related)) {
        setIsDragOverGrid(false);
      }
    },
    []
  );

  const totalHeightPx = TOTAL_TIME_SLOTS * ROW_HEIGHT_PX;

  return (
    <div
      ref={gridScrollRef}
      className="relative min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto"
    >
      <div
        className="relative flex w-full"
        style={{ height: totalHeightPx, minHeight: totalHeightPx }}
      >
        {/* Time strip */}
        <div
          className="flex shrink-0 flex-col"
          style={{ width: "4rem", height: totalHeightPx }}
        >
          {hours.map((_, index) => (
            <div
              key={hours[index]}
              className="text-muted-foreground flex shrink-0 items-start justify-end pr-1 text-xs"
              style={{
                height: ROW_HEIGHT_PX,
                lineHeight: `${ROW_HEIGHT_PX}px`,
              }}
            >
              {hourLabels[index] ?? ""}
            </div>
          ))}
        </div>

        {/* Content area: grid lines, columns, multi-post, empty slots, drop layer */}
        {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions -- drag-over/leave for drop layer activation; no keyboard drag */}
        <div
          className="relative min-w-0 flex-1"
          style={{ height: totalHeightPx }}
          onDragOver={handleGridDragOver}
          onDragLeave={handleGridDragLeave}
        >
          {/* Grid lines behind content */}
          <div
            className="pointer-events-none absolute inset-0"
            aria-hidden
            style={{
              left: 0,
              right: 0,
              zIndex: DAY_VIEW_GRID_LINES_Z,
              backgroundImage: `repeating-linear-gradient(to bottom, transparent 0, transparent ${ROW_HEIGHT_PX - 1}px, hsl(var(--border) / 0.4) 0, hsl(var(--border) / 0.4) 1px)`,
              backgroundSize: `100% ${ROW_HEIGHT_PX}px`,
            }}
          />

          {/* Two column containers - Layer 1 single-post blocks */}
          <div
            className="absolute inset-0 flex"
            style={{ zIndex: DAY_VIEW_SINGLE_POSTS_Z }}
          >
            <div className="relative min-w-0 flex-1">
              {placements.col0.map((p) => (
                <div
                  key={p.slotKey}
                  className="absolute right-0 left-0 w-full px-0.5"
                  style={{
                    top: p.rowIndex * ROW_HEIGHT_PX,
                    zIndex: DAY_VIEW_POST_BLOCK_CONTAINER_Z,
                  }}
                >
                  <BlockInColumn
                    placement={p}
                    isHovered={
                      hoveredSlotKey === p.slotKey ||
                      (!!selectedPost && selectedPost.id === p.post.id)
                    }
                    onHoverChange={(hovered) =>
                      setHoveredSlotKey(hovered ? p.slotKey : null)
                    }
                    onPostEdit={onPostEdit}
                    user={user}
                    queueTypes={queueTypes}
                    isLongform={isLongform}
                    isAll={isAll}
                  />
                </div>
              ))}
              {/* Empty slots col0 */}
              {Array.from(emptySlotRowIndices.col0).map((rowIndex) => {
                const time = hours[rowIndex];
                if (!time) return null;
                const slotKey = `${dateKey}-${time}-0`;
                return (
                  <div
                    key={slotKey}
                    className="absolute right-0 left-0 px-0.5"
                    style={{
                      top: rowIndex * ROW_HEIGHT_PX,
                      height: ROW_HEIGHT_PX,
                    }}
                  >
                    <DayViewEmptyColumnArea
                      dateKey={dateKey}
                      time={time}
                      slotKey={slotKey}
                      blockHeightPx={ROW_HEIGHT_PX - 4}
                      userTimezone={userTimezone}
                      activeEmptySlotKey={activeEmptySlotKey}
                      setActiveEmptySlotKey={setActiveEmptySlotKey}
                      onClearSelection={onClearSelection}
                    />
                  </div>
                );
              })}
            </div>
            <div className="relative min-w-0 flex-1">
              {placements.col1.map((p) => (
                <div
                  key={p.slotKey}
                  className="absolute right-0 left-0 w-full px-0.5"
                  style={{
                    top: p.rowIndex * ROW_HEIGHT_PX,
                    zIndex: DAY_VIEW_POST_BLOCK_CONTAINER_Z,
                  }}
                >
                  <BlockInColumn
                    placement={p}
                    isHovered={
                      hoveredSlotKey === p.slotKey ||
                      (!!selectedPost && selectedPost.id === p.post.id)
                    }
                    onHoverChange={(hovered) =>
                      setHoveredSlotKey(hovered ? p.slotKey : null)
                    }
                    onPostEdit={onPostEdit}
                    user={user}
                    queueTypes={queueTypes}
                    isLongform={isLongform}
                    isAll={isAll}
                  />
                </div>
              ))}
              {Array.from(emptySlotRowIndices.col1).map((rowIndex) => {
                const time = hours[rowIndex];
                if (!time) return null;
                const slotKey = `${dateKey}-${time}-1`;
                return (
                  <div
                    key={slotKey}
                    className="absolute right-0 left-0 px-0.5"
                    style={{
                      top: rowIndex * ROW_HEIGHT_PX,
                      height: ROW_HEIGHT_PX,
                    }}
                  >
                    <DayViewEmptyColumnArea
                      dateKey={dateKey}
                      time={time}
                      slotKey={slotKey}
                      blockHeightPx={ROW_HEIGHT_PX - 4}
                      userTimezone={userTimezone}
                      activeEmptySlotKey={activeEmptySlotKey}
                      setActiveEmptySlotKey={setActiveEmptySlotKey}
                      onClearSelection={onClearSelection}
                    />
                  </div>
                );
              })}
            </div>
          </div>

          {/* Layer 2: multi-post rows */}
          <div
            className="pointer-events-none absolute inset-0"
            style={{ zIndex: DAY_VIEW_MULTI_POSTS_Z }}
          >
            <div className="absolute inset-0">
              {multiPostRows.map((row) => (
                // eslint-disable-next-line jsx-a11y/no-static-element-interactions -- Hover-exit region for grouped row interactions
                <div
                  key={`${row.rowIndex}-${row.time}`}
                  className="pointer-events-auto absolute right-0 left-0 flex gap-0.5 px-0.5"
                  style={{
                    top: row.rowIndex * ROW_HEIGHT_PX,
                    height: row.blockHeightPx,
                  }}
                  onMouseLeave={() => setHoveredMultiPostKey(null)}
                >
                  {row.posts.map((post, index) => {
                    const key = `${row.time}-${post.id}`;
                    const isHovered = hoveredMultiPostKey === key;
                    const totalCells =
                      row.posts.length + (row.overflowCount > 0 ? 1 : 0);
                    const fullWidthForHovered = `calc(${totalCells * 100}% + ${(totalCells - 1) * 0.125}rem)`;
                    const expandStyle = isHovered
                      ? {
                          ...(index >= row.posts.length / 2
                            ? { right: 0 }
                            : { left: 0 }),
                          width: fullWidthForHovered,
                        }
                      : {};

                    return (
                      // eslint-disable-next-line jsx-a11y/no-static-element-interactions -- Hover/focus/touch wrapper controlling expansion state; interactive PostBlock lives inside
                      <div
                        key={post.id}
                        className={`min-w-0 overflow-hidden rounded-[var(--calendar-radius-md)] ${
                          isHovered
                            ? "absolute top-0 z-10 bg-[hsl(var(--calendar-surface-2-bg))]"
                            : "relative flex-1"
                        }`}
                        style={{ ...expandStyle, height: row.blockHeightPx }}
                        onMouseEnter={() => setHoveredMultiPostKey(key)}
                        onFocusCapture={() => setHoveredMultiPostKey(key)}
                        onBlurCapture={() => setHoveredMultiPostKey(null)}
                        onTouchStart={() => setHoveredMultiPostKey(key)}
                        onTouchEnd={() =>
                          setTimeout(() => setHoveredMultiPostKey(null), 300)
                        }
                      >
                        <PostBlock
                          post={post}
                          compact
                          multipleInCell
                          user={user}
                          queueTypes={queueTypes}
                          onEdit={onPostEdit}
                          isLongform={
                            isAll
                              ? Boolean(post.title && post.publishedAt)
                              : isLongform
                          }
                          isPast={
                            typeof post.isPast === "boolean"
                              ? post.isPast
                              : false
                          }
                          hideTimeRowPreview
                          forceOpaque={isHovered}
                          slotExpandRows={Math.ceil(
                            (row.blockHeightPx + 4) / ROW_HEIGHT_PX
                          )}
                        />
                      </div>
                    );
                  })}
                  {row.overflowCount > 0 ? (
                    <div className="bg-muted text-muted-foreground flex flex-1 items-center justify-center rounded text-xs">
                      +{row.overflowCount}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </div>

          {/* Drop layer: 48 rows; only capture pointer events during drag so blocks stay clickable/hoverable */}
          <div
            className={`absolute inset-0 ${isDragOverGrid ? "pointer-events-auto" : "pointer-events-none"}`}
            style={{ zIndex: DAY_VIEW_DROP_LAYER_Z }}
            aria-hidden
          >
            {hours.map((time, rowIndex) => {
              const slotKey = `${dateKey}-${time}`;
              const isDragOver = dragOverSlot === slotKey;
              return (
                // eslint-disable-next-line jsx-a11y/no-static-element-interactions -- drag-drop target; keyboard reschedule is not implemented
                <div
                  key={slotKey}
                  className="absolute right-0 left-0"
                  style={{
                    top: rowIndex * ROW_HEIGHT_PX,
                    height: ROW_HEIGHT_PX,
                  }}
                  onDragOver={(e) => handleDragOver(e, time)}
                  onDrop={(e) => handleDrop(e, time)}
                  onDragLeave={handleDragLeave}
                  data-slot={slotKey}
                >
                  {isDragOver ? (
                    <div className="bg-primary/10 border-primary/50 absolute inset-0 rounded border-2 border-dashed" />
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>

        <CurrentTimeIndicator user={user} weekDays={[currentDate]} />
      </div>
    </div>
  );
}
