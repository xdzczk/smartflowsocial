import type { SlotState } from "../domain/grid-types";

import { SlotCellContent, type SlotCellContentProps } from "./SlotCellContent";
import {
  CALENDAR_HOVERED_CELL_Z,
  MOBILE_WEEK_DAY_COLUMN_WIDTH,
} from "./weekly-view-constants";

export interface SlotCellProps extends SlotCellContentProps {
  slotState: SlotState;
  /** For day view: set on cell hover so empty-slot UI can show. */
  hoveredSlotKey: string | null;
  setHoveredSlotKey: (key: string | null) => void;
  onDragOver: (e: React.DragEvent<HTMLDivElement>) => void;
  onDrop: (e: React.DragEvent<HTMLDivElement>) => void;
  onDragLeave: () => void;
  formatDropSlotAriaLabel: (
    dateKey: string,
    time: string,
    userTimezone: string,
    dateLocale?: string
  ) => string;
  dateLocale: string;
  userTimezone: string;
  isMobile: boolean;
}

export function SlotCell({
  slotState,
  time,
  rowIndex,
  availableRowsBelow,
  hoveredPostKey,
  setHoveredPostKey,
  onPostEdit,
  user,
  queueTypes,
  isLongform,
  isAll,
  activeEmptySlotKey,
  setActiveEmptySlotKey,
  columnIndex,
  onHoverOverlayChange,
  onClearSelection,
  hoveredSlotKey: _hoveredSlotKey,
  setHoveredSlotKey: _setHoveredSlotKey,
  onDragOver,
  onDrop,
  onDragLeave,
  formatDropSlotAriaLabel,
  dateLocale,
  userTimezone,
  isMobile,
  selectedPost,
}: SlotCellProps) {
  const cellHasHoveredPost =
    hoveredPostKey?.startsWith(`${slotState.dateKey}-${time}-`) ?? false;
  const mobileWeekCellStyle = isMobile
    ? {
        width: MOBILE_WEEK_DAY_COLUMN_WIDTH,
        minWidth: MOBILE_WEEK_DAY_COLUMN_WIDTH,
        flex: "0 0 auto" as const,
      }
    : undefined;
  const cellStyle = {
    ...(mobileWeekCellStyle ?? {}),
    ...(cellHasHoveredPost ? { zIndex: CALENDAR_HOVERED_CELL_Z } : {}),
  };

  return (
    <div
      key={slotState.slotKey}
      role="gridcell"
      tabIndex={-1}
      aria-label={formatDropSlotAriaLabel(
        slotState.dateKey,
        time,
        userTimezone,
        dateLocale
      )}
      aria-dropeffect="move"
      className={`border-border/30 motion-base relative overflow-visible border-r px-1.5 py-1 last:border-r-0 ${
        isMobile ? "min-w-0 shrink-0" : "min-w-[3.5rem] flex-1"
      } ${
        slotState.isDragOver
          ? "bg-border-subtle/70 border-border-strong/45"
          : "dark:hover:bg-surface-hover hover:bg-surface-hover"
      }`}
      style={cellStyle}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragLeave={onDragLeave}
    >
      <SlotCellContent
        slotState={slotState}
        time={time}
        rowIndex={rowIndex}
        availableRowsBelow={availableRowsBelow}
        isMobile={isMobile}
        hoveredPostKey={hoveredPostKey}
        setHoveredPostKey={setHoveredPostKey}
        onPostEdit={onPostEdit}
        user={user}
        queueTypes={queueTypes}
        isLongform={isLongform}
        isAll={isAll}
        activeEmptySlotKey={activeEmptySlotKey}
        setActiveEmptySlotKey={setActiveEmptySlotKey}
        columnIndex={columnIndex}
        onHoverOverlayChange={onHoverOverlayChange}
        onClearSelection={onClearSelection}
        selectedPost={selectedPost}
      />
    </div>
  );
}
