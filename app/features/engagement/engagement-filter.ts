/**
 * Shared filter helpers for engagement feed (unread filter, flat list).
 */

import type { GroupedNotification } from "./types";

export type EngagementItemStateMap = Record<
  string,
  {
    state:
      | "UNHANDLED"
      | "DRAFTED"
      | "SCHEDULED"
      | "REPLIED"
      | "IGNORED"
      | "SNOOZED"
      | "HANDLED";
    repliedFromApp: boolean;
    snoozedUntil?: string | null;
  }
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

/** Apply power filters: high reputation (trust >= 60), following only. */
export function applyPowerFilters(
  groups: GroupedNotification[],
  trustScores: Record<string, number>,
  filterHighReputation: boolean,
  filterFollowingOnly: boolean,
  followedPubkeys: Set<string>
): GroupedNotification[] {
  return groups
    .map((group) => ({
      ...group,
      notifications: group.notifications.filter((n) => {
        if (filterFollowingOnly && followedPubkeys.size > 0) {
          const authorPubkey =
            n.type === "zap"
              ? (n as { senderPubkey?: string }).senderPubkey
              : n.pubkey;
          if (!authorPubkey || !followedPubkeys.has(authorPubkey)) return false;
        }
        if (filterHighReputation) {
          const score = n.pubkey ? trustScores[n.pubkey] : undefined;
          if (score === undefined || score < 60) return false;
        }
        return true;
      }),
    }))
    .filter((group) => group.notifications.length > 0);
}

export type EngagementSortBy =
  | "newest"
  | "oldest"
  | "trust"
  | "zaps"
  | "most_engaged";

/** Engagement signal: likes, thread replies, reposts, zaps (sats weighted lightly). */
function mostEngagedScore(n: GroupedNotification["notifications"][0]): number {
  const s = n.stats;
  if (!s) return 0;
  return s.likes + s.replies * 2 + s.reposts + s.zaps + s.satszapped / 1000;
}

/** Sort groups and their notifications. Newest preserves loader order. */
export function applySort(
  groups: GroupedNotification[],
  trustScores: Record<string, number>,
  sortBy: EngagementSortBy
): GroupedNotification[] {
  if (sortBy === "newest") return groups;

  if (sortBy === "oldest") {
    return groups
      .map((group) => ({
        ...group,
        notifications: [...group.notifications].sort(
          (a, b) => a.createdAt - b.createdAt
        ),
      }))
      .sort((ga, gb) => {
        const maxA = Math.max(...ga.notifications.map((n) => n.createdAt), 0);
        const maxB = Math.max(...gb.notifications.map((n) => n.createdAt), 0);
        return maxA - maxB;
      });
  }

  const trustOrZapsScore = (n: GroupedNotification["notifications"][0]) => {
    if (sortBy === "trust") {
      return n.pubkey ? (trustScores[n.pubkey] ?? 0) : 0;
    }
    if (sortBy === "zaps") {
      return n.stats?.satszapped ?? n.stats?.zaps ?? 0;
    }
    return 0;
  };

  if (sortBy === "trust" || sortBy === "zaps") {
    return groups
      .map((group) => ({
        ...group,
        notifications: [...group.notifications].sort(
          (a, b) => trustOrZapsScore(b) - trustOrZapsScore(a)
        ),
      }))
      .sort((ga, gb) => {
        const maxA = Math.max(
          ...ga.notifications.map((n) => trustOrZapsScore(n)),
          0
        );
        const maxB = Math.max(
          ...gb.notifications.map((n) => trustOrZapsScore(n)),
          0
        );
        return maxB - maxA;
      });
  }

  // most_engaged
  return groups
    .map((group) => ({
      ...group,
      notifications: [...group.notifications].sort(
        (a, b) => mostEngagedScore(b) - mostEngagedScore(a)
      ),
    }))
    .sort((ga, gb) => {
      const maxA = Math.max(
        ...ga.notifications.map((n) => mostEngagedScore(n)),
        0
      );
      const maxB = Math.max(
        ...gb.notifications.map((n) => mostEngagedScore(n)),
        0
      );
      return maxB - maxA;
    });
}

export function applyWorkflowFilters(
  groups: GroupedNotification[],
  engagementItemStates: EngagementItemStateMap,
  engagementLinkedActions: Record<string, Array<{ kind: string }>>,
  options: {
    unhandledOnly: boolean;
    hasDraft: boolean;
    hasScheduledAction: boolean;
    needsResponse: boolean;
    includeScheduledInNeedsResponse: boolean;
  }
): GroupedNotification[] {
  return groups
    .map((group) => ({
      ...group,
      notifications: group.notifications.filter((n) => {
        const state = engagementItemStates[n.eventId];
        const links = engagementLinkedActions[n.eventId] ?? [];
        const hasDraft = links.some((l) => l.kind === "DRAFT");
        const hasScheduled = links.some((l) => l.kind.startsWith("SCHEDULED_"));
        if (options.unhandledOnly) {
          if (
            state &&
            state.state !== "UNHANDLED" &&
            state.state !== "DRAFTED" &&
            state.state !== "SCHEDULED"
          ) {
            return false;
          }
        }
        if (options.hasDraft && !hasDraft) return false;
        if (options.hasScheduledAction && !hasScheduled) return false;
        if (options.needsResponse) {
          if (state?.state === "IGNORED" || state?.state === "SNOOZED")
            return false;
          if (state?.state === "REPLIED" || state?.state === "HANDLED")
            return false;
          if (!options.includeScheduledInNeedsResponse && hasScheduled)
            return false;
        }
        return true;
      }),
    }))
    .filter((group) => group.notifications.length > 0);
}
