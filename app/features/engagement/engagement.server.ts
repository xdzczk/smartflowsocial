import * as nip27 from "nostr-tools/nip27";

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

// ============================================================================
// Helper Functions for Notification Parsing
// ============================================================================

interface ParsedEvent {
  kind?: number;
  content?: string;
  pubkey?: string;
  id?: string;
  tags?: string[][];
  created_at?: number;
}

function extractEventFromItem(item: unknown): ParsedEvent | null {
  if (!Array.isArray(item) || item[0] !== "EVENT") {
    return null;
  }
  const event = item[2] as ParsedEvent | undefined;
  return event ?? null;
}

function parseUserProfile(
  event: ParsedEvent,
  userProfiles: Map<string, UserProfile>
): void {
  if (event.kind === 0 && event.content && event.pubkey) {
    try {
      const profile = JSON.parse(event.content) as Record<string, unknown>;
      userProfiles.set(event.pubkey, profile as UserProfile);
    } catch {
      // Ignore parse errors
    }
  }
}

function parseEventStats(
  event: ParsedEvent,
  eventStats: Map<string, EventStats>
): void {
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

function collectProfilesAndStats(threadViewResponse: unknown[]): {
  userProfiles: Map<string, UserProfile>;
  eventStats: Map<string, EventStats>;
} {
  const userProfiles = new Map<string, UserProfile>();
  const eventStats = new Map<string, EventStats>();

  for (const item of threadViewResponse) {
    const event = extractEventFromItem(item);
    if (!event) continue;

    parseUserProfile(event, userProfiles);
    parseEventStats(event, eventStats);
  }

  return { userProfiles, eventStats };
}

/** True if NIP-27 content embeds this event id (note / nevent pointers). */
function contentEmbedsQuotedEvent(
  content: string | undefined,
  quotedEventIdHex: string | undefined
): boolean {
  if (!content || !quotedEventIdHex) return false;
  try {
    for (const block of nip27.parse(content)) {
      if (block.type !== "reference") continue;
      const ptr = block.pointer;
      if (
        "id" in ptr &&
        typeof ptr.id === "string" &&
        ptr.id === quotedEventIdHex
      ) {
        return true;
      }
    }
  } catch {
    /* ignore */
  }
  return false;
}

/**
 * Quote (for Mentions tab) vs reply: many clients use an empty e-tag marker and still put
 * nostr:note / nevent for the parent in the body — that is a thread reply, not a quote.
 * Only treat as quote when the e-tag uses the NIP-10-style "mention" marker for the cited post,
 * plus a nostr reference in content (substring or NIP-27 parse).
 * Exported for Primal global-notification quote detection (must match this heuristic).
 */
export function isQuotePost(
  event: ParsedEvent,
  targetETag: string[] | undefined
): boolean {
  if (!targetETag) return false;

  const marker = targetETag[3] as string | undefined;
  if (marker !== "mention") {
    return false;
  }

  const eventContent = event.content ?? "";
  const quotedId = targetETag[1];
  return (
    eventContent.includes("nostr:nevent") ||
    eventContent.includes("nostr:note") ||
    eventContent.includes("nostr:naddr") ||
    contentEmbedsQuotedEvent(eventContent, quotedId)
  );
}

function isReply(targetETag: string[] | undefined): boolean {
  if (!targetETag) return false;
  const marker = targetETag[3] as string | undefined;
  return marker === "reply" || marker === "root";
}

/**
 * NIP-27: detect profile or address pointers in note content that reference the user's hex pubkey.
 * Complements `p` tags — some clients only embed nostr:npub / nostr:nprofile / nostr:naddr in text.
 */
function contentMentionsUserPubkey(
  content: string | undefined,
  userPubkeyHex: string
): boolean {
  if (!content) return false;
  const userLower = userPubkeyHex.toLowerCase();
  try {
    for (const block of nip27.parse(content)) {
      if (block.type !== "reference") continue;
      const ptr = block.pointer;
      if ("pubkey" in ptr && typeof ptr.pubkey === "string") {
        if (ptr.pubkey.toLowerCase() === userLower) return true;
      }
    }
  } catch {
    // Malformed nostr: URIs must not break engagement parsing
  }
  return false;
}

/** True if `p` tags or NIP-27 body references mention this hex pubkey. */
export function doesEventMentionUser(
  content: string | undefined,
  tags: string[][] | undefined,
  userPubkeyHex: string
): boolean {
  const userLower = userPubkeyHex.toLowerCase();
  const pTags = tags?.filter((t) => t[0] === "p") ?? [];
  const viaPTag = pTags.some((t) => (t[1] ?? "").toLowerCase() === userLower);
  return viaPTag || contentMentionsUserPubkey(content, userPubkeyHex);
}

/**
 * Kind-1 participates in a NIP-10 thread (reply/root markers), not a standalone @mention.
 * Quotes use an `e` tag with marker `mention` — those are excluded here so real quotes
 * still surface in the Mentions tab.
 */
export function isStructuredThreadReplyKind1(
  tags: NostrTag[] | undefined
): boolean {
  const eTags = (tags ?? []).filter((t) => t[0] === "e");
  const hasMentionMarker = eTags.some(
    (t) => (t[3] ?? "").toLowerCase() === "mention"
  );
  if (hasMentionMarker) return false;
  return eTags.some((t) => {
    const marker = (t[3] ?? "").toLowerCase();
    return marker === "reply" || marker === "root";
  });
}

/**
 * True when an `e` tag points at one of the user's published notes with a non-quote marker.
 * Catches legacy replies (empty marker) to the user's posts that still match `#p`.
 */
export function isReplyToUserPublishedEvent(
  tags: NostrTag[] | undefined,
  userPublishedEventIds: Set<string>
): boolean {
  if (userPublishedEventIds.size === 0) return false;
  const eTags = (tags ?? []).filter((t) => t[0] === "e");
  for (const t of eTags) {
    const id = t[1];
    if (!id || !userPublishedEventIds.has(id)) continue;
    const marker = (t[3] ?? "").toLowerCase();
    if (marker === "mention") continue;
    return true;
  }
  return false;
}

/** Drop thread replies from the global Mentions inbox; keep quotes and body-only @mentions. */
export function shouldExcludeKind1FromGlobalMentionInbox(
  tags: NostrTag[] | undefined,
  userPublishedEventIds: Set<string>
): boolean {
  if (isStructuredThreadReplyKind1(tags)) return true;
  return isReplyToUserPublishedEvent(tags, userPublishedEventIds);
}

/**
 * Best-effort root id for grouping: explicit `root` marker, then first `e` (NIP-10 ordering),
 * then `reply`, else the note id.
 */
export function inferThreadRootEventIdFromTags(
  tags: NostrTag[] | undefined,
  noteEventId: string
): string {
  const eTags = (tags ?? []).filter((t) => t[0] === "e");
  const root = eTags.find((t) => (t[3] ?? "") === "root");
  if (root?.[1]) return root[1];
  if (eTags[0]?.[1]) return eTags[0][1];
  const reply = eTags.find((t) => (t[3] ?? "") === "reply");
  if (reply?.[1]) return reply[1];
  return noteEventId;
}

function createReplyNotification(
  event: ParsedEvent,
  profile: UserProfile | undefined,
  stats: EventStats | undefined,
  originalEventId: string
): Notification | null {
  if (!event.id || !event.pubkey || event.created_at === undefined) {
    return null;
  }

  return {
    type: "reply",
    id: event.id,
    eventId: event.id,
    content: event.content ?? "",
    createdAt: event.created_at,
    pubkey: event.pubkey,
    authorName: profile?.display_name ?? profile?.name,
    authorPicture: profile?.picture as string | null | undefined,
    authorNip05: profile?.["nip05"] as string | undefined,
    originalEventId,
    stats,
  };
}

function createMentionNotification(
  event: ParsedEvent,
  profile: UserProfile | undefined,
  stats: EventStats | undefined,
  originalEventId: string
): Notification | null {
  if (!event.id || !event.pubkey || event.created_at === undefined) {
    return null;
  }

  return {
    type: "mention",
    id: event.id,
    eventId: event.id,
    content: event.content ?? "",
    createdAt: event.created_at,
    pubkey: event.pubkey,
    authorName: profile?.display_name ?? profile?.name,
    authorPicture: profile?.picture as string | null | undefined,
    authorNip05: profile?.["nip05"] as string | undefined,
    originalEventId,
    stats,
  };
}

function createZapNotification(
  event: ParsedEvent,
  zapRequest: {
    tags?: string[][];
    pubkey?: string;
    content?: string;
  },
  profile: UserProfile | undefined,
  stats: EventStats | undefined,
  userPubkey: string,
  originalEventId: string
): Notification | null {
  if (!event.id || event.created_at === undefined) {
    return null;
  }

  const amountTag = zapRequest.tags?.find(
    (tag: string[]) => tag[0] === "amount"
  );
  const amountMsats = amountTag?.[1] ? parseInt(amountTag[1], 10) : 0;
  const amountSats = Math.floor(amountMsats / 1000);
  const senderPubkey = zapRequest.pubkey ?? event.pubkey ?? "";

  return {
    type: "zap",
    id: event.id,
    eventId: event.id,
    content: event.content ?? zapRequest.content ?? "",
    createdAt: event.created_at,
    senderPubkey,
    receiverPubkey: userPubkey,
    amountSats,
    senderName: profile?.display_name ?? profile?.name,
    senderPicture: profile?.picture as string | null | undefined,
    senderNip05: profile?.["nip05"] as string | undefined,
    pubkey: senderPubkey,
    authorName: profile?.display_name ?? profile?.name,
    authorPicture: profile?.picture as string | null | undefined,
    authorNip05: profile?.["nip05"] as string | undefined,
    originalEventId,
    stats,
  };
}

function processKind1Notifications(
  event: ParsedEvent,
  originalEventId: string,
  userPubkey: string,
  userProfiles: Map<string, UserProfile>,
  eventStats: Map<string, EventStats>
): Notification[] {
  const notifications: Notification[] = [];

  if (event.kind !== 1 || !event.id || event.id === originalEventId) {
    return notifications;
  }

  const eTags = event.tags?.filter((tag: string[]) => tag[0] === "e") ?? [];

  const targetETag = eTags.find((tag: string[]) => tag[1] === originalEventId);
  const referencesOriginal = !!targetETag;
  const userPubkeyLower = userPubkey.toLowerCase();
  const mentionsUser = doesEventMentionUser(
    event.content,
    event.tags,
    userPubkey
  );

  if (
    referencesOriginal &&
    event.pubkey &&
    (event.pubkey ?? "").toLowerCase() !== userPubkeyLower
  ) {
    const profile = userProfiles.get(event.pubkey);
    const stats = eventStats.get(event.id);
    const isQuote = isQuotePost(event, targetETag);
    const isReplyEvent = isReply(targetETag);

    if (isQuote && !isReplyEvent) {
      const notification = createMentionNotification(
        event,
        profile,
        stats,
        originalEventId
      );
      if (notification) {
        notifications.push(notification);
      }
    } else {
      const notification = createReplyNotification(
        event,
        profile,
        stats,
        originalEventId
      );
      if (notification) {
        notifications.push(notification);
      }
    }
  } else if (
    mentionsUser &&
    !referencesOriginal &&
    event.pubkey &&
    (event.pubkey ?? "").toLowerCase() !== userPubkeyLower
  ) {
    const profile = userProfiles.get(event.pubkey);
    const stats = eventStats.get(event.id);
    const notification = createMentionNotification(
      event,
      profile,
      stats,
      originalEventId
    );
    if (notification) {
      notifications.push(notification);
    }
  }

  return notifications;
}

function processKind9735Notifications(
  event: ParsedEvent,
  originalEventId: string,
  userPubkey: string,
  userProfiles: Map<string, UserProfile>,
  eventStats: Map<string, EventStats>
): Notification[] {
  const notifications: Notification[] = [];

  if (
    event.kind !== 9735 ||
    !event.tags ||
    !event.id ||
    event.created_at === undefined
  ) {
    return notifications;
  }

  try {
    const descTag = event.tags.find(
      (tag: string[]) => tag[0] === "description"
    );
    if (!descTag?.[1] || typeof descTag[1] !== "string") {
      return notifications;
    }

    const zapRequest = JSON.parse(descTag[1]) as {
      tags?: string[][];
      pubkey?: string;
      content?: string;
    };
    const eTags = (event.tags ?? []).filter((tag: string[]) => tag[0] === "e");

    const zapForOriginal = eTags.some(
      (tag: string[]) => tag[1] === originalEventId
    );

    if (zapForOriginal) {
      const senderPubkey = zapRequest.pubkey ?? event.pubkey ?? "";
      const profile = senderPubkey ? userProfiles.get(senderPubkey) : undefined;
      const stats = eventStats.get(event.id);
      const notification = createZapNotification(
        event,
        zapRequest,
        profile,
        stats,
        userPubkey,
        originalEventId
      );
      if (notification) {
        notifications.push(notification);
      }
    }
  } catch {
    // Ignore parse errors
  }

  return notifications;
}

/**
 * Parse thread_view response to extract notifications (replies, mentions, zaps)
 */
export function parseThreadViewNotifications(
  threadViewResponse: unknown[],
  originalEventId: string,
  userPubkey: string
): Notification[] {
  const notifications: Notification[] = [];

  // First pass: collect all user profiles (kind 0) and stats (kind 10000100)
  const { userProfiles, eventStats } =
    collectProfilesAndStats(threadViewResponse);

  // Second pass: collect notifications
  for (const item of threadViewResponse) {
    const event = extractEventFromItem(item);
    if (!event) continue;

    // Process kind 1 notifications (replies and mentions)
    const kind1Notifications = processKind1Notifications(
      event,
      originalEventId,
      userPubkey,
      userProfiles,
      eventStats
    );
    notifications.push(...kind1Notifications);

    // Process kind 9735 notifications (zaps)
    const kind9735Notifications = processKind9735Notifications(
      event,
      originalEventId,
      userPubkey,
      userProfiles,
      eventStats
    );
    notifications.push(...kind9735Notifications);
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

/** Options for grouping when some parents are not SmartFlow-published posts. */
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
      fileUrl: Array.isArray(post.fileUrl)
        ? (post.fileUrl[0] ?? null)
        : post.fileUrl,
      publishedAt: post.publishedAt ?? new Date(),
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
    params: Record<string, unknown>
  ) => Promise<unknown[]>
): Promise<NotificationQuoteRepost[]> {
  const _notifications: NotificationQuoteRepost[] = [];
  const userProfiles = new Map<string, UserProfile>();
  const _eventStats = new Map<string, EventStats>();

  // First pass: collect all unique pubkeys to fetch profiles
  const uniquePubkeys = [
    ...new Set(quoteRepostEvents.map((event) => event.pubkey)),
  ];

  // Fetch user profiles in parallel
  try {
    const profilePromises = uniquePubkeys.map(async (pubkey) => {
      try {
        const profileData = await connectToPrimalCache("user_profile", {
          pubkey,
        });

        // Find the profile event (kind 0)
        const profileEvent = (profileData as PrimalEvent[]).find(
          (item: PrimalEvent) => {
            if (!Array.isArray(item) || item[0] !== "EVENT") return false;
            const eventData = item[2];
            if (typeof eventData !== "object" || Array.isArray(eventData))
              return false;
            return (
              "kind" in eventData &&
              (eventData as { kind?: unknown }).kind === 0
            );
          }
        );

        if (
          profileEvent &&
          Array.isArray(profileEvent) &&
          typeof profileEvent[2] === "object" &&
          !Array.isArray(profileEvent[2])
        ) {
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
      const eTags = event.tags.filter((tag: NostrTag) => tag[0] === "e");
      const quotedEventTag = eTags.find(
        (tag: NostrTag) => tag[3] === "mention"
      );

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
        const statsEvent = (threadViewData as PrimalEvent[]).find(
          (item: PrimalEvent) => {
            if (!Array.isArray(item) || item[0] !== "EVENT") return false;
            const eventData = item[2] as { kind?: number; content?: string };
            return (
              eventData.kind === 10000100 &&
              eventData.content &&
              typeof eventData.content === "string" &&
              eventData.content.includes(event.id)
            );
          }
        );

        if (statsEvent && Array.isArray(statsEvent)) {
          const eventData = statsEvent[2] as {
            kind?: number;
            content?: string;
          };
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
        authorName: profile?.display_name ?? profile?.name,
        authorPicture: profile?.picture as string | null | undefined,
        authorNip05: profile?.["nip05"] as string | undefined,
        originalEventId,
        stats,
      };
      return result;
    } catch (error) {
      logError(error instanceof Error ? error : new Error(String(error)), {
        eventId: event.id,
        message: "Error processing quote repost",
      });
      return null;
    }
  });

  const results = await Promise.all(quotePromises);

  // Filter out nulls and sort by created_at descending
  // All non-null results are NotificationQuoteRepost with type: "quote"
  const validNotifications = results.filter(
    (n): n is NotificationQuoteRepost => {
      return n !== null && typeof n === "object" && "type" in n;
    }
  );

  return validNotifications.sort((a, b) => b.createdAt - a.createdAt);
}

/**
 * Get engagement data (alias for loadEngagementFeedData)
 */
export const getEngagementData = loadEngagementFeedData;
