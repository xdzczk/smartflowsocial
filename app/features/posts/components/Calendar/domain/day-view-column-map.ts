/**
 * Day view: assign single-post slots to column 0 (left) or 1 (right),
 * alternating when both columns are free to maximise space.
 */

import { getDayViewMaxExpand, getExpandDown } from "./expand-rules";
import type { PostsGrid } from "./grid-types";

export function getDayViewColumnMap(
  postsGrid: PostsGrid,
  dateKey: string,
  hours: string[]
): Record<string, 0 | 1> {
  const map: Record<string, 0 | 1> = {};
  let column0End = 0;
  let column1End = 0;
  let nextCol: 0 | 1 = 0;
  for (let timeIdx = 0; timeIdx < hours.length; timeIdx++) {
    const time = hours[timeIdx];
    if (time === undefined) continue;
    const posts = postsGrid[dateKey]?.[time] ?? [];
    if (posts.length !== 1) continue;
    const expandDown = getExpandDown(
      dateKey,
      time,
      postsGrid,
      hours,
      getDayViewMaxExpand(1)
    );
    const baseRows = 1 + expandDown;
    const slotKey = `${dateKey}-${time}`;
    const start = timeIdx;
    const end = timeIdx + baseRows;
    const bothFree = start >= column0End && start >= column1End;
    if (bothFree) {
      map[slotKey] = nextCol;
      nextCol = nextCol === 0 ? 1 : 0;
      if (map[slotKey] === 0) column0End = end;
      else column1End = end;
    } else if (start >= column0End) {
      map[slotKey] = 0;
      column0End = end;
    } else if (start >= column1End) {
      map[slotKey] = 1;
      column1End = end;
    } else {
      const useCol = column0End <= column1End ? 0 : 1;
      map[slotKey] = useCol;
      if (useCol === 0) column0End = end;
      else column1End = end;
    }
  }
  return map;
}
