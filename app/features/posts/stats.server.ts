import { env } from "~/lib/env.server";
import { logError } from "~/lib/error-logger.server";
import { fetchJsonWithRetry } from "~/lib/fetch.server";

export interface PostStats {
  likes: number;
  replies: number;
  mentions: number;
  reposts: number;
  zaps: number;
  satszapped: number;
}

// ============================================================================
// Stats Parsing Helper Functions
// ============================================================================

function isStatsEvent(event: unknown, eventId: string): boolean {
  if (!Array.isArray(event) || event.length < 3 || event[0] !== "EVENT") {
    return false;
  }
  const eventDataRaw: unknown = event[2];
  if (
    !eventDataRaw ||
    typeof eventDataRaw !== "object" ||
    Array.isArray(eventDataRaw)
  ) {
    return false;
  }
  const eventTyped = eventDataRaw as { kind?: unknown; content?: unknown };
  const isStatsEvent =
    typeof eventTyped.kind === "number" &&
    eventTyped.kind === 10000100 &&
    typeof eventTyped.content === "string";
  return (
    isStatsEvent &&
    typeof eventTyped.content === "string" &&
    eventTyped.content.includes(eventId)
  );
}

function parseStatsContent(content: string): {
  likes?: number;
  replies?: number;
  mentions?: number;
  reposts?: number;
  zaps?: number;
  satszapped?: number;
} {
  try {
    const parsed: unknown = JSON.parse(content);
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      !Array.isArray(parsed)
    ) {
      const parsedObj = parsed as Record<string, unknown>;
      return {
        likes:
          typeof parsedObj["likes"] === "number"
            ? parsedObj["likes"]
            : undefined,
        replies:
          typeof parsedObj["replies"] === "number"
            ? parsedObj["replies"]
            : undefined,
        mentions:
          typeof parsedObj["mentions"] === "number"
            ? parsedObj["mentions"]
            : undefined,
        reposts:
          typeof parsedObj["reposts"] === "number"
            ? parsedObj["reposts"]
            : undefined,
        zaps:
          typeof parsedObj["zaps"] === "number" ? parsedObj["zaps"] : undefined,
        satszapped:
          typeof parsedObj["satszapped"] === "number"
            ? parsedObj["satszapped"]
            : undefined,
      };
    }
  } catch {
    // If parsing fails, return empty content
  }
  return {};
}

function createEmptyStats(): PostStats {
  return {
    likes: 0,
    replies: 0,
    mentions: 0,
    reposts: 0,
    zaps: 0,
    satszapped: 0,
  };
}

function extractStatsFromEvent(
  data: unknown[],
  eventId: string
): Record<string, PostStats> {
  const statsEvent = data.find((event: unknown) =>
    isStatsEvent(event, eventId)
  );

  if (
    Array.isArray(statsEvent) &&
    statsEvent[2] &&
    typeof statsEvent[2] === "object" &&
    !Array.isArray(statsEvent[2])
  ) {
    const eventData = statsEvent[2] as {
      kind?: unknown;
      content?: unknown;
    };
    if (eventData.content && typeof eventData.content === "string") {
      const content = parseStatsContent(eventData.content);
      return {
        [eventId]: {
          likes: content.likes ?? 0,
          replies: content.replies ?? 0,
          mentions: content.mentions ?? 0,
          reposts: content.reposts ?? 0,
          zaps: content.zaps ?? 0,
          satszapped: content.satszapped ?? 0,
        },
      };
    }
  }

  return {
    [eventId]: createEmptyStats(),
  };
}

export async function getPostStats(
  eventIds: string[]
): Promise<Record<string, PostStats>> {
  let stats: Record<string, PostStats> = {};

  if (eventIds.length === 0) {
    return stats;
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    // Fetch stats for each event ID
    const statsPromises = eventIds.map(async (eventId) => {
      // Read directly from process.env to support test environment changes
      const primalUrl =
        process.env["PRIMAL_CACHING_URL"] ?? env.PRIMAL_CACHING_URL;
      if (!primalUrl) {
        throw new Error("PRIMAL_CACHING_URL environment variable is not set");
      }
      const response = await fetchJsonWithRetry<unknown[]>(primalUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          requestType: "thread_view",
          params: {
            event_id: eventId,
          },
        }),
        timeout: 5000, // 5 seconds for cache requests
        maxRetries: 1, // Single retry for stats
      });

      const data: unknown[] = Array.isArray(response) ? response : [];
      return extractStatsFromEvent(data, eventId);
    });

    const statsResults = await Promise.all(statsPromises);
    stats = statsResults.reduce((acc, curr) => ({ ...acc, ...curr }), {});
    clearTimeout(timeoutId);
  } catch (error) {
    logError(error instanceof Error ? error : new Error(String(error)), {
      message: "Error fetching stats",
      eventIdsCount: eventIds.length,
    });
    // Initialize empty stats object with 0 values for each post
    const emptyStats: Record<string, PostStats> = {};
    stats = eventIds.reduce((acc, eventId) => {
      acc[eventId] = createEmptyStats();
      return acc;
    }, emptyStats);
  }

  return stats;
}
