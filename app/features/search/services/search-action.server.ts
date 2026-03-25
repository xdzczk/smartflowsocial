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
 * Extract media URLs from event content (plain URLs in text)
 */
function extractMediaUrlsFromContent(content: string): string[] {
  const urlRegex =
    /(https?:\/\/[^\s]+\.(jpg|jpeg|png|gif|webp|mp4|webm|mov))/gi;
  return content.match(urlRegex) ?? [];
}

/**
 * Extract media URLs from event tags (e.g. ["url", "https://..."], NIP-94 style)
 */
function extractMediaUrlsFromTags(tags: string[][]): string[] {
  const urls: string[] = [];
  for (const tag of tags) {
    if (!Array.isArray(tag) || tag.length < 2) continue;
    // ["url", "https://..."]
    if (
      tag[0] === "url" &&
      typeof tag[1] === "string" &&
      /^https?:\/\//i.test(tag[1])
    ) {
      urls.push(tag[1]);
    }
    // NIP-94 imeta: ["imeta", "url", "https://..."]
    if (
      tag[0] === "imeta" &&
      tag.length >= 3 &&
      typeof tag[2] === "string" &&
      /^https?:\/\//i.test(tag[2])
    ) {
      urls.push(tag[2]);
    }
  }
  return urls;
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
    try {
      // Primal `events` only returns already-cached items; `thread_view` can trigger fetch
      // for missing events (server-side auto_fetch_missing_events path), which makes
      // external direct-ID lookups much more reliable for uncached posts.
      responses = await connectToPrimalCache("thread_view", {
        event_id: decoded.eventId,
      });
    } catch (error) {
      // Keep a compatibility fallback to `events` for deployments where thread_view may
      // be restricted or unavailable.
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
              error instanceof Error ? error.message : String(error),
          }
        );
      }
    }
  }

  const flattenPayload = (raw: unknown): NostrEventWithMetadata[] => {
    if (!raw || typeof raw !== "object") return [];
    if (Array.isArray(raw)) {
      return raw.filter(
        (e): e is NostrEventWithMetadata => e != null && typeof e === "object"
      );
    }
    const obj = raw as Record<string, unknown>;
    const ev = obj["event"];
    if (ev != null && typeof ev === "object") {
      return [ev as NostrEventWithMetadata];
    }
    const data = obj["data"];
    const events = obj["events"];
    const arr = Array.isArray(data)
      ? data
      : Array.isArray(events)
        ? events
        : null;
    if (arr) {
      return (arr as unknown[]).filter(
        (e): e is NostrEventWithMetadata => e != null && typeof e === "object"
      );
    }
    if (data != null && typeof data === "object" && !Array.isArray(data)) {
      return [data as NostrEventWithMetadata];
    }
    if (
      events != null &&
      typeof events === "object" &&
      !Array.isArray(events)
    ) {
      return [events as NostrEventWithMetadata];
    }
    return [raw as NostrEventWithMetadata];
  };
  const candidates = Array.isArray(responses)
    ? (responses as unknown[])
        .filter(
          (res): res is [string, string, unknown] =>
            Array.isArray(res) && res[0] === "EVENT" && res[2] != null
        )
        .flatMap((res) => flattenPayload(res[2]))
        .filter((ev): ev is NostrEventWithMetadata => typeof ev === "object")
    : [];

  const getDTag = (ev: NostrEventWithMetadata): string => {
    const tags = Array.isArray(ev.tags) ? ev.tags : [];
    const d = tags.find((t) => Array.isArray(t) && t[0] === "d");
    return d && d.length > 1 && typeof d[1] === "string" ? d[1] : "";
  };

  const getEvId = (ev: NostrEventWithMetadata): string =>
    (
      (ev as { id?: string }).id ??
      (ev as { event_id?: string }).event_id ??
      ""
    ).toLowerCase();
  const getEvKind = (ev: NostrEventWithMetadata): number =>
    (ev as { kind?: number }).kind ??
    (ev as { event_kind?: number }).event_kind ??
    0;

  let eventToUse: NostrEventWithMetadata | null = null;
  if (matchByNaddr) {
    eventToUse =
      candidates.find(
        (ev) =>
          getEvKind(ev) === matchByNaddr.kind &&
          (typeof ev.pubkey === "string" ? ev.pubkey : "") ===
            matchByNaddr.pubkey &&
          getDTag(ev) === matchByNaddr.identifier
      ) ?? null;
  } else {
    const idMatching = candidates.filter((ev) => getEvId(ev) === eventIdNorm);
    const kind1Note = idMatching.find((ev) => getEvKind(ev) === 1);
    const firstMatch = idMatching.length > 0 ? (idMatching[0] ?? null) : null;
    eventToUse = kind1Note ?? firstMatch;
    if (eventToUse && getEvKind(eventToUse) !== 1) {
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
  const [authorInfo, stats] = await Promise.all([
    fetchAuthorInfo(eventPubkey),
    fetchEventStats(eventId),
  ]);

  // Extract media URLs from content and tags (NIP-94, url tags, etc.)
  const contentUrls = extractMediaUrlsFromContent(eventContent);
  const eventTags = Array.isArray(event.tags) ? event.tags : [];
  const tagUrls = extractMediaUrlsFromTags(eventTags);
  const mediaUrls = [...new Set([...contentUrls, ...tagUrls].filter(Boolean))];

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
  };
}
/* eslint-enable sonarjs/cognitive-complexity */
