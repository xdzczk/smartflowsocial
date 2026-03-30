import { getFollowedPubkeys } from "~/features/nostr/social-graph.server";
import { toPostDTOArray } from "~/features/posts/dtos";
import { getPublishedPosts } from "~/features/posts/server";
import type { UserWithHashTagPresets } from "~/features/user";
import { getUserById } from "~/features/user";
import {
  getEngagementLastCheckedAt,
  updateEngagementLastCheckedAt,
} from "~/features/user/services/user-settings.server";
import { logError } from "~/lib/error-logger.server";
import { nostrAdapter } from "~/lib/nostr-adapter.server";

import { ENGAGEMENT_FEED_PAGE_SIZE } from "../constants";
import { getEngagementItemStates } from "../engagement-mark-state.server";
import {
  groupNotificationsByParent,
  groupNotificationsByType,
} from "../engagement.server";
import { findLinkedActionsByEventIds } from "../repositories/engagement-item-state.server";
import { calculateTrustScore, type User } from "../trust-score";
import type {
  EngagementLinkedAction,
  EventStats,
  Notification,
} from "../types";

import {
  computeGroupSummaries,
  enrichGroupedParentAuthorPictures,
  filterGroupedExcludingUser,
  mergeGroupedNotificationsByParent,
  serializeGroupedForResponse,
} from "./engagement-loader-notifications.server";
import {
  collectEventIdsFromGroupedNotificationGroups,
  loadPrimalSupplementalEngagementData,
} from "./engagement-loader-primal.server";
import { fetchUserProfile } from "./engagement-loader-profile.server";
import {
  buildFallbackStatsFromPosts,
  fetchStatsAndNotificationsForPublishedPosts,
  getEventIdsFromPosts,
  getMutedNpubsFromUser,
  mapPublishedPostsToPostData,
} from "./engagement-loader-stats.server";
import { loadPrimalGetNotificationsResult } from "./engagement-primal-notifications.server";

/** Primal `get_notifications` payload size (global mentions + quotes). */
const PRIMAL_NOTIFICATIONS_LIMIT = 200;

const PUBKEY_HEX64 = /^[0-9a-f]{64}$/i;

async function loadEngagementFeedWorkflowState(
  userId: string,
  allEventIds: string[]
): Promise<{
  engagementItemStates: Awaited<ReturnType<typeof getEngagementItemStates>>;
  engagementLinkedActions: Record<string, EngagementLinkedAction[]>;
}> {
  let engagementItemStates: Awaited<
    ReturnType<typeof getEngagementItemStates>
  > = {};
  try {
    engagementItemStates = await getEngagementItemStates(userId, allEventIds);
  } catch (error) {
    logError(error instanceof Error ? error : new Error(String(error)), {
      message:
        "Failed to load engagement item states; continuing without workflow state",
      userId,
    });
  }

  let engagementLinkedActions: Record<string, EngagementLinkedAction[]> = {};
  try {
    const linkedActionsRows = await findLinkedActionsByEventIds(
      userId,
      allEventIds
    );
    engagementLinkedActions = linkedActionsRows.reduce<
      Record<string, EngagementLinkedAction[]>
    >((acc, row) => {
      const key = row.eventId;
      acc[key] ??= [];
      acc[key].push({
        kind: row.kind,
        postId: row.postId,
        draftId: row.draftId,
        queueTypeId: row.queueTypeId,
        label: row.label,
        scheduledFor: row.scheduledFor?.toISOString() ?? null,
        isCanceled: row.isCanceled,
        isPublished: row.isPublished,
      });
      return acc;
    }, {});
  } catch (error) {
    logError(error instanceof Error ? error : new Error(String(error)), {
      message:
        "Failed to load engagement linked actions; continuing without links",
      userId,
    });
  }

  return { engagementItemStates, engagementLinkedActions };
}

/**
 * Load engagement feed data
 */
