import type {
  EventStats,
  NotificationReply,
  NotificationZap,
  NotificationMention,
  NotificationQuoteRepost,
  Notification,
  UserProfile,
  ParentPost,
  GroupedNotifications,
} from "~/features/engagement/types";

// Re-export types for consumers
export type {
  EventStats,
  NotificationReply,
  NotificationZap,
  NotificationMention,
  NotificationQuoteRepost,
  Notification,
  ParentPost,
  GroupedNotifications,
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
    const event = item[2];
    if (!event) continue;

    // Collect user profiles (kind 0)
    if (event.kind === 0) {
      try {
        const profile = JSON.parse(event.content);
        userProfiles.set(event.pubkey, profile);
      } catch {
        // Ignore parse errors
      }
    }

    // Collect event stats (kind 10000100)
    if (event.kind === 10000100) {
      try {
        const statsData = JSON.parse(event.content);
        if (statsData.event_id) {
          eventStats.set(statsData.event_id, {
            likes: statsData.likes || 0,
            replies: statsData.replies || 0,
            mentions: statsData.mentions || 0,
            reposts: statsData.reposts || 0,
            zaps: statsData.zaps || 0,
            satszapped: statsData.satszapped || 0,
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
    const event = item[2];
    if (!event) continue;

    // Replies and Mentions (kind 1 events that reference the original event)
    if (event.kind === 1 && event.id !== originalEventId) {
      // Check if this event replies to or mentions the original event
      const eTags = event.tags?.filter((tag: string[]) => tag[0] === "e") || [];
      const pTags = event.tags?.filter((tag: string[]) => tag[0] === "p") || [];

      const targetETag = eTags.find((tag: string[]) => tag[1] === originalEventId);
      const referencesOriginal = !!targetETag;
      const mentionsUser = pTags.some((tag: string[]) => tag[1] === userPubkey);

      if (referencesOriginal && event.pubkey !== userPubkey) {
        const profile = userProfiles.get(event.pubkey);
        const stats = eventStats.get(event.id);

        // Determine if this is a reply or a mention/quote
        // The 4th element (index 3) in the e tag is the marker
        const marker = targetETag[3];

        // Check if it's a quote post (has nostr:nevent or nostr:note in content)
        const hasNostrReference =
          event.content?.includes("nostr:nevent") ||
          event.content?.includes("nostr:note") ||
          event.content?.includes("nostr:naddr");

        // It's a mention/quote if:
        // - marker is 'mention' OR marker is undefined/empty AND has nostr reference
        // - NOT a reply (which has 'reply' or 'root' markers)
        const isQuote =
          (!marker || marker === "" || marker === "mention") &&
          hasNostrReference;
        const isReply = marker === "reply" || marker === "root";

        if (isQuote && !isReply) {
          // This is a quote post/mention
          notifications.push({
            type: "mention",
            id: event.id,
            eventId: event.id,
            content: event.content,
            createdAt: event.created_at,
            pubkey: event.pubkey,
            authorName: profile?.display_name || profile?.name,
            authorPicture: profile?.picture,
            authorNip05: profile?.nip05,
            originalEventId,
            stats,
          });
        } else {
          // This is a regular reply (has reply/root marker, or no nostr reference)
          notifications.push({
            type: "reply",
            id: event.id,
            eventId: event.id,
            content: event.content,
            createdAt: event.created_at,
            pubkey: event.pubkey,
            authorName: profile?.display_name || profile?.name,
            authorPicture: profile?.picture,
            authorNip05: profile?.nip05,
            originalEventId,
            stats,
          });
        }
      } else if (mentionsUser && !referencesOriginal && event.pubkey !== userPubkey) {
        // This is a mention via p tag (user was tagged but not replying to their post)
        const profile = userProfiles.get(event.pubkey);
        const stats = eventStats.get(event.id);
        notifications.push({
          type: "mention",
          id: event.id,
          eventId: event.id,
          content: event.content,
          createdAt: event.created_at,
          pubkey: event.pubkey,
          authorName: profile?.display_name || profile?.name,
          authorPicture: profile?.picture,
          authorNip05: profile?.nip05,
          originalEventId,
          stats,
        });
      }
    }

    // Zaps (kind 9735)
    if (event.kind === 9735) {
      try {
        // Parse the description tag to get zap request details
        const descTag = event.tags?.find((tag: string[]) => tag[0] === "description");
        if (!descTag || !descTag[1]) continue;

        const zapRequest = JSON.parse(descTag[1]);
        const eTags = event.tags?.filter((tag: string[]) => tag[0] === "e") || [];

        // Check if this zap is for our original event
        const zapForOriginal = eTags.some(
          (tag: string[]) => tag[1] === originalEventId,
        );

        if (zapForOriginal) {
          // Extract amount from bolt11 or amount tag
          const amountTag = zapRequest.tags?.find(
            (tag: string[]) => tag[0] === "amount",
          );
          const amountMsats = amountTag ? parseInt(amountTag[1], 10) : 0;
          const amountSats = Math.floor(amountMsats / 1000);

          const senderPubkey = zapRequest.pubkey || event.pubkey;
          const profile = userProfiles.get(senderPubkey);
          const stats = eventStats.get(event.id);

          notifications.push({
            type: "zap",
            id: event.id,
            eventId: event.id,
            content: event.content || zapRequest.content || "",
            createdAt: event.created_at,
            senderPubkey,
            receiverPubkey: userPubkey,
            amountSats,
            senderName: profile?.display_name || profile?.name,
            senderPicture: profile?.picture,
            senderNip05: profile?.nip05,
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
  posts: any[],
  longformPosts: any[],
  stats: Record<string, EventStats> = {},
): GroupedNotifications[] {
  // Create a map of event ID to post data
  const postMap = new Map<string, ParentPost>();

  // Add regular posts to map
  posts.forEach((post) => {
    const eventId = post.signedEvent.id;
    postMap.set(eventId, {
      id: post.id,
      eventId,
      pubkey: post.signedEvent.pubkey,
      caption: post.caption,
      fileUrl: post.fileUrl,
      postedAt: post.postedAt,
      isLongform: false,
      stats: stats[eventId],
    });
  });

  // Add longform posts to map
  longformPosts.forEach((post) => {
    const eventId = post.signedEvent?.id || post.nostrEventId;
    postMap.set(eventId, {
      id: post.id,
      eventId,
      pubkey: post.signedEvent?.pubkey || post.pubkey,
      title: post.title,
      content: post.content,
      postedAt: post.postedAt,
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

  // Convert to array of GroupedNotifications
  const result: GroupedNotifications[] = [];

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
  quoteRepostEvents: any[],
  connectToPrimalCache: (requestType: string, params: any) => Promise<any>,
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
        const profileEvent = profileData?.find(
          (item: any) => Array.isArray(item) && item[0] === "EVENT" && item[2]?.kind === 0
        );

        if (profileEvent && profileEvent[2]) {
          const profile = JSON.parse(profileEvent[2].content);
          userProfiles.set(pubkey, profile);
        }
      } catch (error) {
        console.error(`Failed to fetch profile for ${pubkey}:`, error);
      }
    });

    await Promise.all(profilePromises);
  } catch (error) {
    console.error("Error fetching user profiles:", error);
  }

  // Second pass: process each quote repost and fetch thread_view for stats
  const quotePromises = quoteRepostEvents.map(async (event) => {
    try {
      // Extract the quoted event ID from the "e" tags with "mention" marker
      const eTags = event.tags?.filter((tag: any[]) => tag[0] === "e") || [];
      const quotedEventTag = eTags.find((tag: any[]) => tag[3] === "mention");

      if (!quotedEventTag || !quotedEventTag[1]) {
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
        const statsEvent = threadViewData?.find(
          (item: any) =>
            Array.isArray(item) &&
            item[0] === "EVENT" &&
            item[2]?.kind === 10000100 &&
            item[2].content?.includes(event.id)
        );

        if (statsEvent && statsEvent[2]) {
          const content = JSON.parse(statsEvent[2].content);
          stats = {
            likes: content.likes || 0,
            replies: content.replies || 0,
            mentions: content.mentions || 0,
            reposts: content.reposts || 0,
            zaps: content.zaps || 0,
            satszapped: content.satszapped || 0,
          };
        }
      } catch (error) {
        // Silently handle errors for stats
      }

      return {
        type: "quote" as const,
        id: event.id,
        eventId: event.id,
        content: event.content,
        createdAt: event.created_at,
        pubkey: event.pubkey,
        authorName: profile?.display_name || profile?.name,
        authorPicture: profile?.picture,
        authorNip05: profile?.nip05,
        originalEventId,
        stats,
      };
    } catch (error) {
      console.error("Error processing quote repost:", error);
      return null;
    }
  });

  const results = await Promise.all(quotePromises);

  // Filter out nulls and sort by created_at descending
  const validNotifications = results.filter(
    (n): n is NotificationQuoteRepost => n !== null
  );

  return validNotifications.sort((a, b) => b.createdAt - a.createdAt);
}
