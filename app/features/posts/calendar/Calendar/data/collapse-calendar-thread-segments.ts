/**
 * Scheduled thread segments share `threadGroupId`. The calendar shows one card per
 * burst (posts whose schedule times chain within a small gap), not one per segment,
 * so rapid thread segments are not noisy duplicate tiles.
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
 * When consecutive posts in the same `threadGroupId` are farther apart than this,
 * they appear as separate calendar cards (e.g. main thread vs repost hours later).
 */
const CALENDAR_THREAD_GROUP_CHAIN_GAP_MS = 45 * 60 * 1000;

interface ScoredTag {
  tagged: Tagged;
  ms: number;
}

function pickEarliestInCluster(
  items: Tagged[],
  isLongform: boolean,
  isAll: boolean
): Tagged {
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
    return sorted[0]!;
  }

  return best;
}

function clusterByScheduleChainGap(
  scored: ScoredTag[],
  gapMs: number
): Tagged[][] {
  const sorted = [...scored].sort((a, b) => {
    if (a.ms !== b.ms) return a.ms - b.ms;
    return a.tagged.post.id.localeCompare(b.tagged.post.id);
  });

  const clusters: ScoredTag[][] = [];
  for (const row of sorted) {
    const lastCluster = clusters[clusters.length - 1];
    const lastRow = lastCluster?.[lastCluster.length - 1];
    if (
      lastCluster === undefined ||
      lastRow === undefined ||
      row.ms - lastRow.ms > gapMs
    ) {
      clusters.push([row]);
    } else {
      lastCluster.push(row);
    }
  }

  return clusters.map((c) => c.map((r) => r.tagged));
}

/**
 * Collapses posts that share `threadGroupId` when their schedule times form a tight
 * chain (within {@link CALENDAR_THREAD_GROUP_CHAIN_GAP_MS}). Queue follow-ups scheduled
 * far from the thread burst stay on their own tile.
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

    const scored: ScoredTag[] = [];
    const nullSchedule: Tagged[] = [];

    for (const taggedItem of items) {
      const isPast = taggedItem.source === "past";
      const postIsLongform = getPostIsLongform(
        taggedItem.post,
        isLongform,
        isAll
      );
      const ms = getPostScheduleInstant(
        taggedItem.post,
        postIsLongform,
        isPast
      );
      if (ms == null) {
        nullSchedule.push(taggedItem);
      } else {
        scored.push({ tagged: taggedItem, ms });
      }
    }

    const clusters: Tagged[][] = [];

    if (scored.length > 0) {
      clusters.push(
        ...clusterByScheduleChainGap(scored, CALENDAR_THREAD_GROUP_CHAIN_GAP_MS)
      );
    }

    if (nullSchedule.length > 0) {
      clusters.push(nullSchedule);
    }

    for (const cluster of clusters) {
      if (cluster.length <= 1) continue;

      const best = pickEarliestInCluster(cluster, isLongform, isAll);

      for (const item of cluster) {
        if (item.post.id !== best.post.id) {
          dropIds.add(item.post.id);
        }
      }
    }
  }

  return {
    scheduledPosts: scheduledPosts.filter((p) => !dropIds.has(p.id)),
    pastPosts: pastPosts.filter((p) => !dropIds.has(p.id)),
  };
}
