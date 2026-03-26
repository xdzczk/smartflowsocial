/**
 * Search action handlers
 * Centralized action processing for search page
 */

import { nip19 } from "nostr-tools";

import { connectToPrimalCache } from "~/features/cache/primalCache.server";
import type { NostrEvent } from "~/features/nostr/types";
import { getPostStats, type PostStats } from "~/features/posts/stats.server";
import { logError } from "~/lib/error-logger.server";
import { extractNostrIdentifier } from "~/lib/extract-nostr-identifier";

import { fetchAuthorsInfoBatch } from "./search-authors-batch.server";
import {
  extractMediaUrlsFromContent,
  extractMediaUrlsFromTags,
} from "./search-event-media.server";
import { mapLooseNostrEventsToSearchReplyItems } from "./search-reply-items.server";
import {
  collectCandidatesFromPrimalResponses,
  extractDirectRepliesToRoot,
  getEvId,
  getEvKind,
} from "./search-thread-replies.server";
/**
 * Extended NostrEvent with pubkey and id (from Primal cache)
 */
type NostrEventWithMetadata = NostrEvent & {
  pubkey?: string;
  id?: string;
};

/** Result of decoding a search input: either an event id (note/nevent/hex) or an naddr (long-form article). */
export type DecodedSearchInput =
  | { type: "event_id"; eventId: string }
  | { type: "naddr"; kind: number; pubkey: string; identifier: string };

/**
 * Decode search input to either an event id or naddr (long-form) address.
 * Supports: note1, nevent1, nostr:note1, nostr:nevent1, naddr1, nostr:naddr1, 64-char hex.
 */
export function decodeSearchInput(eventInput: string): DecodedSearchInput {
  const raw = eventInput.trim();
  const normalized = raw.startsWith("nostr:") ? raw.slice(6) : raw;

  if (normalized.startsWith("naddr1")) {
    try {
      const decoded = nip19.decode(normalized);
      if (decoded.type === "naddr") {
        const { kind, pubkey, identifier } = decoded.data;
        return {
          type: "naddr",
          kind: typeof kind === "number" ? kind : 30023,
          pubkey: typeof pubkey === "string" ? pubkey : "",
          identifier: typeof identifier === "string" ? identifier : "",
        };
      }
    } catch (_e) {
      throw new Error("Invalid naddr1 format");
    }
  }

  return { type: "event_id", eventId: decodeEventId(eventInput) };
}

/**
 * Decode event ID from various formats (nevent1, note1, nostr:nevent1, nostr:note1, hex).
 * Exported for use in global search when looking up own posts by event id.
 * For naddr use decodeSearchInput instead.
 */
export function decodeEventId(eventInput: string): string {
  const eventId = eventInput.trim();
  const normalized = eventId.startsWith("nostr:")
    ? eventId.replace("nostr:", "")
    : eventId;

  if (normalized.startsWith("nevent1")) {
    try {
      const decoded = nip19.decode(normalized);
      if (decoded.type === "nevent") {
        return decoded.data.id;
      }
    } catch (_e) {
      throw new Error("Invalid nevent1 format");
    }
  } else if (normalized.startsWith("note1")) {
    try {
      const decoded = nip19.decode(normalized);
      if (decoded.type === "note") {
        return decoded.data;
      }
    } catch (_e) {
      throw new Error("Invalid note1 format");
    }
  }

  // Validate hex format (64 character hex string)
  if (!/^[a-f0-9]{64}$/i.test(normalized)) {
    throw new Error(
      "Invalid event ID format. Must be a 64-character hex string, note1, nevent1, or naddr1"
    );
  }

  return normalized;
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
      try {
        const metadata = JSON.parse(event.content) as {
          name?: string;
          display_name?: string;
          picture?: string;
        };
        authorName = metadata.name ?? metadata.display_name ?? authorName;
        authorImage = metadata.picture ?? null;
      } catch {
        // Invalid JSON in kind 0; keep pubkey fallback
      }
    }
  } catch (error) {
    logError(error instanceof Error ? error : new Error(String(error)), {
      message: "[Search] Error fetching author info",
      pubkey,
    });
  }

  if (!authorName || authorName.trim() === "" || authorName === "...") {
    authorName = `${pubkey.substring(0, 8)}...`;
  }
  return { name: authorName, image: authorImage };
}

/**
 * Fetch engagement stats for an event using cached getPostStats
 */
