/**
 * Search action handlers
 * Centralized action processing for search page
 */

import { nip19 } from "nostr-tools";

import { connectToPrimalCache } from "~/features/cache/primalCache.server";
import type { NostrEvent } from "~/features/nostr/types";
/**
 * Extended NostrEvent with pubkey and id (from Primal cache)
 */
type NostrEventWithMetadata = NostrEvent & {
  pubkey?: string;
  id?: string;
};

/**
 * Decode event ID from various formats (nevent1, note1, hex)
 */
function decodeEventId(eventInput: string): string {
  const eventId = eventInput.trim();

  // Check if input is in nevent1 format
  if (eventId.startsWith("nevent1")) {
    try {
      const decoded = nip19.decode(eventId);
      if (decoded.type === "nevent") {
        return decoded.data.id;
      }
    } catch (_e) {
      throw new Error("Invalid nevent1 format");
    }
  } else if (eventId.startsWith("nostr:nevent1")) {
    try {
      const decoded = nip19.decode(eventId.replace("nostr:", ""));
      if (decoded.type === "nevent") {
        return decoded.data.id;
      }
    } catch (_e) {
      throw new Error("Invalid nevent1 format");
    }
  } else if (eventId.startsWith("note1")) {
    try {
      const decoded = nip19.decode(eventId);
      if (decoded.type === "note") {
        return decoded.data;
      }
    } catch (_e) {
      throw new Error("Invalid note1 format");
    }
  }

  // Validate hex format (64 character hex string)
  if (!/^[a-f0-9]{64}$/i.test(eventId)) {
    throw new Error(
      "Invalid event ID format. Must be a 64-character hex string, note1, or nevent1"
    );
  }

  return eventId;
}

/**
 * Fetch author profile information
 */
async function fetchAuthorInfo(pubkey: string): Promise<{
  name: string;
  image: string | null;
}> {
  let authorName = pubkey.substring(0, 8) + "...";
  let authorImage = null;

  try {
    const userInfoResponses = await connectToPrimalCache("user_infos", {
      pubkeys: [pubkey],
    });

    const userMetadataEvent = userInfoResponses.find(
      (res): res is [string, string, NostrEventWithMetadata] =>
        Array.isArray(res) &&
        res[0] === "EVENT" &&
        res[2] !== undefined &&
        (res[2] as NostrEventWithMetadata).kind === 0 &&
        (res[2] as NostrEventWithMetadata).pubkey === pubkey
    );

    if (userMetadataEvent?.[2]) {
      const event = userMetadataEvent[2];
      const metadata = JSON.parse(event.content) as {
        name?: string;
        display_name?: string;
        picture?: string;
      };
      authorName = metadata.name ?? metadata.display_name ?? authorName;
      authorImage = metadata.picture ?? null;
    }
  } catch (error) {
    console.error("[Search] Error fetching author info:", error);
  }

  return { name: authorName, image: authorImage };
}

/**
 * Fetch engagement stats for an event
 */
async function fetchEventStats(eventId: string): Promise<{
  likes: number;
  replies: number;
  mentions: number;
  reposts: number;
  zaps: number;
  satszapped: number;
}> {
  let stats = {
    likes: 0,
    replies: 0,
    mentions: 0,
    reposts: 0,
    zaps: 0,
    satszapped: 0,
  };

  try {
    const threadResponses = await connectToPrimalCache("thread_view", {
      event_id: eventId,
    });

    const statsEvent = threadResponses.find(
      (res): res is [string, string, NostrEventWithMetadata] =>
        Array.isArray(res) &&
        res[0] === "EVENT" &&
        res[2] !== undefined &&
        (res[2] as NostrEventWithMetadata).kind === 10000100 &&
        typeof (res[2] as NostrEventWithMetadata).content === "string" &&
        (res[2] as NostrEventWithMetadata).content.includes(eventId)
    );

    if (statsEvent?.[2]) {
      const event = statsEvent[2];
      const content = JSON.parse(event.content) as {
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
    }
  } catch (error) {
    // Log but continue - stats are optional
    const { logWarning } = await import("~/lib/error-logger.server");
    logWarning("Failed to fetch stats for searched event", {
      eventId,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  return stats;
}

/**
 * Extract media URLs from event content
 */
function extractMediaUrls(content: string): string[] {
  const urlRegex =
    /(https?:\/\/[^\s]+\.(jpg|jpeg|png|gif|webp|mp4|webm|mov))/gi;
  return content.match(urlRegex) ?? [];
}

/**
 * Handle search event action
 */
export async function handleSearchEvent(eventInput: string) {
  if (!eventInput || eventInput.trim() === "") {
    const { ValidationError } = await import("~/lib/errors");
    throw new ValidationError("Please enter an event ID or nevent1");
  }

  // Decode event ID from various formats
  let eventId: string;
  try {
    eventId = decodeEventId(eventInput);
  } catch (error) {
    const { ValidationError } = await import("~/lib/errors");
    throw new ValidationError(
      error instanceof Error ? error.message : "Invalid event ID format",
      { input: eventInput }
    );
  }

  // Fetch event from Primal cache
  let responses: unknown;
  try {
    responses = await connectToPrimalCache("events", {
      event_ids: [eventId],
    });
  } catch (error) {
    const { ExternalServiceError } = await import("~/lib/errors");
    throw new ExternalServiceError("Failed to fetch event from cache", 502, {
      service: "PrimalCache",
      eventId,
      originalError: error instanceof Error ? error.message : String(error),
    });
  }

  // Find the EVENT response
  const eventResponse = Array.isArray(responses)
    ? responses.find(
        (res): res is [string, string, NostrEventWithMetadata] =>
          Array.isArray(res) && res[0] === "EVENT" && res[2] !== undefined
      )
    : null;

  if (!eventResponse?.[2]) {
    const { NotFoundError } = await import("~/lib/errors");
    throw new NotFoundError(
      "Event not found. Please check the event ID and try again.",
      { eventId }
    );
  }

  const event = eventResponse[2];
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- Runtime safety: defensive check for array access
  if (!event) {
    const { NotFoundError } = await import("~/lib/errors");
    throw new NotFoundError(
      "Event not found. Please check the event ID and try again.",
      { eventId }
    );
  }

  // Fetch author profile info and stats in parallel
  const eventPubkey = typeof event.pubkey === "string" ? event.pubkey : "";
  const eventContent = typeof event.content === "string" ? event.content : "";
  const [authorInfo, stats] = await Promise.all([
    fetchAuthorInfo(eventPubkey),
    fetchEventStats(eventId),
  ]);

  // Extract media URLs from content
  const mediaUrls = extractMediaUrls(eventContent);

  return {
    success: true,
    event: {
      id: typeof event.id === "string" ? event.id : eventId,
      pubkey: eventPubkey,
      created_at: typeof event.created_at === "number" ? event.created_at : 0,
      kind: typeof event.kind === "number" ? event.kind : 1,
      content: eventContent,
      tags: Array.isArray(event.tags) ? event.tags : [],
      authorName: authorInfo.name,
      authorImage: authorInfo.image,
      mediaUrls,
    },
    stats,
  };
}
