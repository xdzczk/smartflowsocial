import type { LongFormPostData, PostData } from "~/features/posts/types";
import { logError } from "~/lib/error-logger.server";

import { loadEngagementFeedData } from "./services/engagement-loader.server";
import type {
  EventStats,
  GroupedNotification,
  Notification,
  NotificationEvent,
  NotificationQuoteRepost,
  NostrTag,
  ParentPost,
  PrimalEvent,
  UserProfile,
} from "./types";

// Re-export types for consumers
export type {
  EventStats,
  GroupedNotifications,
  Notification,
  NotificationQuoteRepost,
  ParentPost,
} from "~/features/engagement/types";

/**
 * Parse thread_view response to extract notifications (replies, mentions, zaps)
 */
export function parseThreadViewNotifications(
  threadViewResponse: unknown[],
  originalEventId: string,
  userPubkey: string,
): Notification[] {
  const notifications: Notification[] = [];
  const userProfiles = new Map<string, UserProfile>();
  const eventStats = new Map<string, EventStats>();

  // First pass: collect all user profiles (kind 0) and stats (kind 10000100)
  for (const item of threadViewResponse) {
    if (!Array.isArray(item) || item[0] !== "EVENT") continue;
    const event = item[2] as { kind?: number; content?: string; pubkey?: string; id?: string; tags?: string[][]; created_at?: number } | undefined;
    if (!event) continue;

    // Collect user profiles (kind 0)
    if (event.kind === 0 && event.content && event.pubkey) {
      try {
        const profile = JSON.parse(event.content) as Record<string, unknown>;
        userProfiles.set(event.pubkey, profile as UserProfile);
      } catch {
        // Ignore parse errors
      }
    }

    // Collect event stats (kind 10000100)
    if (event.kind === 10000100 && event.content) {
      try {
        const statsData = JSON.parse(event.content) as {
          event_id?: string;
          likes?: number;
          replies?: number;
          mentions?: number;
          reposts?: number;
          zaps?: number;
          satszapped?: number;
        };
        if (statsData.event_id) {
          eventStats.set(statsData.event_id, {
            likes: statsData.likes ?? 0,
            replies: statsData.replies ?? 0,
            mentions: statsData.mentions ?? 0,
            reposts: statsData.reposts ?? 0,
            zaps: statsData.zaps ?? 0,
            satszapped: statsData.satszapped ?? 0,
          });
        }
      } catch {
        // Ignore parse errors
      }
    }
  }

  // Second pass: collect notifications
  for (const item of threadViewResponse) {
    if (!Array.isArray(item) || item[0] !== "EVENT") continue;
    const event = item[2] as { kind?: number; content?: string; pubkey?: string; id?: string; tags?: string[][]; created_at?: number } | undefined;
    if (!event) continue;

    // Replies and Mentions (kind 1 events that reference the original event)
    if (event.kind === 1 && event.id && event.id !== originalEventId) {
      // Check if this event replies to or mentions the original event
      const eTags = (event.tags?.filter((tag: string[]) => tag[0] === "e") ?? []);
      const pTags = (event.tags?.filter((tag: string[]) => tag[0] === "p") ?? []);

      const targetETag = eTags.find((tag: string[]) => tag[1] === originalEventId);
      const referencesOriginal = !!targetETag;
      const mentionsUser = pTags.some((tag: string[]) => tag[1] === userPubkey);

      if (referencesOriginal && event.pubkey && event.pubkey !== userPubkey) {
        const profile = userProfiles.get(event.pubkey);
        const stats = eventStats.get(event.id);

        // Determine if this is a reply or a mention/quote
        // The 4th element (index 3) in the e tag is the marker
        const marker = targetETag?.[3] as string | undefined;

        // Check if it's a quote post (has nostr:nevent or nostr:note in content)
        const eventContent = event.content ?? "";
        const hasNostrReference =
          eventContent.includes("nostr:nevent") ||
          eventContent.includes("nostr:note") ||
          eventContent.includes("nostr:naddr");

        // It's a mention/quote if:
        // - marker is 'mention' OR marker is undefined/empty AND has nostr reference
        // - NOT a reply (which has 'reply' or 'root' markers)
        const isQuote =
          (!marker || marker === "" || marker === "mention") &&
          hasNostrReference;
        const isReply = marker === "reply" || marker === "root";

        if (isQuote && !isReply && event.id && event.pubkey && event.created_at !== undefined) {
          // This is a quote post/mention
          notifications.push({
            type: "mention",
            id: event.id,
            eventId: event.id,
            content: eventContent,
            createdAt: event.created_at,
            pubkey: event.pubkey,
            authorName: (profile?.display_name ?? profile?.name),
            authorPicture: profile?.picture as string | null | undefined,
            authorNip05: profile?.nip05 as string | undefined,
            originalEventId,
            stats,
          });
        } else if (event.id && event.pubkey && event.created_at !== undefined) {
          // This is a regular reply (has reply/root marker, or no nostr reference)
          notifications.push({
            type: "reply",
            id: event.id,
            eventId: event.id,
            content: eventContent,
            createdAt: event.created_at,
            pubkey: event.pubkey,
            authorName: (profile?.display_name ?? profile?.name),
            authorPicture: profile?.picture as string | null | undefined,
            authorNip05: profile?.nip05 as string | undefined,
            originalEventId,
            stats,
          });
        }
      } else if (mentionsUser && !referencesOriginal && event.pubkey && event.pubkey !== userPubkey && event.id && event.created_at !== undefined) {
        // This is a mention via p tag (user was tagged but not replying to their post)
        const profile = userProfiles.get(event.pubkey);
        const stats = eventStats.get(event.id);
        notifications.push({
          type: "mention",
          id: event.id,
          eventId: event.id,
          content: event.content ?? "",
          createdAt: event.created_at,
          pubkey: event.pubkey,
          authorName: (profile?.display_name ?? profile?.name),
          authorPicture: profile?.picture as string | null | undefined,
          authorNip05: profile?.nip05 as string | undefined,
          originalEventId,
          stats,
        });
      }
    }

    // Zaps (kind 9735)
    if (event.kind === 9735 && event.tags && event.id && event.created_at !== undefined) {
      try {
        // Parse the description tag to get zap request details
        const descTag = event.tags?.find((tag: string[]) => tag[0] === "description");
        if (!descTag?.[1] || typeof descTag[1] !== "string") continue;

        const zapRequest = JSON.parse(descTag[1]) as { tags?: string[][]; pubkey?: string; content?: string };
        const eTags = (event.tags ?? []).filter((tag: string[]) => tag[0] === "e");

        // Check if this zap is for our original event
        const zapForOriginal = eTags.some(
          (tag: string[]) => tag[1] === originalEventId,
        );

        if (zapForOriginal) {
          // Extract amount from bolt11 or amount tag
          const amountTag = zapRequest.tags?.find(
            (tag: string[]) => tag[0] === "amount",
          );
          const amountMsats = amountTag?.[1] ? parseInt(amountTag[1], 10) : 0;
          const amountSats = Math.floor(amountMsats / 1000);

          const senderPubkey = (zapRequest.pubkey ?? event.pubkey) ?? "";
          const profile = senderPubkey ? userProfiles.get(senderPubkey) : undefined;
          const stats = eventStats.get(event.id);

          notifications.push({
            type: "zap",
            id: event.id,
            eventId: event.id,
            content: (event.content ?? zapRequest.content) ?? "",
            createdAt: event.created_at,
            senderPubkey,
            receiverPubkey: userPubkey,
            amountSats,
            senderName: (profile?.display_name ?? profile?.name),
            senderPicture: profile?.picture as string | null | undefined,
            senderNip05: profile?.nip05 as string | undefined,
            pubkey: senderPubkey, // For compatibility
            authorName: (profile?.display_name ?? profile?.name),
            authorPicture: profile?.picture as string | null | undefined,
            authorNip05: profile?.nip05 as string | undefined,
            originalEventId,
            stats,
          });
        }
      } catch {
        // Ignore parse errors
      }
    }
  }

  // Sort by created_at descending (newest first)
  return notifications.sort((a, b) => b.createdAt - a.createdAt);
}