export async function loadEngagementFeedData(
  userId: string,
  page = 1,
  limit = ENGAGEMENT_FEED_PAGE_SIZE
) {
  const [{ posts }, userResult, lastCheckedAt] = await Promise.all([
    getPublishedPosts({
      userId,
      page,
      limit,
      queueType: "all",
    }),
    getUserById(userId),
    getEngagementLastCheckedAt(userId),
  ]);

  if (!userResult) throw new Error("User not found");
  const user: UserWithHashTagPresets = userResult;
  const npub = user.npub;
  const userPubkeyHex = nostrAdapter.decodeNpub(npub) ?? npub;
  const mutedNpubs = getMutedNpubsFromUser(user);
  const eventIds = getEventIdsFromPosts(posts);

  const followedPubkeysPromise = getFollowedPubkeys(userPubkeyHex);

  // Global mentions + quotes from Primal (not scoped to SmartFlow-published roots).
  // `get_notifications` is on Primal public caches; open-source app.jl may omit it — use
  // MENTIONS_USE_PRIMAL_GET_NOTIFICATIONS=false or rely on relay fallback when empty/failed.
  const notificationsResultPromise = loadPrimalGetNotificationsResult({
    pubkey: userPubkeyHex,
    limit: PRIMAL_NOTIFICATIONS_LIMIT,
  });

  let stats: Record<string, EventStats> = {};
  let allNotifications: Notification[] = [];
  const userProfilesMap = new Map<string, User>();
  const trustScoresMap = new Map<string, number>();

  if (PUBKEY_HEX64.test(userPubkeyHex)) {
    const selfProfile = await fetchUserProfile(userPubkeyHex);
    if (selfProfile) {
      userProfilesMap.set(userPubkeyHex, selfProfile);
      trustScoresMap.set(userPubkeyHex, calculateTrustScore(selfProfile));
    }
  }

  try {
    const fetched = await fetchStatsAndNotificationsForPublishedPosts({
      eventIds,
      userPubkeyHex,
      user,
      mutedNpubs,
      posts,
      userProfilesMap,
      trustScoresMap,
    });
    stats = fetched.stats;
    allNotifications = fetched.allNotifications;
  } catch (error) {
    logError(error instanceof Error ? error : new Error(String(error)), {
      message: "Error fetching engagement stats",
    });
    stats = buildFallbackStatsFromPosts(posts);
  }

  const groupedNotifications = groupNotificationsByType(allNotifications);

  const postsAsPostData = mapPublishedPostsToPostData(posts);

  const groupedByParentReplies = groupNotificationsByParent(
    groupedNotifications.replies,
    postsAsPostData,
    [],
    stats
  );

  const groupedThreadMentions = groupNotificationsByParent(
    groupedNotifications.mentions,
    postsAsPostData,
    [],
    stats
  );

  const {
    groupedGlobalMentions,
    groupedQuoteReposts,
    globalMentionNotifications,
  } = await loadPrimalSupplementalEngagementData({
    notificationsResultPromise,
    allNotifications,
    user,
    userPubkeyHex,
    mutedNpubs,
    userProfilesMap,
    trustScoresMap,
    postsAsPostData,
    stats,
  });

  const mergedMentionGroups = mergeGroupedNotificationsByParent(
    groupedThreadMentions,
    groupedGlobalMentions
  );

  const groupedByParent = {
    replies: groupedByParentReplies,
    mentions: mergedMentionGroups,
  };

  const notificationsForResponse = {
    ...groupedNotifications,
    mentions: [...groupedNotifications.mentions, ...globalMentionNotifications],
    all: [...groupedNotifications.all, ...globalMentionNotifications],
  };

  const trustScores: Record<string, number> = {};
  trustScoresMap.forEach((score, pubkey) => {
    trustScores[pubkey] = score;
  });

  const allEventIds = collectEventIdsFromGroupedNotificationGroups(
    groupedByParent.replies,
    groupedQuoteReposts,
    groupedByParent.mentions
  );
  const { engagementItemStates, engagementLinkedActions } =
    await loadEngagementFeedWorkflowState(user.id, allEventIds);

  const postsAsDTOs = toPostDTOArray(postsAsPostData);
  const serializedGroupedReplies = serializeGroupedForResponse(
    enrichGroupedParentAuthorPictures(groupedByParent.replies, userProfilesMap)
  );
  const quotesExcludingSelf = enrichGroupedParentAuthorPictures(
    filterGroupedExcludingUser(groupedQuoteReposts, userPubkeyHex),
    userProfilesMap
  );
  const mentionsExcludingSelf = enrichGroupedParentAuthorPictures(
    filterGroupedExcludingUser(groupedByParent.mentions, userPubkeyHex),
    userProfilesMap
  );
  const serializedGroupedQuotes =
    serializeGroupedForResponse(quotesExcludingSelf);
  const serializedGroupedMentions = serializeGroupedForResponse(
    mentionsExcludingSelf
  );
  const allVisibleGroups = [
    ...serializedGroupedReplies,
    ...serializedGroupedQuotes,
    ...serializedGroupedMentions,
  ];
  const groupSummaries = computeGroupSummaries({
    groups: allVisibleGroups,
    states: engagementItemStates,
    linked: engagementLinkedActions,
  });

  if (page === 1) {
    await updateEngagementLastCheckedAt(userId);
  }

  let followedPubkeys: string[] = [];
  try {
    followedPubkeys = await followedPubkeysPromise;
  } catch (error) {
    logError(error instanceof Error ? error : new Error(String(error)), {
      message:
        "Failed to load follow list for engagement feed; continuing empty",
      userId,
    });
    followedPubkeys = [];
  }

  return {
    posts: postsAsDTOs,
    stats,
    user,
    notifications: notificationsForResponse,
    groupedNotifications: {
      replies: serializedGroupedReplies,
      quotes: serializedGroupedQuotes,
      mentions: serializedGroupedMentions,
    },
    trustScores,
    engagementItemStates,
    engagementLinkedActions,
    groupSummaries,
    lastCheckedAt: lastCheckedAt?.toISOString() ?? null,
    followedPubkeys,
  };
}

/**
 * Load engagement data (alias for loadEngagementFeedData)
 */
export const loadEngagementData = loadEngagementFeedData;
