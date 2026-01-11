/**
 * Event processing service
 * Processes batches of event IDs to get stats and notifications
 */

import { parseThreadViewNotifications } from "../engagement.server";
import type { EventStats, Notification, PrimalEvent } from "../types";

import { fetchThreadViewWithTimeout } from "./thread-view-fetcher.server";

export interface ProcessedEventResult {
  eventId: string;
  stats: EventStats;
  notifications: Notification[];
}

/**
 * Process batch of event IDs to get stats and notifications
 */
export async function processEventBatch(
  batchIds: string[],
  userNpub: string
): Promise<ProcessedEventResult[]> {
  const notificationPromises = batchIds.map(async (eventId) => {
    try {
      const threadViewData = await fetchThreadViewWithTimeout(eventId);
      const notifications = parseThreadViewNotifications(
        Array.isArray(threadViewData) ? threadViewData : [],
        eventId,
        userNpub
      );

      const statsEvent = (threadViewData as PrimalEvent[]).find(
        (event: PrimalEvent) => {
          if (!Array.isArray(event) || event[0] !== "EVENT") return false;
          const eventData = event[2];
          if (typeof eventData !== "object" || Array.isArray(eventData))
            return false;
          const eventTyped = eventData as { kind?: number; content?: string };
          return (
            eventTyped.kind === 10000100 &&
            eventTyped.content &&
            typeof eventTyped.content === "string" &&
            eventTyped.content.includes(eventId)
          );
        }
      );

      let eventStats: EventStats = {
        likes: 0,
        replies: 0,
        mentions: 0,
        reposts: 0,
        zaps: 0,
        satszapped: 0,
      };

      if (statsEvent && Array.isArray(statsEvent)) {
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
            eventStats = {
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

      return {
        eventId,
        stats: eventStats,
        notifications,
      };
    } catch (_error) {
      return {
        eventId,
        stats: {
          likes: 0,
          replies: 0,
          mentions: 0,
          reposts: 0,
          zaps: 0,
          satszapped: 0,
        },
        notifications: [],
      };
    }
  });

  return Promise.all(notificationPromises);
}

/**
 * Process multiple batches of events in parallel
 */
export async function processEventBatches(
  eventIds: string[],
  userNpub: string,
  batchSize = 10
): Promise<ProcessedEventResult[]> {
  const batches: string[][] = [];
  for (let i = 0; i < eventIds.length; i += batchSize) {
    batches.push(eventIds.slice(i, i + batchSize));
  }

  // Process batches in parallel
  const batchPromises = batches.map((batchIds) =>
    processEventBatch(batchIds, userNpub)
  );

  const allBatchResults = await Promise.all(batchPromises);
  return allBatchResults.flat();
}