/**
 * Group notifications by type
 */
export function groupNotificationsByType(notifications: Notification[]) {
  return {
    all: notifications,
    replies: notifications.filter((n) => n.type === "reply"),
    mentions: notifications.filter((n) => n.type === "mention"),
    zaps: notifications.filter((n) => n.type === "zap"),
    quotes: notifications.filter((n) => n.type === "quote"),
  };
}

/**
 * Group notifications by their parent event ID and include parent post data
 */
export function groupNotificationsByParent(
  notifications: Notification[],
  posts: PostData[],
  longformPosts: LongFormPostData[],
  stats: Record<string, EventStats> = {},
): GroupedNotification[] {
  // Create a map of event ID to post data
  const postMap = new Map<string, ParentPost>();

  // Add regular posts to map
  posts.forEach((post) => {
    if (!post.signedEvent?.id) return;
    const eventId = post.signedEvent.id;
    postMap.set(eventId, {
      id: post.id,
      eventId,
      pubkey: post.signedEvent.pubkey,
      caption: post.caption ?? null,
      fileUrl: Array.isArray(post.fileUrl) ? post.fileUrl[0] ?? null : post.fileUrl ?? null,
      postedAt: post.postedAt ?? new Date(),
      isLongform: false,
      stats: stats[eventId],
    });
  });

  // Add longform posts to map
  longformPosts.forEach((post) => {
    const eventId = post.signedEvent?.id ?? post.nostrEventId;
    if (!eventId) return;
    // Extract pubkey from signedEvent or nostrEvent
    let pubkey = "";
    if (post.signedEvent && typeof post.signedEvent === "object" && "pubkey" in post.signedEvent) {
      pubkey = post.signedEvent.pubkey;
    } else if (post.nostrEvent && typeof post.nostrEvent === "object" && "pubkey" in post.nostrEvent) {
      pubkey = post.nostrEvent.pubkey as string;
    }
    postMap.set(eventId, {
      id: post.id,
      eventId,
      pubkey,
      title: post.title ?? null,
      content: post.content ?? null,
      postedAt: post.postedAt ?? new Date(),
      isLongform: true,
      stats: stats[eventId],
    });
  });

  // Group notifications by parent event ID
  const groupedMap = new Map<string, Notification[]>();

  notifications.forEach((notification) => {
    const parentId = notification.originalEventId;
    if (!groupedMap.has(parentId)) {
      groupedMap.set(parentId, []);
    }
    groupedMap.get(parentId)!.push(notification);
  });

  // Convert to array of GroupedNotification
  const result: GroupedNotification[] = [];

  groupedMap.forEach((notifs, parentEventId) => {
    const parentPost = postMap.get(parentEventId);
    if (parentPost) {
      // Sort notifications by created_at descending (newest first)
      const sortedNotifs = notifs.sort((a, b) => b.createdAt - a.createdAt);
      result.push({
        parentPost,
        notifications: sortedNotifs,
      });
    }
  });

  // Sort by most recent notification
  result.sort((a, b) => {
    const aLatest = Math.max(...a.notifications.map((n) => n.createdAt));
    const bLatest = Math.max(...b.notifications.map((n) => n.createdAt));
    return bLatest - aLatest;
  });

  return result;
}

