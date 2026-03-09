/**
 * Build a time-grid (dateKey → timeSlot → posts) from scheduled and past posts.
 * Single source of truth for "posts in calendar time shape" for Day/Week views.
 */

import { fromDate } from "~/lib/temporal";

import type { CalendarPost } from "../PostBlock.types";
import { getPostScheduleInstant } from "../PostBlock.utils";

export type PostsGrid = Record<string, Record<string, CalendarPost[]>>;

export interface PostsToTimeGridOptions {
  userTimezone: string;
  isLongform: boolean;
  isAll: boolean;
}

/**
 * Merges scheduled (isPast: false) and past (isPast: true) posts into a grid.
 * Initializes all dateKeys with empty slot maps so every key exists.
 * Callers pass dateKeys (YYYY-MM-DD in user timezone) for the visible range.
 */
export function postsToTimeGrid(
  scheduledPosts: CalendarPost[],
  pastPosts: CalendarPost[],
  dateKeys: string[],
  timeSlots: string[],
  options: PostsToTimeGridOptions
): PostsGrid {
  const { userTimezone, isLongform, isAll } = options;
  const grid: PostsGrid = {};

  dateKeys.forEach((dateKey) => {
    grid[dateKey] = {};
  });

  const assignPost = (post: CalendarPost, isPast: boolean) => {
    const postIsLongform = Boolean(
      isAll ? !!post.title && post.publishedAt : isLongform
    );
    const ms = getPostScheduleInstant(post, postIsLongform, isPast);
    if (ms == null) return;
    const timeInUserTz = fromDate(new Date(ms), userTimezone);
    const year = timeInUserTz.year;
    const month = String(timeInUserTz.month).padStart(2, "0");
    const dayStr = String(timeInUserTz.day).padStart(2, "0");
    const dk = `${year}-${month}-${dayStr}`;
    const hour = timeInUserTz.hour;
    const minutes = timeInUserTz.minute;
    const timeSlot = `${hour.toString().padStart(2, "0")}:${minutes >= 30 ? "30" : "00"}`;

    if (grid[dk]) {
      grid[dk][timeSlot] ??= [];
      grid[dk][timeSlot].push({ ...post, isPast });
    }
  };

  scheduledPosts.forEach((post) => assignPost(post, false));
  pastPosts.forEach((post) => assignPost(post, true));

  const sortBySchedule = (a: CalendarPost, b: CalendarPost) => {
    const aLongform = Boolean(isAll ? !!a.title && a.publishedAt : isLongform);
    const bLongform = Boolean(isAll ? !!b.title && b.publishedAt : isLongform);
    const aMs = getPostScheduleInstant(a, aLongform, Boolean(a.isPast)) ?? 0;
    const bMs = getPostScheduleInstant(b, bLongform, Boolean(b.isPast)) ?? 0;
    return aMs - bMs;
  };

  dateKeys.forEach((dateKey) => {
    const daySlots = grid[dateKey];
    if (!daySlots) return;
    timeSlots.forEach((timeSlot) => {
      const arr = daySlots[timeSlot];
      if (arr) arr.sort(sortBySchedule);
    });
  });

  return grid;
}
