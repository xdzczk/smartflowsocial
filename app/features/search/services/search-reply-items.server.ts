import {
  extractMediaUrlsFromContent,
  extractMediaUrlsFromTags,
} from "./search-event-media.server";
import type { LooseNostrEvent } from "./search-thread-replies.server";

/** Matches client `searchReplyItemSchema` / `SearchReplyItem`. */
export interface SearchReplyItemDTO {
  id: string;
  pubkey: string;
  created_at: number;
  content: string;
  authorName: string;
  authorImage: string | null;
  mediaUrls?: string[];
}

export function mapLooseNostrEventsToSearchReplyItems(
  rawEvents: LooseNostrEvent[],
  authorsMap: Map<string, { name: string; image: string | null }>
): SearchReplyItemDTO[] {
  return rawEvents.map((ev) => {
    const pk = typeof ev.pubkey === "string" ? ev.pubkey : "";
    const info = authorsMap.get(pk) ?? {
      name: `${pk.slice(0, 8)}...`,
      image: null as string | null,
    };
    const replyContent = typeof ev.content === "string" ? ev.content : "";
    const replyTags = Array.isArray(ev.tags) ? ev.tags : [];
    const rMedia = [
      ...new Set([
        ...extractMediaUrlsFromContent(replyContent),
        ...extractMediaUrlsFromTags(replyTags),
      ]),
    ].filter(Boolean);
    const ridFromId = typeof ev.id === "string" ? ev.id : "";
    const ridFromEventId = typeof ev.event_id === "string" ? ev.event_id : "";
    const rid = ridFromId || ridFromEventId;
    return {
      id: rid,
      pubkey: pk,
      created_at: typeof ev.created_at === "number" ? ev.created_at : 0,
      content: replyContent,
      authorName: info.name,
      authorImage: info.image,
      ...(rMedia.length > 0 ? { mediaUrls: rMedia } : {}),
    };
  });
}