/**
 * Transform quote repost events into NotificationQuoteRepost format
 * Extracts the quoted event ID from tags and enriches with user profile data
 */
export async function processQuoteReposts(
  quoteRepostEvents: NotificationEvent[],
  connectToPrimalCache: (
    requestType: string,
    params: Record<string, unknown>,
  ) => Promise<unknown[]>,
): Promise<NotificationQuoteRepost[]> {
  const _notifications: NotificationQuoteRepost[] = [];
  const userProfiles = new Map<string, UserProfile>();
  const _eventStats = new Map<string, EventStats>();

  // First pass: collect all unique pubkeys to fetch profiles
  const uniquePubkeys = [...new Set(quoteRepostEvents.map((event) => event.pubkey))];

  // Fetch user profiles in parallel
  try {
    const profilePromises = uniquePubkeys.map(async (pubkey) => {
      try {
        const profileData = await connectToPrimalCache("user_profile", {
          pubkey,
        });

        // Find the profile event (kind 0)
        const profileEvent = (profileData as PrimalEvent[])?.find(
          (item: PrimalEvent) => {
            if (!Array.isArray(item) || item[0] !== "EVENT" || !item[2]) return false;
            const eventData = item[2];
            if (typeof eventData !== "object" || Array.isArray(eventData)) return false;
            return "kind" in eventData && (eventData as { kind?: unknown }).kind === 0;
          }
        );

        if (profileEvent && Array.isArray(profileEvent) && profileEvent[2] && typeof profileEvent[2] === "object" && !Array.isArray(profileEvent[2])) {
          const eventData = profileEvent[2] as { content?: string };
          if (eventData.content && typeof eventData.content === "string") {
            const profile = JSON.parse(eventData.content) as UserProfile;
            userProfiles.set(pubkey, profile);
          }
        }
      } catch (error) {
        logError(error instanceof Error ? error : new Error(String(error)), {
          pubkey,
          message: "Failed to fetch profile",
        });
      }
    });

    await Promise.all(profilePromises);
  } catch (error) {
    logError(error instanceof Error ? error : new Error(String(error)), {
      message: "Error fetching user profiles",
    });
  }

  // Second pass: process each quote repost and fetch thread_view for stats
  const quotePromises = quoteRepostEvents.map(async (event) => {
    try {
      // Extract the quoted event ID from the "e" tags with "mention" marker
      const eTags = event.tags?.filter((tag: NostrTag) => tag[0] === "e") ?? [];
      const quotedEventTag = eTags.find((tag: NostrTag) => tag[3] === "mention");

      if (!quotedEventTag?.[1]) {
        return null;
      }

      const originalEventId = quotedEventTag[1];
      const profile = userProfiles.get(event.pubkey);

      // Fetch thread_view for stats
      let stats: EventStats = {
        likes: 0,
        replies: 0,
        mentions: 0,
        reposts: 0,
        zaps: 0,
        satszapped: 0,
      };

      try {
        const threadViewData = await connectToPrimalCache("thread_view", {
          event_id: event.id,
        });

        // Find the stats event
        const statsEvent = (threadViewData as PrimalEvent[])?.find(
          (item: PrimalEvent) => {
            if (!Array.isArray(item) || item[0] !== "EVENT" || !item[2]) return false;
            const eventData = item[2] as { kind?: number; content?: string };
            return eventData.kind === 10000100 &&
              eventData.content &&
              typeof eventData.content === "string" &&
              eventData.content.includes(event.id);
          }
        );

        if (statsEvent && Array.isArray(statsEvent) && statsEvent[2]) {
          const eventData = statsEvent[2] as { kind?: number; content?: string };
          if (eventData.content) {
            try {
              const content = JSON.parse(eventData.content) as {
                likes?: number;
                replies?: number;
                mentions?: number;
                reposts?: number;
                zaps?: number;
                satszapped?: number;
              };
              stats = {
                likes: content.likes ?? 0,
                replies: content.replies ?? 0,
                mentions: content.mentions ?? 0,
                reposts: content.reposts ?? 0,
                zaps: content.zaps ?? 0,
                satszapped: content.satszapped ?? 0,
              };
            } catch {
              // Ignore parse errors
            }
          }
        }
      } catch (_error) {
        // Silently handle errors for stats
      }

      const result: NotificationQuoteRepost = {
        type: "quote",
        id: event.id,
        eventId: event.id,
        content: event.content,
        createdAt: event.created_at,
        pubkey: event.pubkey,
        authorName: (profile?.display_name ?? profile?.name),
        authorPicture: profile?.picture as string | null | undefined,
        authorNip05: profile?.nip05 as string | undefined,
        originalEventId,
        stats,
      };
      return result;
    } catch (error) {
      logError(error instanceof Error ? error : new Error(String(error)), {
        eventId: event?.id,
        message: "Error processing quote repost",
      });
      return null;
    }
  });

  const results = await Promise.all(quotePromises);

  // Filter out nulls and sort by created_at descending
  const validNotifications = results.filter(
    (n): n is NotificationQuoteRepost => {
      return n !== null && n !== undefined && typeof n === "object" && "type" in n && n.type === "quote";
    }
  );

  return validNotifications.sort((a, b) => b.createdAt - a.createdAt);
}

/**
 * Get engagement data (alias for loadEngagementFeedData)
 */
export const getEngagementData = loadEngagementFeedData;
