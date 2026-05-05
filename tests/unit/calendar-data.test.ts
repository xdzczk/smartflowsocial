/**
 * Unit tests for Calendar data layer: postsToTimeGrid, postsToDateGrid, parseDropToDateTime.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

import { collapseCalendarThreadSegments } from "~/features/posts/calendar/Calendar/data/collapse-calendar-thread-segments";
import { parseDropToDateTime } from "~/features/posts/calendar/Calendar/data/parse-drop-to-date-time";
import { postsToDateGrid } from "~/features/posts/calendar/Calendar/data/posts-to-date-grid";
import { postsToTimeGrid } from "~/features/posts/calendar/Calendar/data/posts-to-time-grid";
import type { CalendarPost } from "~/features/posts/calendar/Calendar/PostBlock.types";

vi.mock("~/features/posts/calendar/Calendar/PostBlock.utils", () => ({
  getPostScheduleInstant: (
    post: CalendarPost,
    _isLongform: boolean,
    isPast: boolean
  ) => {
    if (isPast && post.publishedAt) {
      const d =
        post.publishedAt instanceof Date
          ? post.publishedAt
          : new Date(post.publishedAt);
      return d.getTime();
    }
    if (!isPast && (post as { scheduledFor?: string }).scheduledFor) {
      const s = (post as { scheduledFor: string }).scheduledFor;
      const ms = Number(s) * 1000;
      return Number.isNaN(ms) ? null : ms;
    }
    return null;
  },
}));

describe("Calendar data layer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("postsToTimeGrid", () => {
    it("initializes all dateKeys with empty slot maps", () => {
      const dateKeys = ["2025-02-17", "2025-02-18"];
      const timeSlots = ["09:00", "09:30"];
      const grid = postsToTimeGrid([], [], dateKeys, timeSlots, {
        userTimezone: "UTC",
        isLongform: false,
        isAll: false,
      });
      expect(Object.keys(grid)).toEqual(dateKeys);
      expect(grid["2025-02-17"]).toEqual({});
      expect(grid["2025-02-18"]).toEqual({});
    });

    it("assigns scheduled post to correct dateKey and timeSlot", () => {
      // Minimal post for test; getPostScheduleInstant is mocked and only needs id, scheduledFor
      /* eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- minimal test fixture; full CalendarPost has 20+ required fields */
      const post = {
        id: "1",
        caption: "Test",
        scheduledFor: String(
          Math.floor(new Date("2025-02-17T09:30:00Z").getTime() / 1000)
        ),
      } as CalendarPost;
      const dateKeys = ["2025-02-17"];
      const timeSlots = ["09:00", "09:30"];
      const grid = postsToTimeGrid([post], [], dateKeys, timeSlots, {
        userTimezone: "UTC",
        isLongform: false,
        isAll: false,
      });
      expect(grid["2025-02-17"]?.["09:30"]).toHaveLength(1);
      expect(grid["2025-02-17"]?.["09:30"]?.[0]).toMatchObject({
        id: "1",
        isPast: false,
      });
    });
  });

  describe("postsToDateGrid", () => {
    it("returns empty object when no posts", () => {
      const result = postsToDateGrid([], [], {
        userTimezone: "UTC",
        isLongform: false,
        isAll: false,
      });
      expect(result).toEqual({});
    });

    it("groups posts by dateKey and sets isPast", () => {
      // Minimal post for test; getPostScheduleInstant is mocked and only needs id, scheduledFor
      /* eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- minimal test fixture; full CalendarPost has 20+ required fields */
      const post = {
        id: "1",
        caption: "Test",
        scheduledFor: String(
          Math.floor(new Date("2025-02-17T14:00:00Z").getTime() / 1000)
        ),
      } as CalendarPost;
      const result = postsToDateGrid([post], [], {
        userTimezone: "UTC",
        isLongform: false,
        isAll: false,
      });
      expect(result["2025-02-17"]).toHaveLength(1);
      expect(result["2025-02-17"]?.[0]).toMatchObject({
        id: "1",
        isPast: false,
      });
    });
  });

  describe("parseDropToDateTime", () => {
    it("parses YYYY-MM-DDTHH:mm in UTC and returns Date", () => {
      const d = parseDropToDateTime("2025-02-17T09:30", "UTC");
      expect(d).toBeInstanceOf(Date);
      expect(d.toISOString()).toMatch(/2025-02-17T09:30/);
    });

    it("parses date-only with time default", () => {
      const d = parseDropToDateTime("2025-02-17T09:00", "UTC");
      expect(d.getUTCHours()).toBe(9);
      expect(d.getUTCMinutes()).toBe(0);
    });
  });

  describe("collapseCalendarThreadSegments", () => {
    const gid = "thread_same_group";

    it("keeps one post per thread burst (earliest schedule within chain gap)", () => {
      const earlyTs = Math.floor(
        new Date("2025-02-17T09:00:00Z").getTime() / 1000
      );
      const lateTs = Math.floor(
        new Date("2025-02-17T09:35:00Z").getTime() / 1000
      );
      /* eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- fixtures */
      const a = {
        id: "seg-a",
        caption: "a",
        threadGroupId: gid,
        scheduledFor: String(earlyTs),
      } as CalendarPost;
      /* eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- fixtures */
      const b = {
        id: "seg-b",
        caption: "b",
        threadGroupId: gid,
        scheduledFor: String(lateTs),
      } as CalendarPost;

      const out = collapseCalendarThreadSegments([a, b], [], {
        isLongform: false,
        isAll: false,
      });
      expect(out.scheduledPosts.map((p) => p.id)).toEqual(["seg-a"]);
      expect(out.pastPosts).toEqual([]);
    });

    it("merges attached follow-ups into the thread row when scheduled within the chain gap", () => {
      const earlyTs = Math.floor(
        new Date("2025-02-17T09:00:00Z").getTime() / 1000
      );
      const soonTs = Math.floor(
        new Date("2025-02-17T09:08:00Z").getTime() / 1000
      );
      /* eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- fixtures */
      const segment = {
        id: "seg-main",
        caption: "main",
        threadGroupId: gid,
        scheduledFor: String(earlyTs),
      } as CalendarPost;
      /* eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- fixtures */
      const attachedSoon = {
        id: "fu-attached",
        caption: "follow-up",
        threadGroupId: gid,
        scheduledFor: String(soonTs),
        dependencyMode: "attached" as const,
        postKind: "REPOST",
      } as CalendarPost;

      const out = collapseCalendarThreadSegments([segment, attachedSoon], [], {
        isLongform: false,
        isAll: false,
      });
      expect(out.scheduledPosts.map((p) => p.id)).toEqual(["seg-main"]);
    });

    it("keeps attached follow-ups as separate cards when scheduled beyond the thread chain gap", () => {
      const earlyTs = Math.floor(
        new Date("2025-02-17T09:00:00Z").getTime() / 1000
      );
      const lateTs = Math.floor(
        new Date("2025-02-17T10:00:00Z").getTime() / 1000
      );
      /* eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- fixtures */
      const segment = {
        id: "seg-main",
        caption: "main",
        threadGroupId: gid,
        scheduledFor: String(earlyTs),
      } as CalendarPost;
      /* eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- fixtures */
      const attachedFollowUp = {
        id: "fu-attached",
        caption: "follow-up",
        threadGroupId: gid,
        scheduledFor: String(lateTs),
        dependencyMode: "attached" as const,
        postKind: "REPOST",
      } as CalendarPost;

      const out = collapseCalendarThreadSegments(
        [segment, attachedFollowUp],
        [],
        {
          isLongform: false,
          isAll: false,
        }
      );
      expect(out.scheduledPosts.map((p) => p.id).sort()).toEqual([
        "fu-attached",
        "seg-main",
      ]);
    });

    it("does not merge posts without threadGroupId", () => {
      /* eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- fixtures */
      const p1 = {
        id: "x",
        caption: "x",
        scheduledFor: String(
          Math.floor(new Date("2025-02-17T12:00:00Z").getTime() / 1000)
        ),
      } as CalendarPost;
      /* eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- fixtures */
      const p2 = {
        id: "y",
        caption: "y",
        scheduledFor: String(
          Math.floor(new Date("2025-02-17T13:00:00Z").getTime() / 1000)
        ),
      } as CalendarPost;

      const out = collapseCalendarThreadSegments([p1, p2], [], {
        isLongform: false,
        isAll: false,
      });
      expect(out.scheduledPosts).toHaveLength(2);
    });
  });
});