async function fetchEventStats(eventId: string): Promise<PostStats> {
  try {
    const stats = await getPostStats([eventId]);
    return (
      stats[eventId] ?? {
        likes: 0,
        replies: 0,
        mentions: 0,
        reposts: 0,
        zaps: 0,
        satszapped: 0,
      }
    );
  } catch (error) {
    // Log but continue - stats are optional
    const { logWarning } = await import("~/lib/error-logger.server");
    logWarning("Failed to fetch stats for searched event", {
      eventId,
      error: error instanceof Error ? error.message : String(error),
    });
    // Return empty stats on error
    return {
      likes: 0,
      replies: 0,
      mentions: 0,
      reposts: 0,
      zaps: 0,
      satszapped: 0,
    };
  }
}

/**
 * Handle search event action (notes, nevents, naddr long-form articles).
 */
/* eslint-disable sonarjs/cognitive-complexity -- branches for multiple identifier types */
export async function handleSearchEvent(eventInput: string) {
  const raw = eventInput.trim();
  if (!raw) {
    const { ValidationError } = await import("~/lib/errors");
    throw new ValidationError("Please enter an event ID, nevent1, or naddr1");
  }

  const normalized = extractNostrIdentifier(raw) ?? raw;

  let decoded: DecodedSearchInput;
  try {
    decoded = decodeSearchInput(normalized);
  } catch (error) {
    const { ValidationError } = await import("~/lib/errors");
    throw new ValidationError(
      error instanceof Error ? error.message : "Invalid format",
      { input: raw }
    );
  }

  let responses: unknown;
  let eventIdNorm: string;
  let matchByNaddr: {
    kind: number;
    pubkey: string;
    identifier: string;
  } | null = null;

  if (decoded.type === "naddr") {
    eventIdNorm = ""; // match by kind+pubkey+identifier below
    matchByNaddr = {
      kind: decoded.kind,
      pubkey: decoded.pubkey,
      identifier: decoded.identifier,
    };
    try {
      responses = await connectToPrimalCache("parametrized_replaceable_event", {
        pubkey: decoded.pubkey,
        kind: decoded.kind,
        identifier: decoded.identifier,
        extended_response: true,
      });
    } catch (error) {
      const { ExternalServiceError } = await import("~/lib/errors");
      throw new ExternalServiceError(
        "Failed to fetch replaceable event from cache",
        502,
        {
          service: "PrimalCache",
          originalError: error instanceof Error ? error.message : String(error),
        }
      );
    }
  } else {
    eventIdNorm = decoded.eventId.toLowerCase();
    // `thread_view` can auto-fetch missing events; `events` often returns the full kind 1 body
    // from cache. Run both in parallel and merge — thread payloads may omit note content early.
    const [threadSettled, eventsSettled] = await Promise.allSettled([
      connectToPrimalCache("thread_view", {
        event_id: decoded.eventId,
      }),
      connectToPrimalCache("events", {
        event_ids: [decoded.eventId],
      }),
    ]);

    let threadResponses: unknown[] = [];
    let threadError: unknown;
    if (threadSettled.status === "fulfilled") {
      threadResponses = threadSettled.value;
    } else {
      threadError = threadSettled.reason;
    }

    const eventsResponses: unknown[] =
      eventsSettled.status === "fulfilled" ? eventsSettled.value : [];

    if (threadResponses.length === 0 && eventsResponses.length === 0) {
      try {
        responses = await connectToPrimalCache("events", {
          event_ids: [decoded.eventId],
        });
      } catch (fallbackError) {
        const { ExternalServiceError } = await import("~/lib/errors");
        throw new ExternalServiceError(
          "Failed to fetch event from cache",
          502,
          {
            service: "PrimalCache",
            eventId: decoded.eventId,
            originalError:
              fallbackError instanceof Error
                ? fallbackError.message
                : String(fallbackError),
            threadViewError:
              threadError instanceof Error
                ? threadError.message
                : String(threadError),
          }
        );
      }
    } else {
      responses = [...threadResponses, ...eventsResponses];
    }
  }

  const candidates = collectCandidatesFromPrimalResponses(responses);

  const getDTag = (ev: NostrEventWithMetadata): string => {
    const tags = Array.isArray(ev.tags) ? ev.tags : [];
    const d = tags.find((t) => Array.isArray(t) && t[0] === "d");
    return d && d.length > 1 && typeof d[1] === "string" ? d[1] : "";
  };

  let eventToUse: NostrEventWithMetadata | null = null;
  if (matchByNaddr) {
    const found = candidates.find(
      (ev) =>
        getEvKind(ev) === matchByNaddr.kind &&
        (typeof ev.pubkey === "string" ? ev.pubkey : "") ===
          matchByNaddr.pubkey &&
        getDTag(ev as NostrEventWithMetadata) === matchByNaddr.identifier
    );
    eventToUse = found ? (found as NostrEventWithMetadata) : null;
  } else {
    const idMatching = candidates.filter((ev) => getEvId(ev) === eventIdNorm);
    const kind1ForId = idMatching.filter((ev) => getEvKind(ev) === 1);
    if (kind1ForId.length > 0) {
      const scored = kind1ForId.map((ev) => {
        const content = typeof ev.content === "string" ? ev.content : "";
        const pubkey = typeof ev.pubkey === "string" ? ev.pubkey : "";
        const score =
          content.trim().length * 10 +
          pubkey.length +
          (typeof ev.id === "string" && ev.id ? 1 : 0);
        return { ev, score };
      });
      scored.sort((a, b) => b.score - a.score);
      const best = scored[0]?.ev;
      eventToUse = best ? (best as NostrEventWithMetadata) : null;
    } else {
      eventToUse = null;
    }
  }

  if (!eventToUse) {
    const { NotFoundError } = await import("~/lib/errors");
    throw new NotFoundError(
      "Event not found. Please check the ID or address and try again.",
      { input: decoded.type === "naddr" ? "naddr" : decoded.eventId }
    );
  }

  const event = eventToUse;
  const evWithEventId = event as unknown as { event_id?: string };
  const evWithBody = event as unknown as { body?: string };
  const eventId =
    (typeof event.id === "string" && event.id ? event.id : null) ??
    (typeof evWithEventId.event_id === "string"
      ? evWithEventId.event_id
      : null) ??
    (decoded.type === "event_id" ? decoded.eventId : "");
  const eventPubkey = typeof event.pubkey === "string" ? event.pubkey : "";
  const eventContent =
    (typeof event.content === "string" ? event.content : null) ??
    (typeof evWithBody.body === "string" ? evWithBody.body : "");

  let replyCandidatePool = [...candidates];
  if (matchByNaddr && eventId) {
    try {
      const threadExtras = await connectToPrimalCache("thread_view", {
        event_id: eventId,
      });
      replyCandidatePool.push(
        ...collectCandidatesFromPrimalResponses(threadExtras)
      );
    } catch {
      // Thread may be unavailable; replies stay empty
    }
  }

  const replyRawEvents = extractDirectRepliesToRoot(
    replyCandidatePool,
    eventId
  );
  const replyPubkeys = [
    ...new Set(
      replyRawEvents
        .map((e) => (typeof e.pubkey === "string" ? e.pubkey : ""))
        .filter(Boolean)
    ),
  ];

  const [authorInfo, stats, authorsMap] = await Promise.all([
    fetchAuthorInfo(eventPubkey),
    fetchEventStats(eventId),
    fetchAuthorsInfoBatch(replyPubkeys),
  ]);

  // Extract media URLs from content and tags (NIP-94, url tags, etc.)
  const contentUrls = extractMediaUrlsFromContent(eventContent);
  const eventTags = Array.isArray(event.tags) ? event.tags : [];
  const tagUrls = extractMediaUrlsFromTags(eventTags);
  const mediaUrls = [...new Set([...contentUrls, ...tagUrls].filter(Boolean))];

  const replies = mapLooseNostrEventsToSearchReplyItems(
    replyRawEvents,
    authorsMap
  );

  return {
    success: true,
    event: {
      id:
        ((typeof event.id === "string" ? event.id : null) ??
          evWithEventId.event_id ??
          eventId) ||
        "",
      pubkey: eventPubkey,
      created_at:
        typeof event.created_at === "number"
          ? event.created_at
          : ((event as { created_at?: number }).created_at ?? 0),
      kind: getEvKind(event) || 1,
      content: eventContent,
      tags: Array.isArray(event.tags) ? event.tags : [],
      authorName: authorInfo.name,
      authorImage: authorInfo.image,
      mediaUrls,
    },
    stats,
    replies,
  };
}
/* eslint-enable sonarjs/cognitive-complexity */
