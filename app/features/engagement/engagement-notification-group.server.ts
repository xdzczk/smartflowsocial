import type { LongFormPostData, PostData } from "~/features/posts/types";

import type {
  EventStats,
  GroupedNotification,
  Notification,
  ParentPost,
} from "./types";

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

/** Options for grouping when some parents are not app-published posts. */
export interface GroupNotificationsByParentOptions {
  /**
   * When set, notifications whose `originalEventId` is not in the post map still create a group
   * using a synthetic parent (Primal global mentions / off-app threads).
   */
  syntheticFallbackPubkey?: string;
}

/**
 * Group notifications by their parent event ID and include parent post data
 */
export function groupNotificationsByParent(
  notifications: Notification[],
  posts: PostData[],
  longformPosts: LongFormPostData[],
  stats: Record<string, EventStats> = {},
  options?: GroupNotificationsByParentOptions
): GroupedNotification[] {
  const postMap = new Map<string, ParentPost>();

  posts.forEach((post) => {
    if (!post.signedEvent?.id) return;
    const eventId = post.signedEvent.id;
    postMap.set(eventId, {
      id: post.id,
      eventId,
      pubkey: post.signedEvent.pubkey,
      caption: post.caption ?? null,
      fileUrl: Array.isArray(post.fileUrl)
        ? (post.fileUrl[0] ?? null)
        : post.fileUrl,
      publishedAt: post.publishedAt ?? new Date(),
      isLongform: false,
      stats: stats[eventId],
    });
  });

  longformPosts.forEach((post) => {
    const eventId = post.signedEvent?.id ?? post.nostrEventId;
    if (!eventId) return;
    let pubkey = "";
    if (
      post.signedEvent &&
      typeof post.signedEvent === "object" &&
      "pubkey" in post.signedEvent
    ) {
      pubkey = post.signedEvent.pubkey;
    } else if (
      post.nostrEvent &&
      typeof post.nostrEvent === "object" &&
      "pubkey" in post.nostrEvent
    ) {
      pubkey = post.nostrEvent.pubkey as string;
    }
    postMap.set(eventId, {
      id: post.id,
      eventId,
      pubkey,
      title: post.title ?? null,
      content: post.content ?? null,
      publishedAt: post.publishedAt ?? new Date(),
      isLongform: true,
      stats: stats[eventId],
    });
  });

  const groupedMap = new Map<string, Notification[]>();

  notifications.forEach((notification) => {
    const parentId = notification.originalEventId;
    if (!groupedMap.has(parentId)) {
      groupedMap.set(parentId, []);
    }
    groupedMap.get(parentId)!.push(notification);
  });

  const result: GroupedNotification[] = [];

  const syntheticPk = options?.syntheticFallbackPubkey;

  groupedMap.forEach((notifs, parentEventId) => {
    let parentPost = postMap.get(parentEventId);
    if (!parentPost && syntheticPk) {
      parentPost = {
        id: `synthetic-context-${parentEventId}`,
        eventId: parentEventId,
        pubkey: syntheticPk,
        caption: null,
        fileUrl: null,
        title: null,
        content: null,
        publishedAt: null,
        isLongform: false,
        stats: stats[parentEventId],
        contextLabel: "Referenced note (Nostr)",
      };
    }
    if (parentPost) {
      const sortedNotifs = notifs.sort((a, b) => b.createdAt - a.createdAt);
      result.push({
        parentPost,
        notifications: sortedNotifs,
      });
    }
  });

  result.sort((a, b) => {
    const aLatest = Math.max(...a.notifications.map((n) => n.createdAt));
    const bLatest = Math.max(...b.notifications.map((n) => n.createdAt));
    return bLatest - aLatest;
  });

  return result;
}
