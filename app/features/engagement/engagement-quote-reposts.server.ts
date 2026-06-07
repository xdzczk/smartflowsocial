import { logError } from "~/lib/error-logger.server";

import type {
  EventStats,
  NotificationEvent,
  NotificationQuoteRepost,
  NostrTag,
  PrimalEvent,
  UserProfile,
} from "./types";

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
  const userProfiles = new Map<string, UserProfile>();

  const uniquePubkeys = [
    ...new Set(quoteRepostEvents.map((event) => event.pubkey)),
  ];

  try {
    const profilePromises = uniquePubkeys.map(async (pubkey) => {
      try {
        const profileData = await connectToPrimalCache("user_profile", {
          pubkey,
        });

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

  const quotePromises = quoteRepostEvents.map(async (event) => {
    try {
      const eTags = event.tags.filter((tag: NostrTag) => tag[0] === "e");
      const quotedEventTag = eTags.find(
        (tag: NostrTag) => tag[3] === "mention"
      );

      if (!quotedEventTag?.[1]) {
        return null;
      }

      const originalEventId = quotedEventTag[1];
      const profile = userProfiles.get(event.pubkey);

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
        authorPicture: profile?.picture,
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

  const validNotifications = results.filter(
    (n): n is NotificationQuoteRepost => {
      return n !== null && typeof n === "object" && "type" in n;
    }
  );

  return validNotifications.sort((a, b) => b.createdAt - a.createdAt);
}
