/**
 * Build a date grid (dateKey → sorted posts) from scheduled and past posts.
 * Single source of truth for "posts by day" for Month view.
 * dateKey format: YYYY-MM-DD in user timezone.
 */

import { fromDate } from "~/lib/temporal";

import type { CalendarPost } from "../PostBlock.types";
import { getPostScheduleInstant } from "../PostBlock.utils";

export type PostsByDate = Record<string, CalendarPost[]>;

export interface PostsToDateGridOptions {
  userTimezone: string;
  isLongform: boolean;
  isAll: boolean;
}

/**
 * Merges scheduled (isPast: false) and past (isPast: true); groups by dateKey (YYYY-MM-DD in user TZ);
 * sorts each day's array by getPostScheduleInstant.
 */
export function postsToDateGrid(
  scheduledPosts: CalendarPost[],
  pastPosts: CalendarPost[],
  options: PostsToDateGridOptions
): PostsByDate {
  const { userTimezone, isLongform, isAll } = options;
  const grouped: PostsByDate = {};

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
    const dateKey = `${year}-${month}-${dayStr}`;
    grouped[dateKey] ??= [];
    grouped[dateKey].push({ ...post, isPast });
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

  Object.keys(grouped).forEach((dateKey) => {
    grouped[dateKey]?.sort(sortBySchedule);
  });

  return grouped;
}
