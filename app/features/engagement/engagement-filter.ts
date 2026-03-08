/**
 * Shared filter helpers for engagement feed (unread filter, flat list).
 */

import type { GroupedNotification } from "./types";

export type EngagementItemStateMap = Record<
  string,
  { state: "handled"; repliedFromApp: boolean }
>;

/**
 * Filter to only notifications newer than lastCheckedAt (time-based unread).
 * lastCheckedAtMs: timestamp in ms (from lastCheckedAt ISO string), or null for no filter.
 */
export function filterByUnreadSince(
  groups: GroupedNotification[] | undefined | null,
  lastCheckedAtMs: number | null
): GroupedNotification[] {
  const list = Array.isArray(groups) ? groups : [];
  if (lastCheckedAtMs === null) return list;
  return list
    .map((group) => ({
      ...group,
      notifications: group.notifications.filter(
        (n) => n.createdAt * 1000 > lastCheckedAtMs
      ),
    }))
    .filter((group) => group.notifications.length > 0);
}

/** Count of notification items in filtered groups (for keyboard list length). */
export function getFlatItemCount(groups: GroupedNotification[]): number {
  return groups.reduce((sum, g) => sum + g.notifications.length, 0);
}

/** Apply power filters: high reputation (trust >= 60), mentions only. */
export function applyPowerFilters(
  groups: GroupedNotification[],
  trustScores: Record<string, number>,
  filterHighReputation: boolean,
  filterMentionsOnly: boolean
): GroupedNotification[] {
  return groups
    .map((group) => ({
      ...group,
      notifications: group.notifications.filter((n) => {
        if (filterMentionsOnly && n.type !== "mention") return false;
        if (filterHighReputation) {
          const score = n.pubkey ? trustScores[n.pubkey] : undefined;
          if (score === undefined || score < 60) return false;
        }
        return true;
      }),
    }))
    .filter((group) => group.notifications.length > 0);
}

export type EngagementSortBy = "newest" | "trust" | "zaps";

/** Sort groups and their notifications by trust or zaps. Newest = no change. */
export function applySort(
  groups: GroupedNotification[],
  trustScores: Record<string, number>,
  sortBy: EngagementSortBy
): GroupedNotification[] {
  if (sortBy === "newest") return groups;

  const score = (n: GroupedNotification["notifications"][0]) => {
    if (sortBy === "trust") {
      return n.pubkey ? (trustScores[n.pubkey] ?? 0) : 0;
    }
    return n.stats?.satszapped ?? n.stats?.zaps ?? 0;
  };

  return groups
    .map((group) => ({
      ...group,
      notifications: [...group.notifications].sort(
        (a, b) => score(b) - score(a)
      ),
    }))
    .sort((ga, gb) => {
      const maxA = Math.max(...ga.notifications.map((n) => score(n)), 0);
      const maxB = Math.max(...gb.notifications.map((n) => score(n)), 0);
      return maxB - maxA;
    });
}
