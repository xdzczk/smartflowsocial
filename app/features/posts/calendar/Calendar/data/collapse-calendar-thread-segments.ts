/**
 * Scheduled thread segments share `threadGroupId`. The calendar should show one
 * card per thread (the earliest scheduled segment), not one per segment.
 */

import { getPostIsLongform } from "../calendar-helpers";
import type { CalendarPost } from "../PostBlock.types";
import { getPostScheduleInstant } from "../PostBlock.utils";

export interface CollapseCalendarThreadSegmentsOptions {
  isLongform: boolean;
  isAll: boolean;
}

interface Tagged {
  post: CalendarPost;
  source: "scheduled" | "past";
}

/**
 * Drops follow-up thread segments so each `threadGroupId` appears at most once
 * (the segment with the earliest schedule instant in user-visible terms).
 */
export function collapseCalendarThreadSegments(
  scheduledPosts: CalendarPost[],
  pastPosts: CalendarPost[],
  options: CollapseCalendarThreadSegmentsOptions
): { scheduledPosts: CalendarPost[]; pastPosts: CalendarPost[] } {
  const { isLongform, isAll } = options;

  const tagged: Tagged[] = [
    ...scheduledPosts.map((post) => ({ post, source: "scheduled" as const })),
    ...pastPosts.map((post) => ({ post, source: "past" as const })),
  ];

  const groups = new Map<string, Tagged[]>();

  for (const item of tagged) {
    const gid = item.post.threadGroupId;
    if (typeof gid === "string" && gid.length > 0) {
      const arr = groups.get(gid) ?? [];
      arr.push(item);
      groups.set(gid, arr);
    }
  }

  const dropIds = new Set<string>();

  for (const [, items] of groups) {
    if (items.length <= 1) continue;

    let best: Tagged | null = null;
    let bestMs = Infinity;

    for (const item of items) {
      const isPast = item.source === "past";
      const postIsLongform = getPostIsLongform(item.post, isLongform, isAll);
      const ms = getPostScheduleInstant(item.post, postIsLongform, isPast);
      if (ms == null) continue;
      if (
        best === null ||
        ms < bestMs ||
        (ms === bestMs && item.post.id < best.post.id)
      ) {
        bestMs = ms;
        best = item;
      }
    }

    if (best === null) {
      const sorted = [...items].sort((a, b) =>
        a.post.id.localeCompare(b.post.id)
      );
      best = sorted[0]!;
    }

    for (const item of items) {
      if (item.post.id !== best.post.id) {
        dropIds.add(item.post.id);
      }
    }
  }

  return {
    scheduledPosts: scheduledPosts.filter((p) => !dropIds.has(p.id)),
    pastPosts: pastPosts.filter((p) => !dropIds.has(p.id)),
  };
}
