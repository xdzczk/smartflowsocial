import { connectToPrimalCache } from "~/features/cache/primalCache.server";

import type { RelatedEvent, PrimalEvent } from "./types";
/**
 * Fetches all engagement events for giveaway participation
 * Uses a hybrid approach:
 * - thread_view for replies, zaps, and aggregated stats (efficient)
 * - event_actions for individual likes and reposts (to include all participants)
 *
 * @param eventIds - Single event ID or array of event IDs
 * @returns Object containing relatedEvents array (kinds 1, 6, 7, 9735), count, and stats
 */
export const fetchGiveawayParticipants = async (
  eventIds: string | string[],
): Promise<{

  relatedEvents: RelatedEvent[];
  count: number;
  stats: {
    likes: number;
    reposts: number;
    zaps: number;
    satszapped: number;
    total: number;
  };
}> => {
  try {
    // Normalize input to array
    const eventIdArray = Array.isArray(eventIds) ? eventIds : [eventIds];

    if (eventIdArray.length === 0) {
      throw new Error("At least one event ID is required");
    }

    const allRelatedEvents: RelatedEvent[] = [];
    const aggregatedStats = {
      likes: 0,
      reposts: 0,
      zaps: 0,
      satszapped: 0,
      total: 0,
    };

    // Fetch all data for each event ID in parallel
    const fetchPromises = eventIdArray.map(async (eventId) => {
      const events: RelatedEvent[] = [];

      try {
        // 1. Fetch thread_view for replies, zaps, and stats
        const threadResponse = await connectToPrimalCache("thread_view", {
          event_id: eventId,
        });

        // Process thread_view response
        (threadResponse as PrimalEvent[]).forEach((item: PrimalEvent) => {
          if (!Array.isArray(item) || item[0] !== "EVENT" || !item[2]) return;

          const event = item[2];
          if (typeof event !== "object" || Array.isArray(event) || !("kind" in event)) return;

          // Extract zap receipts (kind 9735)
          if (event.kind === 9735) {
            events.push(event as RelatedEvent);

            // Extract zap amount for stats
            try {
              const tags = event.tags;
              const descriptionTag = Array.isArray(tags) ? tags.find(
                (tag: string[]) => Array.isArray(tag) && tag[0] === "description",
              ) : undefined;
              if (descriptionTag && Array.isArray(descriptionTag) && descriptionTag[1] && typeof descriptionTag[1] === "string") {
                const zapRequestParsed: unknown = JSON.parse(descriptionTag[1]);
                if (zapRequestParsed && typeof zapRequestParsed === "object" && !Array.isArray(zapRequestParsed) && "tags" in zapRequestParsed) {
                  const zapRequest = zapRequestParsed as { tags?: string[][] };
                  const amountTag = Array.isArray(zapRequest.tags) ? zapRequest.tags.find(
                    (tag: string[]) => Array.isArray(tag) && tag[0] === "amount",
                  ) : undefined;
                  if (amountTag && Array.isArray(amountTag) && amountTag[1] && typeof amountTag[1] === "string") {
                    const amount = parseInt(amountTag[1], 10);
                    if (!isNaN(amount)) {
                      aggregatedStats.satszapped += isNaN(amount / 1000) ? 0 : amount / 1000; // Convert millisats to sats
                    }
                  }
                }
              }
            } catch (_e) {
              // Error parsing zap amount - skip
            }
          }

          // Extract reply events (kind 1) that reference our event
          if (event.kind === 1 && "id" in event && event.id !== eventId) {
            const eTag = ("tags" in event && Array.isArray(event.tags)) ? event.tags.find(
              (tag: string[]) => tag[0] === "e" && tag[1] === eventId,
            ) : undefined;
            if (eTag) {
              events.push(event as RelatedEvent);
            }
          }

          // Extract stats from kind 10000100
          if (event.kind === 10000100 && event.content && typeof event.content === "string") {
            try {
              const statsContentParsed: unknown = JSON.parse(event.content);
              if (statsContentParsed && typeof statsContentParsed === "object" && !Array.isArray(statsContentParsed)) {
                const statsContent = statsContentParsed as { event_id?: string; likes?: number; reposts?: number; zaps?: number };
                if (statsContent.event_id === eventId) {
                  aggregatedStats.likes += typeof statsContent.likes === "number" ? statsContent.likes : 0;
                  aggregatedStats.reposts += typeof statsContent.reposts === "number" ? statsContent.reposts : 0;
                  aggregatedStats.zaps += statsContent.zaps ?? 0;
                  // Don't add satszapped here as we already calculated it from actual zap events
                }
              }
            } catch (_e) {
              // Error parsing stats - skip
            }
          }
        });

        // 2. Fetch individual likes (kind 7) via event_actions
        try {
          const likesResponse = await connectToPrimalCache("event_actions", {
            event_id: eventId,
            kind: 7,
          });

          const likeEvents = (likesResponse as PrimalEvent[])
            .filter(
              (item: PrimalEvent) =>
                Array.isArray(item) &&
                item[0] === "EVENT" &&
                item[2] &&
                typeof item[2] === "object" &&
                !Array.isArray(item[2]) &&
                "kind" in item[2] &&
                item[2].kind === 7,
            )
            .map((item: PrimalEvent) => item[2] as RelatedEvent);

          events.push(...likeEvents);
        } catch (error) {
          console.error(`Error fetching likes for event ${eventId}:`, error);
        }

        // 3. Fetch individual reposts (kind 6) via event_actions
        try {
          const repostsResponse = await connectToPrimalCache("event_actions", {
            event_id: eventId,
            kind: 6,
          });

          const repostEvents = (repostsResponse as PrimalEvent[])
            .filter(
              (item: PrimalEvent) =>
                Array.isArray(item) &&
                item[0] === "EVENT" &&
                item[2] &&
                typeof item[2] === "object" &&
                !Array.isArray(item[2]) &&
                "kind" in item[2] &&
                item[2].kind === 6,
            )
            .map((item: PrimalEvent) => item[2] as RelatedEvent);

          events.push(...repostEvents);
        } catch (error) {
          console.error(`Error fetching reposts for event ${eventId}:`, error);
        }
      } catch (error) {
        console.error(
          `Error fetching engagement data for event ${eventId}:`,
          error,
        );
      }

      return events;
    });

    // Wait for all fetches to complete
    const results = await Promise.all(fetchPromises);

    // Flatten results
    results.forEach((events) => {
      allRelatedEvents.push(...events);
    });

    // Update total count
    aggregatedStats.total = allRelatedEvents.length;

    return {
      relatedEvents: allRelatedEvents,
      count: allRelatedEvents.length,
      stats: aggregatedStats,
    };
  } catch (error) {
    console.error("Error fetching giveaway participants:", error);
    throw error;
  }
};
