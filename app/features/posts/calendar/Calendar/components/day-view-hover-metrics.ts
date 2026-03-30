import { ROW_HEIGHT_PX } from "./weekly-view-constants";

export interface DayHoverLayout {
  targetRows: number;
  hoverRows: number;
  hoverHeightPx: number;
  topPx: number;
}

export function isMovingIntoDayHoverOverlay(
  nextTarget: EventTarget | null
): boolean {
  if (!(nextTarget instanceof HTMLElement)) return false;
  return nextTarget.closest('[data-day-hover-overlay="true"]') !== null;
}

export function getDayHoverTargetRows(baseRows: number): number {
  return baseRows <= 4 ? 5 : baseRows;
}

export function getDayHoverLayoutMetrics(
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
