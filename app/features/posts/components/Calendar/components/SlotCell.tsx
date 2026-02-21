import type { SlotState } from "../domain/grid-types";

import { SlotCellContent, type SlotCellContentProps } from "./SlotCellContent";
import { MOBILE_WEEK_DAY_COLUMN_WIDTH } from "./weekly-view-constants";

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
  isDayView: boolean;
  dayViewColumnMap: Record<string, 0 | 1>;
}

export function SlotCell({
  slotState,
  time,
  isDayView,
  slotColumn: _slotColumn,
  rowIndex,
  availableRowsBelow,
  hoveredPostKey,
  setHoveredPostKey,
  hoveredPostKeyByColumn,
  setHoveredPostKeyForColumn,
  onPostEdit,
  user,
  queueTypes,
  isLongform,
  isAll,
  activeEmptySlotKey,
  setActiveEmptySlotKey,
  onClearSelection,
  hoveredSlotKey,
  setHoveredSlotKey,
  onDragOver,
  onDrop,
  onDragLeave,
  formatDropSlotAriaLabel,
  dateLocale,
  userTimezone,
  isMobile,
  dayViewColumnMap,
}: SlotCellProps) {
  const cellHasHoveredPost = slotState.posts.some((p) => {
    const key = `${slotState.dateKey}-${time}-${p.id}`;
    if (hoveredPostKeyByColumn)
      return (
        hoveredPostKeyByColumn[0] === key || hoveredPostKeyByColumn[1] === key
      );
    return hoveredPostKey === key;
  });
  const cellRaised =
    cellHasHoveredPost || (isDayView && hoveredSlotKey === slotState.slotKey);
  const cellZClass =
    cellHasHoveredPost && isDayView ? "z-[41]" : cellRaised ? "z-[40]" : "";
  const mobileWeekCellStyle =
    isMobile && !isDayView
      ? {
          width: MOBILE_WEEK_DAY_COLUMN_WIDTH,
          minWidth: MOBILE_WEEK_DAY_COLUMN_WIDTH,
          flex: "0 0 auto" as const,
        }
      : undefined;

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
      className={`border-border/30 relative overflow-visible border-r px-1.5 py-1 transition-colors duration-200 last:border-r-0 ${
        isMobile && !isDayView ? "min-w-0 shrink-0" : "min-w-[3.5rem] flex-1"
      } ${cellZClass} ${
        slotState.isDragOver
          ? "bg-primary/5 border-primary/20"
          : isDayView
            ? ""
            : "dark:hover:bg-muted hover:bg-muted"
      }`}
      style={mobileWeekCellStyle}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragLeave={onDragLeave}
      onMouseEnter={
        isDayView ? () => setHoveredSlotKey(slotState.slotKey) : undefined
      }
      onMouseLeave={isDayView ? () => setHoveredSlotKey(null) : undefined}
    >
      <SlotCellContent
        slotState={slotState}
        time={time}
        isDayView={isDayView}
        slotColumn={
          isDayView ? (dayViewColumnMap[slotState.slotKey] ?? 0) : undefined
        }
        rowIndex={rowIndex}
        availableRowsBelow={availableRowsBelow}
        hoveredPostKey={hoveredPostKey}
        setHoveredPostKey={setHoveredPostKey}
        hoveredPostKeyByColumn={hoveredPostKeyByColumn}
        setHoveredPostKeyForColumn={setHoveredPostKeyForColumn}
        onPostEdit={onPostEdit}
        user={user}
        queueTypes={queueTypes}
        isLongform={isLongform}
        isAll={isAll}
        activeEmptySlotKey={activeEmptySlotKey}
        setActiveEmptySlotKey={setActiveEmptySlotKey}
        onClearSelection={onClearSelection}
      />
    </div>
  );
}
