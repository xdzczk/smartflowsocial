import type { EngagementLoaderData } from "~/lib/validation/schemas/loader-responses.schemas";

/** Safe empty payload for engagement feed when the loader fails or before data exists. */
export const ENGAGEMENT_LOADER_FALLBACK: EngagementLoaderData = {
  posts: [],
  stats: {},
  user: null,
  notifications: {
    all: [],
    replies: [],
    mentions: [],
    zaps: [],
    quotes: [],
  },
  groupedNotifications: {
    replies: [],
    quotes: [],
    mentions: [],
  },
  trustScores: {},
  engagementItemStates: {},
  engagementLinkedActions: {},
  groupSummaries: {},
  lastCheckedAt: null,
  followedPubkeys: [],
};
