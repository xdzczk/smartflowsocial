/**
 * Day view: two full-height columns + multi-post row layer (Option 2).
 * Renders single-post blocks in two columns (absolute) and multi-post slots as rows with 2–6 equal cells.
 */

import { useCallback, useMemo, useState } from "react";
import type { RefObject } from "react";

import type { QueueType, UserData } from "../../../types";
import {
  buildDropIsoString,
  isCalendarDropSlotInPast,
} from "../calendar-helpers";
import type {
  DayViewColumnPlacements,
  DayViewPlacement,
  MultiPostRow,
} from "../data/day-view-placements";
import { parseDropToDateTime } from "../data/parse-drop-to-date-time";
import type { DayHoverOverlayPayload } from "../domain/grid-types";
import { PostBlock } from "../PostBlock";
import type { CalendarPost } from "../PostBlock.types";

import { CurrentTimeIndicator } from "./CurrentTimeIndicator";
import { DayViewEmptyColumnArea } from "./EmptySlot";
import {
  CALENDAR_BLOCK_BASE_Z,
  CALENDAR_BLOCK_EXPANDED_Z,
  CALENDAR_HOVER_OVERLAY_Z,
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

interface DayHoverLayout {
  targetRows: number;
  hoverRows: number;
  hoverHeightPx: number;
  topPx: number;
}

function isMovingIntoDayHoverOverlay(nextTarget: EventTarget | null): boolean {
  if (!(nextTarget instanceof HTMLElement)) return false;
  return nextTarget.closest('[data-day-hover-overlay="true"]') !== null;
}

function getDayHoverTargetRows(baseRows: number): number {
  return baseRows <= 4 ? 5 : baseRows;
}

function getDayHoverLayoutMetrics(
  rowIndex: number,
  baseRows: number,
  occupiedRowSet: Set<number>,
  totalRows: number
): DayHoverLayout {
  const hoverRows = getDayHoverTargetRows(baseRows);
  const extraRows = Math.max(0, hoverRows - baseRows);
  const hasConflictBelow = Array.from({ length: extraRows }, (_unused, i) => {
    const targetRow = rowIndex + baseRows + i;
    if (targetRow >= totalRows) return true;
    return occupiedRowSet.has(targetRow);
  }).some(Boolean);
  const freeRowsAbove = (() => {
    let free = 0;
    for (let r = rowIndex - 1; r >= 0; r--) {
      if (occupiedRowSet.has(r)) break;
      free++;
    }
    return free;
  })();
  const shiftRows = hasConflictBelow ? Math.min(extraRows, freeRowsAbove) : 0;
  return {
    targetRows: hoverRows,
    hoverRows,
    hoverHeightPx: hoverRows * ROW_HEIGHT_PX - 4,
    topPx: rowIndex * ROW_HEIGHT_PX - shiftRows * ROW_HEIGHT_PX,
  };
}

function BlockInColumn({
  placement,
  isHovered,
  hoverOverlayPayload,
  onHoverOverlayChange,
  onPostEdit,
  setActiveEmptySlotKey,
  user,
  queueTypes,
  isLongform,
  isAll,
}: {
  placement: DayViewPlacement;
  isHovered: boolean;
  hoverOverlayPayload: DayHoverOverlayPayload | null;
  onHoverOverlayChange: (payload: DayHoverOverlayPayload | null) => void;
  onPostEdit: (post: CalendarPost) => void;
  setActiveEmptySlotKey: (key: string | null) => void;
  user?: UserData | null;
  queueTypes?: QueueType[];
  isLongform?: boolean;
  isAll?: boolean;
}) {
  const baseRows = Math.max(
    1,
    Math.ceil((placement.blockHeightPx + 4) / ROW_HEIGHT_PX)
  );
  const isPast =
    typeof placement.post.isPast === "boolean" ? placement.post.isPast : false;

  return (
    // eslint-disable-next-line jsx-a11y/no-static-element-interactions -- hover expand; focus/blur already mirror mouse for keyboard
    <div
      className={`w-full min-w-0 transition-[height] duration-200 ease-out ${
        isHovered ? EXPANDED_BLOCK_WRAPPER_CLASS : "relative"
      }`}
      style={{
        height: placement.blockHeightPx,
        zIndex: isHovered ? CALENDAR_BLOCK_EXPANDED_Z : CALENDAR_BLOCK_BASE_Z,
      }}
      onMouseEnter={() => onHoverOverlayChange(hoverOverlayPayload)}
      onMouseLeave={(e) => {
        if (isMovingIntoDayHoverOverlay(e.relatedTarget)) return;
        onHoverOverlayChange(null);
      }}
      onFocus={() => onHoverOverlayChange(hoverOverlayPayload)}
      onBlur={() => onHoverOverlayChange(null)}
    >
      <PostBlock
        post={placement.post}
        compact
        user={user}
        queueTypes={queueTypes}
        onEdit={(editedPost) => {
          setActiveEmptySlotKey(null);
          onPostEdit(editedPost);
        }}
        isLongform={
          isAll
            ? Boolean(placement.post.title && placement.post.publishedAt)
            : (isLongform ?? false)
        }
        isPast={isPast}
        forceOpaque={isHovered}
        hideTimeRowPreview
        slotExpandRows={baseRows}
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
  const [dayHoverOverlayPayload, setDayHoverOverlayPayload] =
    useState<DayHoverOverlayPayload | null>(null);
  const [dragOverSlot, setDragOverSlot] = useState<string | null>(null);
  const [isDragOverGrid, setIsDragOverGrid] = useState(false);
  const userTimezone = user?.timezone ?? "Etc/UTC";
  const occupiedRows = useMemo(() => {
    const col0 = new Set<number>();
    const col1 = new Set<number>();
    const multi = new Set<number>();
    const all = new Set<number>();
    const mark = (
      target: Set<number>,
      startRow: number,
      blockHeightPx: number
    ) => {
      const rows = Math.max(1, Math.ceil((blockHeightPx + 4) / ROW_HEIGHT_PX));
      for (let i = 0; i < rows; i++) target.add(startRow + i);
    };
    placements.col0.forEach((p) => {
      mark(col0, p.rowIndex, p.blockHeightPx);
      mark(all, p.rowIndex, p.blockHeightPx);
    });
    placements.col1.forEach((p) => {
      mark(col1, p.rowIndex, p.blockHeightPx);
      mark(all, p.rowIndex, p.blockHeightPx);
    });
    multiPostRows.forEach((row) => {
      mark(multi, row.rowIndex, row.blockHeightPx);
      mark(all, row.rowIndex, row.blockHeightPx);
    });
    return {
      // Single-post lanes should only consider own column + full-width multi rows.
      col0WithMulti: new Set<number>([...col0, ...multi]),
      col1WithMulti: new Set<number>([...col1, ...multi]),
      // Multi-post row spans both columns, so keep global occupancy.
      all,
    };
  }, [placements, multiPostRows]);

  const handleDragOver = useCallback(
    (e: React.DragEvent<HTMLDivElement>, time: string) => {
      if (isCalendarDropSlotInPast(dateKey, time, userTimezone)) {
        setDragOverSlot(null);
        return;
      }
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      setDragOverSlot(`${dateKey}-${time}`);
    },
    [dateKey, userTimezone]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>, time: string) => {
      if (isCalendarDropSlotInPast(dateKey, time, userTimezone)) {
        e.preventDefault();
        setDragOverSlot(null);
        setIsDragOverGrid(false);
        return;
      }
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

  const totalHeightPx = TOTAL_TIME_SLOTS * ROW_HEIGHT_PX;

  const getDropTimeFromPointer = (
    clientX: number,
    clientY: number
  ): string | null => {
    const gridEl = document
      .elementFromPoint(clientX, clientY)
      ?.closest('[data-calendar-day-grid="true"]') as HTMLDivElement | null;
    if (!gridEl) return null;
    const rect = gridEl.getBoundingClientRect();
    const localY = clientY - rect.top;
    if (localY < 0 || localY >= rect.height) return null;
    const rowIndex = Math.max(
      0,
      Math.min(hours.length - 1, Math.floor(localY / ROW_HEIGHT_PX))
    );
    return hours[rowIndex] ?? null;
  };

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
          data-calendar-day-grid="true"
          className="relative min-w-0 flex-1"
          style={{ height: totalHeightPx }}
          onDragOverCapture={(e) => {
            const time = getDropTimeFromPointer(e.clientX, e.clientY);
            if (!time) {
              setDragOverSlot(null);
              return;
            }
            handleDragOver(e, time);
            setIsDragOverGrid(true);
          }}
          onDropCapture={(e) => {
            const time = getDropTimeFromPointer(e.clientX, e.clientY);
            if (!time) return;
            handleDrop(e, time);
          }}
          onDragLeave={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const outside =
              e.clientX < rect.left ||
              e.clientX > rect.right ||
              e.clientY < rect.top ||
              e.clientY > rect.bottom;
            if (outside) {
              setDragOverSlot(null);
              setIsDragOverGrid(false);
            }
          }}
          onMouseLeave={() => {
            setHoveredSlotKey(null);
            setHoveredMultiPostKey(null);
            setDayHoverOverlayPayload(null);
          }}
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
              {placements.col0.map((p) => {
                const baseRows = Math.max(
                  1,
                  Math.ceil((p.blockHeightPx + 4) / ROW_HEIGHT_PX)
                );
                const hoverLayout = getDayHoverLayoutMetrics(
                  p.rowIndex,
                  baseRows,
                  occupiedRows.col0WithMulti,
                  TOTAL_TIME_SLOTS
                );
                const overlayPayload: DayHoverOverlayPayload = {
                  key: p.slotKey,
                  source: "single",
                  post: p.post,
                  time: p.time,
                  rowIndex: p.rowIndex,
                  columnIndex: 0,
                  leftCss: "0%",
                  widthCss: "50%",
                  topPx: hoverLayout.topPx,
                  heightPx: hoverLayout.hoverHeightPx,
                  expandedRows: hoverLayout.hoverRows,
                  isLongform: isAll
                    ? Boolean(p.post.title && p.post.publishedAt)
                    : isLongform,
                  isPast:
                    typeof p.post.isPast === "boolean" ? p.post.isPast : false,
                };

                return (
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
                      hoverOverlayPayload={overlayPayload}
                      onHoverOverlayChange={(payload) => {
                        const isActive = payload !== null;
                        setHoveredSlotKey(isActive ? p.slotKey : null);
                        setHoveredMultiPostKey(null);
                        setDayHoverOverlayPayload(payload);
                      }}
                      onPostEdit={onPostEdit}
                      setActiveEmptySlotKey={setActiveEmptySlotKey}
                      user={user}
                      queueTypes={queueTypes}
                      isLongform={isLongform}
                      isAll={isAll}
                    />
                  </div>
                );
              })}
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
              {placements.col1.map((p) => {
                const baseRows = Math.max(
                  1,
                  Math.ceil((p.blockHeightPx + 4) / ROW_HEIGHT_PX)
                );
                const hoverLayout = getDayHoverLayoutMetrics(
                  p.rowIndex,
                  baseRows,
                  occupiedRows.col1WithMulti,
                  TOTAL_TIME_SLOTS
                );
                const overlayPayload: DayHoverOverlayPayload = {
                  key: p.slotKey,
                  source: "single",
                  post: p.post,
                  time: p.time,
                  rowIndex: p.rowIndex,
                  columnIndex: 1,
                  leftCss: "50%",
                  widthCss: "50%",
                  topPx: hoverLayout.topPx,
                  heightPx: hoverLayout.hoverHeightPx,
                  expandedRows: hoverLayout.hoverRows,
                  isLongform: isAll
                    ? Boolean(p.post.title && p.post.publishedAt)
                    : isLongform,
                  isPast:
                    typeof p.post.isPast === "boolean" ? p.post.isPast : false,
                };

                return (
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
                      hoverOverlayPayload={overlayPayload}
                      onHoverOverlayChange={(payload) => {
                        const isActive = payload !== null;
                        setHoveredSlotKey(isActive ? p.slotKey : null);
                        setHoveredMultiPostKey(null);
                        setDayHoverOverlayPayload(payload);
                      }}
                      onPostEdit={onPostEdit}
                      setActiveEmptySlotKey={setActiveEmptySlotKey}
                      user={user}
                      queueTypes={queueTypes}
                      isLongform={isLongform}
                      isAll={isAll}
                    />
                  </div>
                );
              })}
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
                  onMouseLeave={(e) => {
                    if (isMovingIntoDayHoverOverlay(e.relatedTarget)) return;
                    setHoveredMultiPostKey(null);
                    setDayHoverOverlayPayload(null);
                  }}
                >
                  {row.posts.map((post, postIndex) => {
                    const key = `${row.time}-${post.id}-${postIndex}`;
                    const isHovered = hoveredMultiPostKey === key;
                    const baseRows = Math.max(
                      1,
                      Math.ceil((row.blockHeightPx + 4) / ROW_HEIGHT_PX)
                    );
                    const hoverLayout = getDayHoverLayoutMetrics(
                      row.rowIndex,
                      baseRows,
                      occupiedRows.all,
                      TOTAL_TIME_SLOTS
                    );
                    const overlayPayload: DayHoverOverlayPayload = {
                      key,
                      source: "multi",
                      post,
                      time: row.time,
                      rowIndex: row.rowIndex,
                      columnIndex: postIndex,
                      leftCss: `${(postIndex * 100) / row.posts.length}%`,
                      widthCss: `${100 / row.posts.length}%`,
                      topPx: hoverLayout.topPx,
                      heightPx: hoverLayout.hoverHeightPx,
                      expandedRows: hoverLayout.hoverRows,
                      isLongform: isAll
                        ? Boolean(post.title && post.publishedAt)
                        : isLongform,
                      isPast:
                        typeof post.isPast === "boolean" ? post.isPast : false,
                    };

                    return (
                      // eslint-disable-next-line jsx-a11y/no-static-element-interactions -- Hover/focus/touch wrapper controlling expansion state; interactive PostBlock lives inside
                      <div
                        key={post.id}
                        className={`relative min-w-0 flex-1 overflow-hidden rounded-[var(--calendar-radius-md)] ${
                          isHovered
                            ? "bg-[hsl(var(--calendar-surface-2-bg))]"
                            : ""
                        }`}
                        style={{
                          height: row.blockHeightPx,
                          zIndex: isHovered
                            ? CALENDAR_BLOCK_EXPANDED_Z
                            : CALENDAR_BLOCK_BASE_Z,
                        }}
                        onMouseEnter={() => {
                          setHoveredSlotKey(null);
                          setHoveredMultiPostKey(key);
                          setDayHoverOverlayPayload(overlayPayload);
                        }}
                        onFocusCapture={() => {
                          setHoveredSlotKey(null);
                          setHoveredMultiPostKey(key);
                          setDayHoverOverlayPayload(overlayPayload);
                        }}
                        onBlurCapture={() => {
                          setHoveredMultiPostKey(null);
                          setDayHoverOverlayPayload(null);
                        }}
                        onTouchStart={() => {
                          setHoveredSlotKey(null);
                          setHoveredMultiPostKey(key);
                          setDayHoverOverlayPayload(overlayPayload);
                        }}
                        onTouchEnd={() => {
                          setTimeout(() => {
                            setHoveredMultiPostKey(null);
                            setDayHoverOverlayPayload(null);
                          }, 300);
                        }}
                      >
                        <PostBlock
                          post={post}
                          compact
                          multipleInCell
                          user={user}
                          queueTypes={queueTypes}
                          onEdit={(editedPost) => {
                            setActiveEmptySlotKey(null);
                            onPostEdit(editedPost);
                          }}
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
                          slotExpandRows={baseRows}
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

          {dayHoverOverlayPayload ? (
            <div
              className="pointer-events-none absolute inset-0"
              style={{ zIndex: CALENDAR_HOVER_OVERLAY_Z }}
            >
              {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions -- Overlay hover retention area for expanded post preview */}
              <div
                className={`pointer-events-auto absolute px-0.5 ${EXPANDED_BLOCK_WRAPPER_CLASS}`}
                data-day-hover-overlay="true"
                style={{
                  top: dayHoverOverlayPayload.topPx,
                  left: dayHoverOverlayPayload.leftCss,
                  width: dayHoverOverlayPayload.widthCss,
                  height: dayHoverOverlayPayload.heightPx,
                }}
                onMouseEnter={() => {
                  setDayHoverOverlayPayload(dayHoverOverlayPayload);
                  if (dayHoverOverlayPayload.source === "single") {
                    setHoveredSlotKey(dayHoverOverlayPayload.key);
                    setHoveredMultiPostKey(null);
                  } else {
                    setHoveredSlotKey(null);
                    setHoveredMultiPostKey(dayHoverOverlayPayload.key);
                  }
                }}
                onMouseDown={(e) => {
                  // Ensure single click selects even if pointer lands on overlay wrapper.
                  if (e.target !== e.currentTarget) return;
                  setActiveEmptySlotKey(null);
                  onPostEdit(dayHoverOverlayPayload.post);
                }}
                onMouseLeave={() => {
                  setHoveredSlotKey(null);
                  setHoveredMultiPostKey(null);
                  setDayHoverOverlayPayload(null);
                }}
              >
                <PostBlock
                  post={dayHoverOverlayPayload.post}
                  compact
                  multipleInCell={dayHoverOverlayPayload.source === "multi"}
                  user={user}
                  queueTypes={queueTypes}
                  onEdit={(editedPost) => {
                    setActiveEmptySlotKey(null);
                    onPostEdit(editedPost);
                  }}
                  isLongform={dayHoverOverlayPayload.isLongform}
                  isPast={dayHoverOverlayPayload.isPast}
                  forceOpaque
                  hideTimeRowPreview
                  slotExpandRows={dayHoverOverlayPayload.expandedRows}
                />
              </div>
            </div>
          ) : null}

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
