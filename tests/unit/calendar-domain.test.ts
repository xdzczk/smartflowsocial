/**
 * Unit tests for Calendar domain layer: getSlotState, getDayViewColumnMap, expand rules.
 */

import { describe, it, expect } from "vitest";

import { getDayViewColumnMap } from "~/features/posts/components/Calendar/domain/day-view-column-map";
import {
  getDayViewMaxExpand,
  getExpandDown,
  getWeekViewMaxExpand,
  hasBlocksUnderneath,
} from "~/features/posts/components/Calendar/domain/expand-rules";
import type { PostsGrid } from "~/features/posts/components/Calendar/domain/grid-types";
import { getSlotState } from "~/features/posts/components/Calendar/domain/slot-state";
import type { CalendarPost } from "~/features/posts/components/Calendar/PostBlock.types";

function minimalPost(id: string): CalendarPost {
  /* eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- minimal fixture for domain tests */
  return { id, caption: "", scheduledFor: "" } as CalendarPost;
}

describe("Calendar domain", () => {
  describe("getDayViewMaxExpand", () => {
    it("returns 0 for 0 posts", () => {
      expect(getDayViewMaxExpand(0)).toBe(0);
    });
    it("returns 6 for 1-2 posts", () => {
      expect(getDayViewMaxExpand(1)).toBe(6);
      expect(getDayViewMaxExpand(2)).toBe(6);
    });
    it("returns 4 for 3-4 posts", () => {
      expect(getDayViewMaxExpand(3)).toBe(4);
      expect(getDayViewMaxExpand(4)).toBe(4);
    });
    it("returns 2 for 5+ posts", () => {
      expect(getDayViewMaxExpand(5)).toBe(2);
    });
  });

  describe("getWeekViewMaxExpand", () => {
    it("returns 0 for 0 posts", () => {
      expect(getWeekViewMaxExpand(0)).toBe(0);
    });
    it("returns 3 for 1 post", () => {
      expect(getWeekViewMaxExpand(1)).toBe(3);
    });
    it("returns 2 for 2 posts", () => {
      expect(getWeekViewMaxExpand(2)).toBe(2);
    });
    it("returns 1 for 3-4 posts", () => {
      expect(getWeekViewMaxExpand(3)).toBe(1);
      expect(getWeekViewMaxExpand(4)).toBe(1);
    });
    it("returns 0 for 5+ posts", () => {
      expect(getWeekViewMaxExpand(5)).toBe(0);
    });
  });

  describe("getExpandDown", () => {
    it("returns 0 when slot is last or not in hours", () => {
      const grid: PostsGrid = {};
      expect(
        getExpandDown("2025-02-17", "23:30", grid, ["09:00", "23:30"], 3)
      ).toBe(0);
      expect(
        getExpandDown("2025-02-17", "10:00", grid, ["09:00", "09:30"], 3)
      ).toBe(0);
    });
    it("returns count of consecutive empty slots below", () => {
      const grid: PostsGrid = {
        "2025-02-17": {
          "09:00": [minimalPost("1")],
          "09:30": [],
          "10:00": [],
          "10:30": [],
          "11:00": [minimalPost("2")],
        },
      };
      const hours = ["09:00", "09:30", "10:00", "10:30", "11:00"];
      expect(getExpandDown("2025-02-17", "09:00", grid, hours, 6)).toBe(3); // 09:30, 10:00, 10:30 empty; 11:00 has post
      expect(getExpandDown("2025-02-17", "09:00", grid, hours, 2)).toBe(2); // capped at maxEmptySlots 2
      expect(getExpandDown("2025-02-17", "09:30", grid, hours, 3)).toBe(2); // 10:00, 10:30 empty then 11:00 has post
    });
  });

  describe("hasBlocksUnderneath", () => {
    it("returns false when slot baseRows below is out of range or has no posts", () => {
      const grid: PostsGrid = { "2025-02-17": { "10:00": [minimalPost("1")] } };
      const hours = ["09:00", "09:30", "10:00", "10:30"];
      expect(hasBlocksUnderneath("2025-02-17", "09:00", 1, grid, hours)).toBe(
        false
      ); // 09:30 empty
      expect(hasBlocksUnderneath("2025-02-17", "10:30", 1, grid, hours)).toBe(
        false
      ); // below index out of range
    });
    it("returns true when slot baseRows below has posts", () => {
      const grid: PostsGrid = {
        "2025-02-17": { "09:00": [], "09:30": [], "10:00": [minimalPost("1")] },
      };
      const hours = ["09:00", "09:30", "10:00"];
      expect(hasBlocksUnderneath("2025-02-17", "09:00", 2, grid, hours)).toBe(
        true
      ); // 09:00 + 2 rows = 10:00 has post
    });
  });

  describe("getDayViewColumnMap", () => {
    it("returns empty map for empty grid", () => {
      const grid: PostsGrid = { "2025-02-17": {} };
      const hours = ["09:00", "09:30", "10:00"];
      expect(getDayViewColumnMap(grid, "2025-02-17", hours)).toEqual({});
    });
    it("assigns alternating columns when both columns free for consecutive single-post slots", () => {
      const grid: PostsGrid = {
        "2025-02-17": {
          "09:00": [minimalPost("1")],
          "09:30": [minimalPost("2")],
          "10:00": [minimalPost("3")],
        },
      };
      const hours = ["09:00", "09:30", "10:00", "10:30"];
      const map = getDayViewColumnMap(grid, "2025-02-17", hours);
      expect(map["2025-02-17-09:00"]).toBeDefined();
      expect(map["2025-02-17-09:30"]).toBeDefined();
      expect(map["2025-02-17-10:00"]).toBeDefined();
      // First two slots both free -> alternate 0, 1
      expect([map["2025-02-17-09:00"], map["2025-02-17-09:30"]]).toContain(0);
      expect([map["2025-02-17-09:00"], map["2025-02-17-09:30"]]).toContain(1);
    });
    it("skips slots with not exactly one post", () => {
      const grid: PostsGrid = {
        "2025-02-17": {
          "09:00": [minimalPost("1"), minimalPost("2")],
          "09:30": [minimalPost("3")],
        },
      };
      const hours = ["09:00", "09:30"];
      const map = getDayViewColumnMap(grid, "2025-02-17", hours);
      expect(map["2025-02-17-09:00"]).toBeUndefined();
      expect(map["2025-02-17-09:30"]).toBe(0);
    });
  });

  describe("getSlotState", () => {
    const hours = ["09:00", "09:30", "10:00", "10:30"];
    const baseOptions = {
      hoveredPostKey: null as string | null,
      dragOverSlot: null as string | null,
      isDayView: false,
      userTimezone: "UTC",
    };

    it("returns expandRows 1 and correct blockHeightPx for empty slot", () => {
      const grid: PostsGrid = { "2025-02-17": {} };
      const state = getSlotState(
        "2025-02-17",
        "09:00",
        grid,
        hours,
        baseOptions
      );
      expect(state.posts).toHaveLength(0);
      expect(state.expandRows).toBe(1);
      expect(state.blockHeightPx).toBe(52 - 4);
      expect(state.singlePostKey).toBeNull();
      expect(state.isHovered).toBe(false);
    });

    it("returns singlePostKey and isHovered when hoveredPostKey matches", () => {
      const p = minimalPost("1");
      const grid: PostsGrid = { "2025-02-17": { "09:00": [p] } };
      const state = getSlotState("2025-02-17", "09:00", grid, hours, {
        ...baseOptions,
        hoveredPostKey: "2025-02-17-09:00-1",
      });
      expect(state.singlePostKey).toBe("2025-02-17-09:00-1");
      expect(state.isHovered).toBe(true);
    });

    it("returns noExpandOnHover true for week view 3-row slot with post below", () => {
      const grid: PostsGrid = {
        "2025-02-17": {
          "09:00": [minimalPost("1")],
          "09:30": [],
          "10:00": [],
          "10:30": [minimalPost("2")],
        },
      };
      const state = getSlotState("2025-02-17", "09:00", grid, hours, {
        ...baseOptions,
        isDayView: false,
      });
      // 1 post -> maxExpand 3 -> expandDown 2 (09:30, 10:00 empty) -> baseRows 3; 10:30 has post so hasBlocksUnderneath true
      expect(state.expandRows).toBe(3);
      expect(state.noExpandOnHover).toBe(true);
    });

    it("caps hovered single-post week slot at 3 rows when 4th row conflicts below", () => {
      const grid: PostsGrid = {
        "2025-02-17": {
          "09:00": [minimalPost("1")],
          "09:30": [],
          "10:00": [],
          "10:30": [minimalPost("2")],
        },
      };
      const state = getSlotState("2025-02-17", "09:00", grid, hours, {
        ...baseOptions,
        hoveredPostKey: "2025-02-17-09:00-1",
        isDayView: false,
      });
      expect(state.isHovered).toBe(true);
      expect(state.expandRows).toBe(3);
      expect(state.noExpandOnHover).toBe(true);
    });

    it("caps hovered single-post week slot at 3 rows when one conflicting slot exists 2 rows below", () => {
      const grid: PostsGrid = {
        "2025-02-17": {
          "09:00": [minimalPost("1")],
          "09:30": [],
          "10:00": [minimalPost("2")],
          "10:30": [],
        },
      };
      const state = getSlotState("2025-02-17", "09:00", grid, hours, {
        ...baseOptions,
        hoveredPostKey: "2025-02-17-09:00-1",
        isDayView: false,
      });
      expect(state.isHovered).toBe(true);
      expect(state.expandRows).toBe(3);
      expect(state.noExpandOnHover).toBe(true);
    });

    it("returns isDragOver when dragOverSlot matches slotKey", () => {
      const grid: PostsGrid = { "2025-02-17": { "09:00": [minimalPost("1")] } };
      const state = getSlotState("2025-02-17", "09:00", grid, hours, {
        ...baseOptions,
        dragOverSlot: "2025-02-17-09:00",
      });
      expect(state.isDragOver).toBe(true);
    });
  });
});
