/**
 * Smoke test: WeekView export and props contract.
 * Required by Calendar refactor plan (Phase 5).
 * Full render test is in integration (calendar-loader) and e2e (calendar.cy.ts).
 */

import { describe, it, expect } from "vitest";

import type { CalendarPost } from "~/features/posts/components/Calendar/PostBlock.types";
import { WeekView } from "~/features/posts/components/Calendar/views/WeekView";
import type { WeekViewProps } from "~/features/posts/components/Calendar/views/WeekView";

describe("WeekView smoke", () => {
  it("exports a function component", () => {
    expect(typeof WeekView).toBe("function");
  });

  it("accepts required props shape", () => {
    const props: WeekViewProps = {
      scheduledPosts: [] as CalendarPost[],
      pastPosts: [],
      currentDate: new Date("2025-02-17"),
      onPostDrop: (_post: CalendarPost, _date: Date) => {},
      onPostEdit: (_post: CalendarPost) => {},
    };
    expect(() => WeekView(props)).not.toThrow();
  });
});
