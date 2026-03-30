import { connectToPrimalCache } from "~/features/cache/primalCache.server";
import type { PostData } from "~/features/posts/types";

import {
  groupNotificationsByParent,
  processQuoteReposts,
  type Notification,
} from "../engagement.server";
import { calculateTrustScore, type User } from "../trust-score";
import type {
  EngagementGroupSummary,
  EngagementLinkedAction,
  EventStats,
  GroupedNotification,
  NotificationEvent,
  NotificationMention,
} from "../types";

import {
  filterLowTrustNotifications,
  filterMutedNotifications,
} from "./engagement-loader-filters.server";
import { fetchUserProfile } from "./engagement-loader-profile.server";

/**
 * Merge grouped notifications by parent `eventId`, deduping child notifications by `eventId`.
 */
export function mergeGroupedNotificationsByParent(
  a: GroupedNotification[],
  b: GroupedNotification[]
): GroupedNotification[] {
  const map = new Map<string, GroupedNotification>();

  function absorb(group: GroupedNotification) {
    const key = group.parentPost.eventId;
    const existing = map.get(key);
    if (!existing) {
      map.set(key, {
        parentPost: { ...group.parentPost },
        notifications: [...group.notifications],
      });
      return;
    }
    const seen = new Set(existing.notifications.map((n) => n.eventId));
    for (const n of group.notifications) {
      if (!seen.has(n.eventId)) {
        existing.notifications.push(n);
        seen.add(n.eventId);
      }
    }
    existing.notifications.sort((x, y) => y.createdAt - x.createdAt);
  }

  for (const g of a) absorb(g);
  for (const g of b) absorb(g);

  return [...map.values()].sort((g1, g2) => {
    const latest = (g: GroupedNotification) =>
      Math.max(0, ...g.notifications.map((n) => n.createdAt));
    return latest(g2) - latest(g1);
  });
}

export async function processAndGroupQuoteReposts(
  rawQuoteReposts: NotificationEvent[],
  userPubkeyHex: string,
  userFilterMuted: boolean,
  userHidePostsFromLowTrustUsers: boolean,
  mutedNpubs: string[],
  userProfilesMap: Map<string, User>,
  trustScoresMap: Map<string, number>,
  postsAsPostData: PostData[],
  stats: Record<string, EventStats>
): Promise<GroupedNotification[]> {
  if (rawQuoteReposts.length === 0) return [];
  let quoteRepostNotifications: Notification[] = await processQuoteReposts(
    rawQuoteReposts,
    connectToPrimalCache
  );
  if (userFilterMuted && mutedNpubs.length > 0) {
    quoteRepostNotifications = filterMutedNotifications(
      quoteRepostNotifications,
      mutedNpubs
    );
  }
  const quoteUniquePubkeys = Array.from(
    new Set(quoteRepostNotifications.map((n) => n.pubkey))
  );
  const quoteProfilePromises = quoteUniquePubkeys.map(async (pubkey) => {
    if (!userProfilesMap.has(pubkey)) {
      const userProfile = await fetchUserProfile(pubkey);
      if (userProfile) {
        userProfilesMap.set(pubkey, userProfile);
        trustScoresMap.set(pubkey, calculateTrustScore(userProfile));
      }
    }
  });
  await Promise.all(quoteProfilePromises);
  if (userHidePostsFromLowTrustUsers) {
    quoteRepostNotifications = filterLowTrustNotifications(
      quoteRepostNotifications,
      trustScoresMap
    );
  }
  return groupNotificationsByParent(
    quoteRepostNotifications,
    postsAsPostData,
    [],
    stats
  );
}

/** Author pubkey of a notification (for self-filter). */
function getNotificationAuthorPubkey(n: Notification): string {
  return n.type === "zap"
    ? (n as { senderPubkey: string }).senderPubkey
    : n.pubkey;
}

/** Remove notifications from groups where the author is the current user (case-insensitive). */
export function filterGroupedExcludingUser(
  groups: GroupedNotification[],
  userPubkeyHex: string
): GroupedNotification[] {
  const userLower = userPubkeyHex.toLowerCase();
  return groups
    .map((group) => ({
      ...group,
      notifications: group.notifications.filter(
        (n) => getNotificationAuthorPubkey(n).toLowerCase() !== userLower
      ),
    }))
    .filter((group) => group.notifications.length > 0);
}

export function enrichGroupedParentAuthorPictures(
  groups: GroupedNotification[],
  userProfilesMap: Map<string, User>
): GroupedNotification[] {
  return groups.map((g) => {
    const pic = userProfilesMap.get(g.parentPost.pubkey)?.picture;
    return {
      ...g,
      parentPost: {
        ...g.parentPost,
        authorPicture: pic ?? g.parentPost.authorPicture ?? null,
      },
    };
  });
}

export function enrichGlobalMentionNotificationsWithProfiles(
  notifications: NotificationMention[],
  userProfilesMap: Map<string, User>
): NotificationMention[] {
  return notifications.map((n) => {
    const u = userProfilesMap.get(n.pubkey);
    if (!u) return n;
    return {
      ...n,
      authorName: u.displayName ?? u.name ?? n.authorName,
      authorPicture: u.picture ?? n.authorPicture ?? null,
      authorNip05: u.nip05 ?? n.authorNip05,
    };
  });
}

/** Serialize grouped notifications for JSON response (publishedAt → ISO string). */
export function serializeGroupedForResponse(
  groups: GroupedNotification[]
): GroupedNotification[] {
  return groups.map((group) => ({
    ...group,
    parentPost: {
      ...group.parentPost,
      publishedAt: group.parentPost.publishedAt
        ? group.parentPost.publishedAt.toISOString()
        : null,
    },
  })) as GroupedNotification[];
}

export function computeGroupSummaries(params: {
  groups: GroupedNotification[];
  states: Record<
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
  linked: Record<string, EngagementLinkedAction[]>;
}): Record<string, EngagementGroupSummary> {
  const { groups, states, linked } = params;
  const summaries: Record<string, EngagementGroupSummary> = {};
  for (const group of groups) {
    let drafted = 0;
    let scheduled = 0;
    let handled = 0;
    let needResponse = 0;
    const total = group.notifications.length;
    for (const notification of group.notifications) {
      const eventId = notification.eventId;
      const state = states[eventId];
      const links = linked[eventId] ?? [];
      const hasScheduled = links.some((action) =>
        action.kind.startsWith("SCHEDULED_")
      );
      const hasDraft = links.some((action) => action.kind === "DRAFT");
      if (hasDraft || state?.state === "DRAFTED") drafted += 1;
      if (hasScheduled || state?.state === "SCHEDULED") scheduled += 1;
      if (
        state?.state === "REPLIED" ||
        state?.state === "HANDLED" ||
        state?.state === "IGNORED"
      ) {
        handled += 1;
      }
      const isSuppressed =
        state?.state === "IGNORED" ||
        state?.state === "SNOOZED" ||
        hasScheduled ||
        state?.state === "REPLIED" ||
        state?.state === "HANDLED";
      if (!isSuppressed) needResponse += 1;
    }
    summaries[group.parentPost.eventId] = {
      total,
      needResponse,
      drafted,
      scheduled,
      handled,
    };
  }
  return summaries;
}
